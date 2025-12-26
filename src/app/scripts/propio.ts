import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import nodemailer from "nodemailer";
import * as fs from "fs";
import * as path from "path";

interface LoggerConfig {
  scriptName: string;
  logDir?: string;
  notificationEmail?: string;
}

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

interface StepData {
  [key: string]: any;
  skipRemaining?: boolean;
  matchRules?: any[];
  intervalMin?: number;
  intervalMax?: number;
  sendEmail?: (rowData: any) => Promise<boolean>;
  checkSessionExpired?: (page: Page) => Promise<boolean>;
  reLoginSteps?: Step[];
  account?: string;
  password?: string;
  collectedLinks?: Array<{ link: string; data: any }>;
}

interface Step {
  type: string;
  selector?: string;
  value?: string;
  timeout?: number;
  time?: number;
  url?: string | ((data: StepData) => string);
  path?: string;
  fn?: any;
  args?: any;
  onResult?: (result: any, data: StepData) => Promise<void> | void;
  key?: string;
  state?: string;
  intervalMin?: number;
  intervalMax?: number;
  stopIf?: any;
}

interface BrowserConfig {
  headless?: boolean;
  args?: string[];
  executablePath?: string;
}

interface FlexibleBootConfig {
  url: string | ((data: StepData) => string);
  steps?: Step[];
  maxRetries?: number;
  headless?: boolean;
  stepData?: StepData;
  browserConfig?: BrowserConfig;
  loginStepsCount?: number;
  processingStepsCount?: number;
  waitBetweenCycles?: boolean;
  runOnce?: boolean;
  reloadOnError?: boolean;
  reloadUrl?: string | null;
  logger: Logger;
  onError?: (error: Error, page: Page, stepData: StepData) => Promise<boolean>;
}

class Logger {
  private scriptName: string;
  private notificationEmail?: string;
  private transporter?: nodemailer.Transporter;

  constructor(config: LoggerConfig, emailConfig?: EmailConfig) {
    this.scriptName = config.scriptName;
    this.notificationEmail = config.notificationEmail;

    if (emailConfig && this.notificationEmail) {
      this.transporter = nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        auth: emailConfig.auth,
      });
    }
  }

  private write(level: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      script: this.scriptName,
      message,
      ...(data && { data }),
    };
    console.log(`[${timestamp}] [${level}] [${this.scriptName}] ${message}`, data || '');
  }

  info(message: string, data?: any): void {
    this.write("INFO", message, data);
  }

  warn(message: string, data?: any): void {
    this.write("WARN", message, data);
  }

  error(message: string, data?: any): void {
    this.write("ERROR", message, data);
  }

  async critical(message: string, data?: any): Promise<void> {
    this.write("CRITICAL", message, data);

    if (this.transporter && this.notificationEmail) {
      try {
        await this.transporter.sendMail({
          from: "no.reply@thetranslationgate.com",
          to: this.notificationEmail,
          subject: `[CRITICAL] Automation Stopped - ${this.scriptName}`,
          html: `
            <h2>Critical Error in Automation</h2>
            <p><strong>Script:</strong> ${this.scriptName}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            <p><strong>Message:</strong> ${message}</p>
            ${data ? `<pre>${JSON.stringify(data, null, 2)}</pre>` : ""}
            <p><strong>Action Required:</strong> Manual intervention needed.</p>
          `,
        });
      } catch (emailErr: any) {
        this.write("ERROR", `Failed to send critical alert: ${emailErr.message}`);
      }
    }
  }

  success(message: string, data?: any): void {
    this.write("SUCCESS", message, data);
  }
}

async function flexibleBoot(config: FlexibleBootConfig): Promise<void> {
  const {
    url,
    steps = [],
    maxRetries = 1,
    headless = false,
    stepData: initialStepData = {},
    browserConfig = {},
    loginStepsCount = 0,
    processingStepsCount = 0,
    waitBetweenCycles = true,
    runOnce = false,
    reloadOnError = true,
    reloadUrl = null,
    logger,
    onError,
  } = config;

  let stepData: StepData = { ...initialStepData };
  const OFFERS_URL = reloadUrl;

  process.on("uncaughtException", async (err) => {
    await logger.critical("Uncaught exception occurred", {
      error: err.message,
      stack: err.stack,
    });
    logger.info("Attempting to continue execution");
  });

  const actionHandlers: Record<string, (page: Page, step: Step) => Promise<any>> = {
    click: async (page: Page, step: Step) => {
      await page.waitForSelector(step.selector!, {
        state: "visible",
        timeout: step.timeout || 10000,
      });
      await page.click(step.selector!);
    },
    type: async (page: Page, step: Step) => {
      await page.waitForSelector(step.selector!, {
        state: "visible",
        timeout: step.timeout || 10000,
      });
      if (typeof step.value !== 'string') {
        throw new Error(`Type step failed: Value must be a string, got ${typeof step.value}`);
      }
      await page.fill(step.selector!, step.value!);
    },
    waitFor: async (page: Page, step: Step) =>
      await page.waitForSelector(step.selector!, {
        state: "visible",
        timeout: step.timeout || 10000,
      }),
    wait: async (page: Page, step: Step) =>
      await new Promise((res) => setTimeout(res, step.time)),
    goto: async (page: Page, step: Step) => {
      const rawUrl =
        typeof step.url === "function" ? step.url(stepData) : step.url;
      if (!rawUrl || typeof rawUrl !== "string") return;
      await page.goto(rawUrl, {
        waitUntil: "domcontentloaded",
        timeout: step.timeout || 60000,
      });
    },
    screenshot: async (page: Page, step: Step) =>
      await page.screenshot({ path: step.path || "screenshot.png" }),
    evaluate: async (page: Page, step: Step) => {
      if (typeof step.fn !== "function")
        throw new Error("Missing 'fn' in evaluate step");

      let args = step.args;
      if (typeof args === "function") {
        args = args(stepData);
      }

      const result = await page.evaluate(step.fn, args);
      if (typeof step.onResult === "function")
        await step.onResult(result, stepData);
      return result;
    },
    custom: async (page: Page, step: Step) => {
      if (typeof step.fn !== "function") {
        throw new Error("Missing 'fn' in custom step");
      }

      const result = await step.fn(page, stepData);
      if (typeof step.onResult === "function") {
        await step.onResult(result, stepData);
      }

      return result;
    },
    keyboardPress: async (page: Page, step: Step) => 
      await page.keyboard.press(step.key!),
    waitNavigation: async (page: Page, step: Step) => {
      await page.waitForNavigation({
        waitUntil: "load",
        timeout: step.timeout || 30000,
      });
    },
    waitForLoadState: async (page: Page, step: Step) => {
      await page.waitForLoadState((step.state as any) || "networkidle");
    },
  };

  async function returnToOffersWithoutReload(page: Page): Promise<void> {
    try {
      logger.info("Preparing for next cycle", { url: OFFERS_URL });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err: any) {
      logger.error("Error in navigation preparation", { error: err.message });
    }
  }

  async function returnToOffersWithReload(page: Page): Promise<void> {
    try {
      logger.info("Reloading offers page", { url: OFFERS_URL });
      await page.goto(OFFERS_URL!, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await new Promise((resolve) => setTimeout(resolve, 3000));
      logger.success("Successfully reloaded offers page");
    } catch (err: any) {
      logger.error("Failed to reload offers page", { error: err.message });
      throw err;
    }
  }

  async function initializeBrowser(): Promise<{
    browser: Browser;
    context: BrowserContext;
    page: Page; 
  }> {
    const defaultBrowserConfig: BrowserConfig = {
      headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    };

    const browser = await chromium.launch({
      ...defaultBrowserConfig,
      ...browserConfig,
    });

    const context = await browser.newContext({
      viewport: null,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });

    return { browser, context, page };
  }

  async function executeSteps(
    page: Page,
    stepsToExecute: Step[],
    stepPrefix: string = ""
  ): Promise<void> {
    for (const [index, step] of stepsToExecute.entries()) {
      if (stepData.skipRemaining) {
        logger.info("Skipping remaining steps", { reason: "skipRemaining flag set" });
        stepData.skipRemaining = false;
        break;
      }

      const handler = actionHandlers[step.type];
      if (handler) {
        logger.info(`Executing step`, {
          step: index + 1,
          type: step.type,
          selector: step.selector || step.url || "",
          prefix: stepPrefix,
        });
        try {
          await handler(page, step);
        } catch (stepErr: any) {
          logger.error(`Step execution failed`, {
            step: index + 1,
            type: step.type,
            error: stepErr.message,
          });

          if (
            stepErr.message.includes(
              "Target page, context or browser has been closed"
            )
          ) {
            logger.warn("Session invalidated, will restart");
            throw stepErr;
          }

          await returnToOffersWithReload(page);
          throw stepErr;
        }
      } else {
        logger.warn("Unknown step type", { type: step.type });
      }
    }
  }

  async function performLogin(
    browser: Browser,
    context: BrowserContext,
    page: Page
  ): Promise<void> {
    if (loginStepsCount <= 0) {
      logger.info("No login steps specified, skipping login");
      return;
    }

    const loginSteps = steps.slice(0, loginStepsCount);
    await executeSteps(page, loginSteps, "Login");
    logger.success("Login completed successfully");
  }

  async function processData(page: Page): Promise<void> {
    if (processingStepsCount <= 0) {
      logger.info("No processing steps specified, skipping");
      return;
    }

    const processingSteps = steps.slice(-processingStepsCount);

    try {
      await executeSteps(page, processingSteps, "Processing");
      logger.success("Data processing completed");
      await returnToOffersWithoutReload(page);
    } catch (err: any) {
      logger.error("Error in data processing", { error: err.message });
      
      if (onError) {
        const handled = await onError(err, page, stepData);
        if (handled) {
          logger.info("Error handled by custom onError handler");
          return;
        }
      }
      
      await returnToOffersWithReload(page);
      throw err;
    }
  }

  async function runInitialSetup(
    attempt: number = 1
  ): Promise<{
    browser: Browser;
    context: BrowserContext;
    page: Page;
    success: boolean;
  }> {
    let { browser, context, page } = await initializeBrowser();
    try {
      const initialUrl = typeof url === "function" ? url(stepData) : url;
      logger.info("Navigating to initial URL", { url: initialUrl, attempt });
      await page.goto(initialUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await performLogin(browser, context, page);

      return { browser, context, page, success: true };
    } catch (err: any) {
      logger.error("Setup attempt failed", { attempt, error: err.message });
      await browser.close().catch(() => {});
      if (attempt < maxRetries) {
        const waitTime = Math.min(5000 * attempt, 30000);
        logger.info("Retrying setup", { waitTime, nextAttempt: attempt + 1 });
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return runInitialSetup(attempt + 1);
      } else {
        await logger.critical("Max setup retries reached", { attempt });
        return { browser: null as any, context: null as any, page: null as any, success: false };
      }
    }
  }

  logger.info("🚀 Flexible boot initialized");
  logger.info("🚀 Boot script started successfully...");

  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  while (true) {
    const setupResult = await runInitialSetup();
    if (!setupResult.success) {
      await logger.critical("Failed to complete initial setup, retrying in 30s");
      await new Promise((resolve) => setTimeout(resolve, 30000));
      continue;
    }

    ({ browser, context, page } = setupResult);

    if (runOnce) {
      try {
        await processData(page);
        logger.success("Single run completed");
      } catch (err: any) {
        logger.error("Error in single run", { error: err.message });
        await returnToOffersWithReload(page);
      }
      await browser.close();

      logger.info("Single run finished, restarting in 60s");
      await new Promise((resolve) => setTimeout(resolve, 60000));
      continue;
    }

    while (true) {
      try {
        logger.info("Starting processing cycle");
        await processData(page);
        logger.success("Processing cycle completed");

        if (waitBetweenCycles && stepData.intervalMin && stepData.intervalMax) {
          const waitTime =
            Math.floor(
              Math.random() * (stepData.intervalMax - stepData.intervalMin + 1)
            ) + stepData.intervalMin;
          logger.info("Waiting before next cycle", { waitTime });
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      } catch (err: any) {
        logger.error("Error in processing cycle", { error: err.message });

        try {
          await returnToOffersWithReload(page);
          await new Promise((resolve) => setTimeout(resolve, 3000));
          continue;
        } catch (returnErr: any) {
          logger.error("Failed to reload page", { error: returnErr.message });
          logger.info("Restarting browser session");
          await browser.close().catch(() => {});
          break;
        }
      }
    }
  }
}

async function main() {
  console.log("🚀 Starting Propio automation script...");
  
  const configArg = process.argv[2];
  if (!configArg) {
    console.error("❌ Error: Config argument required");
    process.exit(1);
  }

  let input: any;
  
  if (configArg.startsWith('{')) {
    try {
      input = JSON.parse(configArg);
      console.log("✅ Config loaded from JSON argument");
    } catch (e: any) {
      console.error("❌ FATAL ERROR: Invalid JSON argument:", e.message);
      process.exit(1);
    }
  } 
  else {
    try {
      const rawConfig = await fs.promises.readFile(configArg, "utf-8");
      input = JSON.parse(rawConfig);
      console.log("✅ Config file loaded successfully from:", configArg);
    } catch (e: any) {
      console.error("❌ FATAL ERROR: Failed to read or parse config file:", e.message);
      console.error("Config path tried:", configArg);
      process.exit(1);
    }
  }
  
  if (input.setup) {
    console.log(" Found setup object, extracting configuration");
    input = {
      ...input.setup,
      id: input.id,
      name: input.name,
      provider: input.provider
    };
  }

  const {
    account,
    password,
    intervalMin = 2000,
    intervalMax = 5000,
    notification,
    matchRules = [],
  } = input;

  console.log("📋 Configuration loaded:", {
    account,
    intervalMin,
    intervalMax,
    matchRulesCount: matchRules.length,
    notification: notification ? "configured" : "not configured"
  });

  const emailConfig: EmailConfig = {
    host: "email-smtp.us-west-2.amazonaws.com",
    port: 587,
    secure: false,
    auth: {
      user: "AKIAXQIKSTQD33FA3NN5",
      pass: "BORbufsUbJFbEoscQcbug92IKgwpK/UdzBMkcwpq0xX6",
    },
    from: "no.reply@thetranslationgate.com",
  };

  const loggerConfig: LoggerConfig = {
    scriptName: `propio_${account || 'default'}`,
    notificationEmail: notification,
  };

  const logger = new Logger(loggerConfig, emailConfig);

  const transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: emailConfig.auth,
  });

  async function sendEmail(rowData: any): Promise<boolean> {
    if (!notification) {
      logger.warn("Notification email not configured, skipping email");
      return false;
    }
    
    try {
      const mailOptions = {
        from: emailConfig.from,
        to: notification,
        subject: "Task Accepted Successfully",
        html: `
          <h2>Task Accepted & Confirmed</h2>
          <p>The following task has been successfully accepted:</p>
          <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
            ${Object.entries(rowData)
              .map(
                ([key, value]) =>
                  `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`
              )
              .join("")}
          </table>
          <br>
          <p style="color: green;"><strong>Status: Proposal Accepted</strong></p>
        `,
      };

      await transporter.sendMail(mailOptions);
      logger.success("Task acceptance email sent", { recipient: notification });
      return true;
    } catch (error: any) {
      logger.error("Failed to send email", { error: error.message });
      return false;
    }
  }

  async function checkSessionExpired(page: Page): Promise<boolean> {
    try {
      const currentUrl = page.url();

      if (currentUrl.includes("Login.aspx")) {
        return true;
      }

      const loginButton = await page.$("#ctl00_Main_BtnAuthInternal");
      if (loginButton) {
        return true;
      }

      const bodyText = await page.evaluate(() => document.body.innerText);
      if (
        bodyText.includes("session") &&
        (bodyText.includes("expired") || bodyText.includes("timeout"))
      ) {
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  const reLoginSteps: Step[] = [
    {
      type: "evaluate",
      fn: () => {
        return true;
      },
    },
    {
      type: "goto",
      url: "https://vu.propio-ls.com/a/Propio/Access/Login.aspx",
    },
    { type: "waitForLoadState", state: "networkidle" },
    { type: "click", selector: "#ctl00_Main_BtnAuthInternal" },
    { type: "type", selector: "#ctl00_Main_TextboxLogin", value: account },
    { type: "type", selector: "#ctl00_Main_TextboxPassword", value: password },
    { type: "click", selector: "#ctl00_Main_Img1" },
    { type: "waitForLoadState", state: "networkidle" },
    {
      type: "evaluate",
      fn: () => {
        return true;
      },
    },
  ];

  logger.info("Starting Propio automation script", {
    account,
    intervalMin,
    intervalMax,
    matchRulesCount: matchRules.length,
  });

  await flexibleBoot({
    url: "https://vu.propio-ls.com/a/Propio/Access/Login.aspx",
    headless: false,
    maxRetries: 5,
    logger,

    loginStepsCount: 5,
    processingStepsCount: 13,

    waitBetweenCycles: true,
    runOnce: false,
    reloadOnError: true,
    reloadUrl: "https://vu.propio-ls.com/a/propio/Jobs/FindJobs.aspx?x=&q1=preset&v1=open",

    browserConfig: {
      headless: false,
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    },

    stepData: {
      matchRules,
      intervalMin,
      intervalMax,
      sendEmail,
      checkSessionExpired,
      reLoginSteps,
      account,
      password,
      collectedLinks: [],
    },

    onError: async (error: Error, page: Page, stepData: StepData): Promise<boolean> => {
      const sessionExpired = await stepData.checkSessionExpired!(page);

      if (sessionExpired) {
        try {
          logger.info("Session expired, attempting re-login");
          
          for (const step of stepData.reLoginSteps!) {
            if (step.type === "goto") {
              await page.goto(step.url as string);
            } else if (step.type === "waitForLoadState") {
              await page.waitForLoadState(step.state as any);
            } else if (step.type === "click") {
              await page.click(step.selector!);
            } else if (step.type === "type") {
              await page.fill(step.selector!, step.value!);
            } else if (step.type === "evaluate") {
              await page.evaluate(step.fn);
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          logger.success("Re-login completed successfully");
          return true;
        } catch (reLoginError: any) {
          logger.error("Re-login failed", { error: reLoginError.message });
          return false;
        }
      }

      return false;
    },

    steps: [
      { type: "click", selector: "#ctl00_Main_BtnAuthInternal" },
      { type: "type", selector: "#ctl00_Main_TextboxLogin", value: account },
      { type: "type", selector: "#ctl00_Main_TextboxPassword", value: password },
      { type: "click", selector: "#ctl00_Main_Img1" },
      {
        type: "goto",
        url: "https://vu.propio-ls.com/a/propio/Jobs/FindJobs.aspx?x=&q1=preset&v1=open",
      },

      {
        type: "evaluate",
        fn: async () => {
          return true;
        },
      },

      { type: "waitForLoadState", state: "networkidle" },
      {
        type: "waitFor",
        selector: "#ctl00_Main_SSC1_Combo1_Arrow",
        timeout: 10000,
      },
      { type: "click", selector: "#ctl00_Main_SSC1_Combo1_Arrow" },
      {
        type: "waitFor",
        selector: "#ctl00_Main_SSC1_Combo1_i0_Lnk",
        timeout: 10000,
      },
      { type: "click", selector: "#ctl00_Main_SSC1_Combo1_i0_Lnk" },
      { type: "waitForLoadState", state: "networkidle" },

      {
        type: "evaluate",
        fn: () => {
          return new Promise((resolve) => {
            const initialRowCount = document.querySelectorAll(
              "tbody tr[role='row']"
            ).length;

            let checkCount = 0;
            const maxChecks = 40;
            let stabilityCount = 0;
            let lastRowCount = initialRowCount;

            const checkInterval = setInterval(() => {
              checkCount++;
              const currentRowCount = document.querySelectorAll(
                "tbody tr[role='row']"
              ).length;

              if (currentRowCount === lastRowCount && currentRowCount > 0) {
                stabilityCount++;
              } else {
                stabilityCount = 0;
              }

              lastRowCount = currentRowCount;

              if (stabilityCount >= 2) {
                clearInterval(checkInterval);
                setTimeout(() => resolve(true), 1000);
                return;
              }

              if (checkCount >= maxChecks) {
                clearInterval(checkInterval);
                resolve(true);
              }
            }, 500);
          });
        },
      },

      {
        type: "waitFor",
        selector: "tbody tr[role='row']",
        timeout: 10000,
      },
      {
        type: "evaluate",
        fn: () => {
          const rows = Array.from(
            document.querySelectorAll("tbody tr[role='row']")
          );
          if (!rows.length) {
            return { headers: [], data: [], links: [] };
          }

          const headerCells = Array.from(
            document.querySelectorAll("thead th[data-field]")
          );
          const headers = headerCells.map((cell: any) =>
            cell.getAttribute("data-field")
          );

          const data = rows.map((row: any) => {
            const cells = Array.from(row.cells);
            const rowData = Object.fromEntries(
              cells.map((cell: any, i: number) => {
                const dataField = cell.getAttribute("data-field");
                const header = dataField || headers[i] || `col_${i}`;
                return [header, cell.innerText.trim()];
              })
            );

            return rowData;
          });

          const links = rows.map((row: any) => {
            const lastCell = row.cells[row.cells.length - 1];
            const selectLink = lastCell.querySelector(
              "a[href*='JobDetailsView']"
            );

            if (selectLink) {
              return selectLink.getAttribute("href");
            }

            const anyLink = row.querySelector("a[href*='JobDetailsView']");
            return anyLink ? anyLink.getAttribute("href") : null;
          });

          return { headers, data, links };
        },
        onResult: async (result: any, stepData: any) => {
          const { headers, data, links } = result;

          if (!data || data.length === 0) {
            stepData.collectedLinks = [];
            return;
          }

          function matchValue(cellValue: string, expected: string): boolean {
            const cellStr = String(cellValue).trim();
            const expectedStr = String(expected).trim();

            if (cellStr === expectedStr) {
              return true;
            }

            if (expectedStr.startsWith("prefix:")) {
              const prefix = expectedStr.substring(7);
              return cellStr.startsWith(prefix);
            }

            if (expectedStr.startsWith("contains:")) {
              const substring = expectedStr.substring(9);
              return cellStr.includes(substring);
            }

            if (expectedStr.startsWith("/") && expectedStr.endsWith("/")) {
              try {
                const pattern = expectedStr.slice(1, -1);
                const regex = new RegExp(pattern, "i");
                return regex.test(cellStr);
              } catch (e) {
                return false;
              }
            }

            return false;
          }

          function rowMatchesRules(row: any, rules: any[]): boolean {
            if (!rules || rules.length === 0) {
              return true;
            }

            return rules.some((rule: any) => {
              const allConditionsMatch = Object.entries(rule).every(
                ([key, expected]) => {
                  if (!(key in row)) {
                    return false;
                  }

                  const cellValue = row[key];
                  let matched = false;

                  if (Array.isArray(expected)) {
                    matched = expected.some((exp: any) => matchValue(cellValue, exp));
                  } else {
                    matched = matchValue(cellValue, expected as string);
                  }

                  return matched;
                }
              );

              return allConditionsMatch;
            });
          }

          const matchedLinks: Array<{ link: string; data: any }> = [];

          data.forEach((row: any, index: number) => {
            const matches = rowMatchesRules(row, stepData.matchRules || []);

            if (matches && links[index]) {
              const fullLink = `https://vu.propio-ls.com${links[index]}`;
              matchedLinks.push({ link: fullLink, data: row });
            }
          });

          stepData.collectedLinks = matchedLinks;
        },
      },

      {
        type: "custom",
        fn: async (page: Page, stepData: any) => {
          const { collectedLinks, sendEmail } = stepData;

          if (!collectedLinks || collectedLinks.length === 0) {
            return false;
          }

          for (let i = 0; i < collectedLinks.length; i++) {
            const { link, data } = collectedLinks[i];

            try {
              await page.goto(link);
              await page.waitForLoadState("networkidle");

              const acceptButtonExists = await page.$(
                "#ctl00_Main_StatusChange1_RepeaterStatus_ctl00_LinkSetStatus"
              );
              if (!acceptButtonExists) {
                continue;
              }

              await page.click(
                "#ctl00_Main_StatusChange1_RepeaterStatus_ctl00_LinkSetStatus"
              );

              await page.evaluate(() => {
                return new Promise((resolve) => {
                  let attempts = 0;
                  const maxAttempts = 30;

                  const checkModal = setInterval(() => {
                    attempts++;

                    const modalById = document.getElementById(
                      "RadToolTipWrapper_ctl00_Main_StatusChange1_RadToolTip11011764105093909"
                    );
                    const modalByClass = document.querySelector(
                      ".rtWrapper.rtShadow"
                    );
                    const checkbox = document.querySelector(
                      "#ctl00_Main_StatusChange1_ctl01_CheckBoxTerms"
                    );

                    if (checkbox || modalById || modalByClass) {
                      clearInterval(checkModal);
                      setTimeout(() => resolve(true), 500);
                      return;
                    }

                    if (attempts >= maxAttempts) {
                      clearInterval(checkModal);
                      resolve(false);
                    }
                  }, 300);
                });
              });

              const checkboxResult = await page.evaluate(() => {
                const checkbox = document.querySelector(
                  "#ctl00_Main_StatusChange1_ctl01_CheckBoxTerms"
                ) as HTMLInputElement;

                if (!checkbox) {
                  return false;
                }

                if (!checkbox.checked) {
                  checkbox.click();
                  return true;
                } else {
                  return true;
                }
              });

              if (!checkboxResult) {
                continue;
              }

              await new Promise((resolve) => setTimeout(resolve, 1000));

              const okResult = await page.evaluate(() => {
                const okButton = document.querySelector(
                  "#ctl00_Main_StatusChange1_ctl01_LinkOK"
                ) as HTMLElement;

                if (!okButton) {
                  return false;
                }

                okButton.click();
                return true;
              });

              if (okResult) {
                await sendEmail(data);
              }

              await new Promise((resolve) => setTimeout(resolve, 2000));
            } catch (error) {
              continue;
            }
          }

          return true;
        },
      },

      {
        type: "evaluate",
        fn: () => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(true);
            }, 1000);
          });
        },
      },

      {
        type: "evaluate",
        fn: () => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(true);
            }, 1000);
          });
        },
      },

      {
        type: "evaluate",
        fn: () => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(true);
            }, 1000);
          });
        },
      },
    ],
  }).catch(async (error) => {
    await logger.critical("Automation stopped unexpectedly", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });
}

main();