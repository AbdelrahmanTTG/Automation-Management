import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import nodemailer from "nodemailer";
import axios from "axios";

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
  backendUrl?: string;
  onTaskAccepted?: (data: any) => Promise<void>;
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
    console.log(JSON.stringify(logEntry));
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

  logger.info("Flexible boot initialized");
  logger.info("Boot script started");

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
  let user: any;
  try {
    const userArg = process.argv[2];

    if (userArg) {
      let cleanedArg = userArg;
      
      try {
        user = JSON.parse(userArg);
      } catch (initialError) {
        if (cleanedArg.startsWith("'") && cleanedArg.endsWith("'")) {
            cleanedArg = cleanedArg.slice(1, -1);
        }
        
        cleanedArg = cleanedArg.replace(/'/g, '"');

        cleanedArg = cleanedArg.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
        
        user = JSON.parse(cleanedArg);
      }
    } else {
      console.warn("No command line argument found for user data.");
      user = {}; 
    }
  } catch (e: any) {
    console.error("FATAL ERROR: Failed to parse argument as JSON or clean string:", e.message);
    console.error("Failing String:", process.argv[2]);
    process.exit(1);
  }
  
  user = user || {};
  user.setup = user.setup || {};

  const { name, id } = user;
  const {
    account,
    password,
    notification,
    backendUrl,
    intervalMin = user.setup.interval || 2000, 
    intervalMax = user.setup.interval || 5000, 
    matchRules = user.setup.rules || [], 
  } = user.setup;


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
    scriptName: `welocalize_${name || 'default'}_${id || 'default'}`, 
    notificationEmail: notification,
  };

  const logger = new Logger(loggerConfig, emailConfig);

  const transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: emailConfig.auth,
  });

  async function sendTaskAcceptedEmail(rowData: any): Promise<boolean> {
    if (!notification) {
      logger.warn("Notification email not configured, skipping email notification");
      return false;
    }
    try {
      const mailOptions = {
        from: emailConfig.from,
        to: notification,
        subject: "Task Accepted Successfully",
        html: `
          <h2>Task Accepted Notification</h2>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Account:</strong> ${account}</p>
          <table border="1" cellpadding="5" cellspacing="0">
            ${Object.entries(rowData)
              .map(
                ([key, value]) =>
                  `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`
              )
              .join("")}
          </table>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      logger.success("Task acceptance email sent", {
        messageId: info.messageId,
        recipient: notification,
      });
      return true;
    } catch (error: any) {
      logger.error("Failed to send task acceptance email", {
        error: error.message,
      });
      return false;
    }
  }

  async function notifyBackend(taskData: any): Promise<boolean> {
    if (!backendUrl) {
      logger.warn("Backend URL not configured, skipping backend notification");
      return false;
    }

    try {
      const response = await axios.post(
        `${backendUrl}/api/tasks/accepted`,
        {
          timestamp: new Date().toISOString(),
          taskData,
          account,
          userId: id,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      logger.success("Backend notified of task acceptance", {
        status: response.status,
        taskData,
      });
      return true;
    } catch (error: any) {
      logger.error("Failed to notify backend", {
        error: error.message,
        url: backendUrl,
      });
      return false;
    }
  }

  async function handleTaskAcceptance(rowData: any): Promise<void> {
    logger.info("Processing task acceptance", { taskData: rowData });

    await Promise.all([
      sendTaskAcceptedEmail(rowData),
      notifyBackend(rowData),
    ]);

    logger.success("Task acceptance processing completed");
  }

  logger.info("Starting automation script", {
    account,
    userId: id,
    userName: name,
    intervalMin,
    intervalMax,
    matchRulesCount: matchRules.length,
  });
  
  await flexibleBoot({
    url: "https://junction.welocalize.com/auth/start",
    headless: false,
    maxRetries: 5,
    logger,
    backendUrl,

    loginStepsCount: 12,
    processingStepsCount: 6,

    waitBetweenCycles: true,
    runOnce: false,
    reloadOnError: true,
    reloadUrl: "https://junction.welocalize.com/vendor-portal/offers/2",

    browserConfig: {
      executablePath:
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    },

    stepData: {
      matchRules,
      intervalMin, 
      intervalMax,
    },

    onTaskAccepted: handleTaskAcceptance,

    steps: [
      { type: "waitFor", selector: 'input[type="submit"]' },
      { type: "click", selector: 'input[type="submit"]' },
      { type: "waitNavigation" },
      { type: "waitFor", selector: 'label[for="input36"]' },
      { type: "click", selector: 'label[for="input36"]' },
      { type: "type", selector: "#input28", value: account },
      { type: "click", selector: 'input[type="submit"]' },
      { type: "waitFor", selector: "#input60" },
      { type: "type", selector: "#input60", value: password },
      { type: "click", selector: 'input[type="submit"]' },
      { type: "waitNavigation" },
      {
        type: "goto",
        url: "https://junction.welocalize.com/vendor-portal/offers/2",
      },

      { type: "waitFor", selector: "table tr td", timeout: 10000 },
      {
        type: "evaluate",
        fn: () => {
          const rows = Array.from(
            document.querySelectorAll("table tr")
          ) as HTMLTableRowElement[];
          if (!rows.length) return { headers: [], data: [], matchIndex: -1 };

          const headerRow = rows[0];
          const headers = Array.from(headerRow.cells).map(
            (cell: HTMLTableCellElement) => cell.innerText.trim()
          );

          const data = rows.slice(1).map((row: HTMLTableRowElement) =>
            Object.fromEntries(
              Array.from(row.cells).map(
                (cell: HTMLTableCellElement, i: number) => [
                  headers[i],
                  cell.innerText.trim(),
                ]
              )
            )
          );

          return { headers, data };
        },
        onResult: async (result: any, stepData: any) => {
          const { headers, data } = result;

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
                const regex = new RegExp(pattern);
                return regex.test(cellStr);
              } catch (e) {
                logger.warn("Invalid regex pattern", { pattern: expectedStr });
                return false;
              }
            }

            return false;
          }

          function rowMatchesRules(row: any, rules: any[]): boolean {
            if (!rules || rules.length === 0) return true;

            return rules.some((rule: any) => {
              return Object.entries(rule).every(([key, expected]) => {
                if (!(key in row)) return false;
                const cellValue = row[key];

                if (Array.isArray(expected)) {
                  return expected.some((exp: any) =>
                    matchValue(cellValue, exp)
                  );
                }

                return matchValue(cellValue, expected as string);
              });
            });
          }

          const matchIndex = data.findIndex((row: any) =>
            rowMatchesRules(row, stepData.matchRules || [])
          );

          if (matchIndex !== -1) {
            logger.success("Found matching row", {
              index: matchIndex,
              rowData: data[matchIndex],
            });
            stepData.matchedRowIndex = matchIndex + 1;
            stepData.matchedRowData = data[matchIndex];
          } else {
            logger.info("No matching rows found");
            stepData.matchedRowIndex = -1;
          }
        },
      },

      {
        type: "evaluate",
        fn: (matchedRowIndex: number) => {
          if (matchedRowIndex === -1) return false;

          const rows = document.querySelectorAll("table tr");
          const targetRow = rows[matchedRowIndex] as HTMLTableRowElement;
          if (!targetRow) return false;

          const lastCell = targetRow.cells[targetRow.cells.length - 1];
          const clickable =
            lastCell.querySelector("button") ||
            lastCell.querySelector("a") ||
            lastCell;

          (clickable as HTMLElement).click();
          return true;
        },
        args: (stepData: any) => stepData.matchedRowIndex,
        onResult: (clicked: boolean, stepData: any) => {
          if (!clicked) {
            logger.info("No row clicked", { reason: "No match found" });
            stepData.skipRemaining = true;
          } else {
            logger.success("Clicked matching row");
          }
        },
      },

      { type: "waitFor", selector: ".bar-content", timeout: 10000 },

      { type: "click", selector: ".btn.blue.bulk-accept-btn" },

      {
        type: "evaluate",
        fn: async (rowData: any) => {
          if (!rowData) return false;
          return true;
        },
        args: (stepData: any) => stepData.matchedRowData,
        onResult: async (success: boolean, stepData: any) => {
          if (success && stepData.matchedRowData) {
            await handleTaskAcceptance(stepData.matchedRowData);
          }
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
