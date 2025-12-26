import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";

const pm2client = await import("../../src/app/lib/pm2-client.mjs");
const LOG_DIR = path.resolve(process.cwd(), "logs");
const WATCHDOG_LOG = path.join(LOG_DIR, "pm2-watchdog.log");
const AUTO_LOG = path.join(LOG_DIR, "automation.log");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function readLogFile(file) {
  try {
    const txt = await fs.readFile(file, "utf8");
    return txt;
  } catch (e) {
    return "";
  }
}

async function clearLogs() {
  try {
    await fs.writeFile(WATCHDOG_LOG, "", "utf8");
  } catch (e) {}
  try {
    await fs.writeFile(AUTO_LOG, "", "utf8");
  } catch (e) {}
}

async function ensureWatchdog() {
  await pm2client.connect();
  const list = await pm2client.list();
  if ((list || []).some((p) => p.name === "pm2-watchdog")) {
    try {
      await pm2client.deleteProcess("pm2-watchdog");
    } catch (e) {}
    await sleep(500);
  }

  const script = path.resolve(
    process.cwd(),
    "src",
    "app",
    "lib",
    "monitor",
    "pm2-watchdog.mjs"
  );

  await pm2client.startProcess({
    name: "pm2-watchdog",
    script,
    exec_mode: "fork",
    instances: 1,
    autorestart: true,
    internal: true,
    env: {
      WATCHDOG_POLL_SECONDS: "3",
      WATCHDOG_CPU_LIMIT: "10",
      WATCHDOG_MEM_LIMIT_MB: "20",
      WATCHDOG_COOLDOWN_SECONDS: "1",
      WATCHDOG_MAX_INTERVENTIONS: "3",
      NODE_ENV: "test",
    },
  });

  await sleep(4000);
}

async function cleanupProcess(name) {
  try {
    await pm2client.deleteProcess(name);
  } catch (e) {}
}

async function waitForRestart(name, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const desc = await pm2client.describe(name);
    const restarts = desc?.pm2_env?.restart_time || 0;
    if (restarts && restarts > 0) return true;
    await sleep(1000);
  }
  return false;
}

async function waitForWatchdogLogContains(substr, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const txt = await readLogFile(WATCHDOG_LOG);
    if (txt.includes(substr)) return true;
    await sleep(500);
  }
  return false;
}

async function waitForAutoLogContains(substr, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const txt = await readLogFile(AUTO_LOG);
    if (txt.includes(substr)) return true;
    await sleep(500);
  }
  return false;
}

let connected = false;

try {
  await pm2client.connect();
  connected = true;
} catch (err) {
  console.error("Failed to connect to pm2 in test setup", err);
}

await clearLogs();
await ensureWatchdog();

{
  const name = `it-crash-${Date.now()}`;
  const script = path.resolve(
    process.cwd(),
    "src",
    "app",
    "scripts",
    "test-crash.js"
  );

  await pm2client.startProcess({
    name,
    script,
    args: [],
    env: { NODE_ENV: "test" },
  });

  const restarted = await waitForRestart(name, 30000);
  assert(restarted, "Expected process to be restarted after crash");

  const found = await waitForAutoLogContains("unexpected_exit");
  assert(found, "Expected unexpected_exit to be logged");

  await cleanupProcess(name);
}

{
  const name = `it-mem-${Date.now()}`;
  const script = path.resolve(
    process.cwd(),
    "src",
    "app",
    "scripts",
    "test-memory.js"
  );

  await pm2client.startProcess({
    name,
    script,
    args: [],
    max_memory_restart: "1024M",
    env: { NODE_ENV: "test" },
  });

  const limitEventFound = await waitForWatchdogLogContains(
    "limit_exceeded",
    45000
  );
  assert(limitEventFound, "Expected watchdog to log limit_exceeded for memory");

  const restarted = await waitForWatchdogLogContains("restarted", 45000);
  assert(restarted, "Expected watchdog to restart the memory-leaking process");

  await cleanupProcess(name);
}

{
  const name = `it-cpu-${Date.now()}`;
  const script = path.resolve(
    process.cwd(),
    "src",
    "app",
    "scripts",
    "test-cpu.js"
  );

  await pm2client.startProcess({
    name,
    script,
    args: [],
    env: { NODE_ENV: "test" },
  });

  const desc = await pm2client.describe(name);
  if (desc && desc.pm_id) {
    await pm2client.sendData(desc.pm_id, { action: "start-cpu" });
  }

  const limitEventFound = await waitForWatchdogLogContains(
    "limit_exceeded",
    45000
  );
  assert(limitEventFound, "Expected watchdog to log limit_exceeded for CPU");

  const restarted = await waitForWatchdogLogContains("restarted", 45000);
  assert(restarted, "Expected watchdog to restart the CPU-hungry process");

  await cleanupProcess(name);
}

{
  const name = `it-stop-${Date.now()}`;
  const script = path.resolve(
    process.cwd(),
    "src",
    "app",
    "scripts",
    "test-stub.js"
  );

  await pm2client.startProcess({
    name,
    script,
    args: [],
    env: { NODE_ENV: "test" },
  });

  await pm2client.setProcessEnv(name, "note", "stopped-by-user");
  await pm2client.stopProcess(name);

  await sleep(3000);

  const txt = await readLogFile(AUTO_LOG);
  assert(
    !txt.includes("unexpected_exit") || !txt.includes(name),
    "Did not expect unexpected_exit for user-stopped process"
  );

  await cleanupProcess(name);
}

if (connected) {
  try {
    pm2client.disconnect();
  } catch (e) {}
}
