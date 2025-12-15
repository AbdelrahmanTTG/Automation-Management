import flexibleBoot from "./boot.js";
import nodemailer from "nodemailer";

const inputData = process.argv[2];
if (!inputData) {
  process.exit(1);
}

const input = JSON.parse(inputData);

const {
  setup: {
    account,
    password,
    notification,
    interval = 10,
    rules: matchRules = [],
  },
} = input;

const transporter = nodemailer.createTransport({
  host: "email-smtp.us-west-2.amazonaws.com",
  port: 587,
  secure: false,
  auth: {
    user: "AKIAXQIKSTQD33FA3NN5",
    pass: "BORbufsUbJFbEoscQcbug92IKgwpK/UdzBMkcwpq0xX6",
  },
});

async function sendEmail(rowData) {
  try {
    const mailOptions = {
      from: "no.reply@thetranslationgate.com",
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
    return true;
  } catch (error) {
    return false;
  }
}

async function checkSessionExpired(page) {
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

const reLoginSteps = [
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

flexibleBoot({
  url: "https://vu.propio-ls.com/a/Propio/Access/Login.aspx",
  headless: false,
  maxRetries: 5,
  loginStepsCount: 5,
  processingStepsCount: 13,
  waitBetweenCycles: true,
  runOnce: false,
  reloadOnError: true,
  reloadUrl:
    "https://vu.propio-ls.com/a/propio/Jobs/FindJobs.aspx?x=&q1=preset&v1=open",
  browserConfig: {
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  },
  stepData: {
    matchRules,
    intervalMin:   2000,
    intervalMax:   5000,
    sendEmail,
    checkSessionExpired,
    reLoginSteps,
    account,
    password,
    collectedLinks: [],
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
        const headers = headerCells.map((cell) =>
          cell.getAttribute("data-field")
        );

        const data = rows.map((row, rowIndex) => {
          const cells = Array.from(row.cells);
          const rowData = Object.fromEntries(
            cells.map((cell, i) => {
              const dataField = cell.getAttribute("data-field");
              const header = dataField || headers[i] || `col_${i}`;
              return [header, cell.innerText.trim()];
            })
          );

          return rowData;
        });

        const links = rows.map((row) => {
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
      onResult: async (result, stepData) => {
        const { headers, data, links } = result;

        if (!data || data.length === 0) {
          stepData.collectedLinks = [];
          return;
        }

        function matchValue(cellValue, expected) {
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

        function rowMatchesRules(row, rules) {
          if (!rules || rules.length === 0) {
            return true;
          }

          return rules.some((rule, ruleIndex) => {
            const allConditionsMatch = Object.entries(rule).every(
              ([key, expected]) => {
                if (!(key in row)) {
                  return false;
                }

                const cellValue = row[key];
                let matched = false;

                if (Array.isArray(expected)) {
                  matched = expected.some((exp) => matchValue(cellValue, exp));
                } else {
                  matched = matchValue(cellValue, expected);
                }

                return matched;
              }
            );

            return allConditionsMatch;
          });
        }

        const matchedLinks = [];

        data.forEach((row, index) => {
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
      fn: async (page, stepData) => {
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
              );

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
              );

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

  onError: async (error, page, stepData) => {
    const sessionExpired = await stepData.checkSessionExpired(page);

    if (sessionExpired) {
      try {
        for (const step of stepData.reLoginSteps) {
          if (step.type === "goto") {
            await page.goto(step.url);
          } else if (step.type === "waitForLoadState") {
            await page.waitForLoadState(step.state);
          } else if (step.type === "click") {
            await page.click(step.selector);
          } else if (step.type === "type") {
            await page.fill(step.selector, step.value);
          } else if (step.type === "evaluate") {
            await page.evaluate(step.fn);
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        return true;
      } catch (reLoginError) {
        return false;
      }
    }

    return false;
  },
});
