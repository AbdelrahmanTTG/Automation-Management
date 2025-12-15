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
      subject: "New Matching Task Found",
      html: `
        <h2>Finding a matching task</h2>
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

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    return false;
  }
}

flexibleBoot({
  url: "https://junction.welocalize.com/auth/start",
  headless: false,
  maxRetries: 5,

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
    intervalMin:   2000,
    intervalMax:   5000,
    sendEmail,
  },

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
        const rows = Array.from(document.querySelectorAll("table tr"));
        if (!rows.length) return { headers: [], data: [], matchIndex: -1 };

        const headers = Array.from(rows[0].cells).map((cell) =>
          cell.innerText.trim()
        );

        const data = rows
          .slice(1)
          .map((row) =>
            Object.fromEntries(
              Array.from(row.cells).map((cell, i) => [
                headers[i],
                cell.innerText.trim(),
              ])
            )
          );

        return { headers, data };
      },
      onResult: async (result, stepData) => {
        const { headers, data } = result;

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
              const regex = new RegExp(pattern);
              return regex.test(cellStr);
            } catch (e) {
              return false;
            }
          }

          return false;
        }

        function rowMatchesRules(row, rules) {
          if (!rules || rules.length === 0) return true;

          return rules.some((rule) => {
            return Object.entries(rule).every(([key, expected]) => {
              if (!(key in row)) return false;
              const cellValue = row[key];

              if (Array.isArray(expected)) {
                return expected.some((exp) => matchValue(cellValue, exp));
              }

              return matchValue(cellValue, expected);
            });
          });
        }

        const matchIndex = data.findIndex((row) =>
          rowMatchesRules(row, stepData.matchRules || [])
        );

        if (matchIndex !== -1) {
          stepData.matchedRowIndex = matchIndex + 1;
          stepData.matchedRowData = data[matchIndex];
        } else {
          stepData.matchedRowIndex = -1;
        }
      },
    },

    {
      type: "evaluate",
      fn: (matchedRowIndex) => {
        if (matchedRowIndex === -1) return false;

        const rows = document.querySelectorAll("table tr");
        const targetRow = rows[matchedRowIndex];
        if (!targetRow) return false;

        const lastCell = targetRow.cells[targetRow.cells.length - 1];
        const clickable =
          lastCell.querySelector("button") ||
          lastCell.querySelector("a") ||
          lastCell;

        clickable.click();
        return true;
      },
      args: (stepData) => stepData.matchedRowIndex,
      onResult: (clicked, stepData) => {
        if (!clicked) {
          stepData.skipRemaining = true;
        }
      },
    },

    { type: "waitFor", selector: ".bar-content", timeout: 10000 },
    { type: "click", selector: ".btn.blue.bulk-accept-btn" },

    {
      type: "evaluate",
      fn: async (rowData, sendEmailFn) => {
        if (!rowData) return false;
        return true;
      },
      args: (stepData) => stepData.matchedRowData,
      onResult: async (success, stepData) => {
        if (success && stepData.matchedRowData) {
          await stepData.sendEmail(stepData.matchedRowData);
        }
      },
    },
  ],
});
