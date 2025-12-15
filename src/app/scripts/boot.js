import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logFilePath = path.join(__dirname, "log.txt");

function writeLog(message) {
  const timestamp = `[${new Date().toISOString()}] ${message}\n`;
  try {
    const stream = fs.createWriteStream(logFilePath, { flags: "a" });
    stream.on("error", (err) =>
      console.error(`Failed to write log: ${err.message}`)
    );
    stream.write(timestamp, () => stream.end());
    console.log(timestamp.trim());
  } catch (err) {
    console.error(`Failed to write to log file: ${err.message}`);
  }
}

export default async function flexible_boot(config) {
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
    onError,
  } = config;

  let stepData = { ...initialStepData };
  const OFFERS_URL = reloadUrl;

  process.on("uncaughtException", (err) => {
    writeLog(`Uncaught Exception (handled): ${err.message}`);
    writeLog("Continuing execution...");
  });

  const actionHandlers = {
    click: async (page, step) => {
      await page.waitForSelector(step.selector, {
        state: "visible",
        timeout: step.timeout || 10000,
      });
      await page.click(step.selector);
    },
    type: async (page, step) => {
      await page.waitForSelector(step.selector, {
        state: "visible",
        timeout: step.timeout || 10000,
      });
      await page.fill(step.selector, step.value);
    },
    waitFor: async (page, step) =>
      await page.waitForSelector(step.selector, {
        state: "visible",
        timeout: step.timeout || 10000,
      }),
    wait: async (page, step) =>
      await new Promise((res) => setTimeout(res, step.time)),
    goto: async (page, step) => {
      const rawUrl =
        typeof step.url === "function" ? step.url(stepData) : step.url;
      if (!rawUrl || typeof rawUrl !== "string") return;
      await page.goto(rawUrl, {
        waitUntil: "domcontentloaded",
        timeout: step.timeout || 60000,
      });
    },
    screenshot: async (page, step) =>
      await page.screenshot({ path: step.path || "screenshot.png" }),
    evaluate: async (page, step) => {
      if (typeof step.fn !== "function")
        throw new Error("Missing 'fn' in evaluate step.");

      let args = step.args;
      if (typeof args === "function") {
        args = args(stepData);
      }

      const result = await page.evaluate(step.fn, args);
      if (typeof step.onResult === "function")
        await step.onResult(result, stepData);
      return result;
    },

    custom: async (page, step) => {
      if (typeof step.fn !== "function") {
        throw new Error("Missing 'fn' in custom step.");
      }

      const result = await step.fn(page, stepData);
      if (typeof step.onResult === "function") {
        await step.onResult(result, stepData);
      }

      return result;
    },

    evaluateWithPage: async (page, step) => {
      if (typeof step.fn !== "function") {
        throw new Error("Missing 'fn' in evaluateWithPage step.");
      }

      const result = await step.fn(page);
      if (typeof step.onResult === "function") {
        await step.onResult(result, page);
      }

      return result;
    },
    keyboardPress: async (page, step) => await page.keyboard.press(step.key),
    waitNavigation: async (page, step) => {
      await page.waitForNavigation({
        waitUntil: "load",
        timeout: step.timeout || 30000,
      });
    },
    waitForLoadState: async (page, step) => {
      await page.waitForLoadState(step.state || "networkidle");
    },

    checkUntilVisible: async (page, step) => {
      const { selector, intervalMin = 1000, intervalMax = 3000, stopIf } = step;
      let attempt = 1;
      while (true) {
        try {
          writeLog("Starting processing cycle...");

          await processData(page);

          writeLog("Processing cycle completed successfully.");

          if (
            waitBetweenCycles &&
            stepData.intervalMin &&
            stepData.intervalMax
          ) {
            const waitTime =
              Math.floor(
                Math.random() *
                  (stepData.intervalMax - stepData.intervalMin + 1)
              ) + stepData.intervalMin;
            writeLog(`Waiting ${waitTime}ms before next cycle...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          } else {
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        } catch (err) {
          writeLog(`Error in processing cycle: ${err.message}`);

          if (reloadOnError) {
            try {
              const urlToReload =
                reloadUrl || (typeof url === "function" ? url(stepData) : url);
              writeLog(`Reloading page: ${urlToReload}...`);
              await page.goto(urlToReload, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
              });
              await new Promise((resolve) => setTimeout(resolve, 3000));
            } catch (reloadErr) {
              writeLog(`Error reloading page: ${reloadErr.message}`);

              writeLog("Restarting browser session...");
              await browser.close().catch(() => {});

              const newSetup = await runInitialSetup();
              if (!newSetup.success) {
                writeLog("Failed to restart session. Waiting before retry...");
                await new Promise((resolve) => setTimeout(resolve, 10000));
                continue;
              }

              ({ browser, context, page } = newSetup);
            }
          } else {
            writeLog("Error handling disabled. Continuing...");
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }
      }
    },
  };

  async function returnToOffersWithoutReload(page) {
    try {
      writeLog(`Navigating to offers page (without reload): ${OFFERS_URL}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      writeLog(`Ready for next cycle`);
    } catch (err) {
      writeLog(`Error in navigation preparation: ${err.message}`);
    }
  }

  async function returnToOffersWithReload(page) {
    try {
      writeLog(`Reloading offers page due to error: ${OFFERS_URL}`);
      await page.goto(OFFERS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await new Promise((resolve) => setTimeout(resolve, 3000));
      writeLog(`Successfully reloaded offers page`);
    } catch (err) {
      writeLog(`Failed to reload offers page: ${err.message}`);
      throw err;
    }
  }

  async function initializeBrowser() {
    const defaultBrowserConfig = {
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

    await context.clearCookies();

    const page = await context.newPage();

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });

    return { browser, context, page };
  }

  async function executeSteps(page, stepsToExecute, stepPrefix = "") {
    for (const [index, step] of stepsToExecute.entries()) {
      if (stepData.skipRemaining) {
        writeLog(`Skipping remaining steps (skipRemaining flag set)`);
        stepData.skipRemaining = false;
        break;
      }

      const handler = actionHandlers[step.type];
      if (handler) {
        writeLog(
          `${stepPrefix}step ${index + 1}: ${step.type} ${
            step.selector || step.url || ""
          }`
        );
        try {
          await handler(page, step);
        } catch (stepErr) {
          writeLog(
            `Error in ${stepPrefix}step ${step.type}: ${stepErr.message}`
          );

          if (
            stepErr.message.includes(
              "Target page, context or browser has been closed"
            )
          ) {
            writeLog("Session invalidated. Will restart session...");
            throw stepErr;
          }

          await returnToOffersWithReload(page);
          throw stepErr;
        }
      } else {
        writeLog(`Unknown step type: ${step.type}`);
      }
    }
  }

  async function performLogin(browser, context, page) {
    if (loginStepsCount <= 0) {
      writeLog("No login steps specified, skipping login.");
      return;
    }

    const loginSteps = steps.slice(0, loginStepsCount);
    await executeSteps(page, loginSteps, "Login ");
    writeLog("Login completed successfully");
  }

  async function processData(page) {
    if (processingStepsCount <= 0) {
      writeLog("No processing steps specified, skipping data processing.");
      return;
    }

    const processingSteps = steps.slice(-processingStepsCount);

    try {
      await executeSteps(page, processingSteps, "Processing ");
      writeLog("Data processing completed successfully");

      writeLog("Processing successful, ready for next cycle...");
      await returnToOffersWithoutReload(page);
    } catch (err) {
      writeLog(`Error in data processing: ${err.message}`);
      await returnToOffersWithReload(page);
      throw err;
    }
  }

  async function runInitialSetup(attempt = 1) {
    let { browser, context, page } = await initializeBrowser();
    try {
      const initialUrl = typeof url === "function" ? url(stepData) : url;
      await page.goto(initialUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await performLogin(browser, context, page);

      return { browser, context, page, success: true };
    } catch (err) {
      writeLog(`Failed setup attempt ${attempt}: ${err.message}`);
      await browser.close().catch(() => {});
      if (attempt < maxRetries) {
        const waitTime = Math.min(5000 * attempt, 30000);
        writeLog(`Waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return runInitialSetup(attempt + 1);
      } else {
        writeLog(`Max setup retries reached for attempt ${attempt}.`);
        return { success: false };
      }
    }
  }

  writeLog("flexibleBoot function was called.");
  writeLog("Boot script started successfully...");

  while (true) {
    const setupResult = await runInitialSetup();
    if (!setupResult.success) {
      writeLog("Failed to complete initial setup. Retrying in 30 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 30000));
      continue;
    }

    let { browser, context, page } = setupResult;

    if (runOnce) {
      try {
        await processData(page);
        writeLog("Single run completed successfully.");
      } catch (err) {
        writeLog(`Error in single run: ${err.message}`);
        await returnToOffersWithReload(page);
      }
      await browser.close();

      writeLog("Single run completed. Restarting in 60 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 60000));
      continue;
    }

    while (true) {
      try {
        writeLog("Starting processing cycle...");

        await processData(page);

        writeLog("Processing cycle completed successfully.");

        if (waitBetweenCycles && stepData.intervalMin && stepData.intervalMax) {
          const waitTime =
            Math.floor(
              Math.random() * (stepData.intervalMax - stepData.intervalMin + 1)
            ) + stepData.intervalMin;
          writeLog(`Waiting ${waitTime}ms before next cycle...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      } catch (err) {
        writeLog(`Error in processing cycle: ${err.message}`);

        if (onError) {
          const handled = await onError(err, page, stepData);
          if (handled) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            continue;
          }
        }

        try {
          await returnToOffersWithReload(page);
          await new Promise((resolve) => setTimeout(resolve, 3000));
          continue;
        } catch (returnErr) {
          writeLog(`Failed to reload page: ${returnErr.message}`);

          writeLog("Restarting browser session...");
          await browser.close().catch(() => {});
          break;
        }
      }
    }
  }
}
