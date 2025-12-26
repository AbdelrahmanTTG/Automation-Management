#!/usr/bin/env node
const { ensureWatchdogRunning } = require("../src/app/lib/pm2-ops");

(async () => {
  try {
    await ensureWatchdogRunning();
    console.log("pm2-watchdog ensured");
  } catch (err) {
    console.error("Failed to ensure pm2-watchdog:", err);
    process.exit(1);
  }
})();
