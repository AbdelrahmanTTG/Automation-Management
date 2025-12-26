import pm2client from "../pm2-client.mjs";
import fsp from "node:fs/promises";
import path from "node:path";

const LOG_DIR = process.env.WATCHDOG_LOG_DIR || path.resolve("./logs");
const LOG_FILE = path.join(
  LOG_DIR,
  process.env.WATCHDOG_LOG_FILE || "pm2-watchdog.log"
);
const POLL_SECONDS = Number(process.env.WATCHDOG_POLL_SECONDS || 15);
const CPU_LIMIT = Number(process.env.WATCHDOG_CPU_LIMIT || 85);
const MEM_LIMIT_MB = Number(process.env.WATCHDOG_MEM_LIMIT_MB || 1024);
const COOLDOWN_SECONDS = Number(process.env.WATCHDOG_COOLDOWN_SECONDS || 60);
const MAX_INTERVENTIONS = Number(process.env.WATCHDOG_MAX_INTERVENTIONS || 5);
const INTERVENTION_WINDOW = Number(
  process.env.WATCHDOG_INTERVENTION_WINDOW || 300000
);
const EXCLUDE = (process.env.WATCHDOG_EXCLUDE || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nowIso = () => new Date().toISOString();

async function ensureLogDir() {
  try {
    await fsp.mkdir(LOG_DIR, { recursive: true });
  } catch (err) {
    console.error("[watchdog] mkdir error:", err);
  }
}

async function logEvent(event) {
  try {
    await ensureLogDir();
    const line = JSON.stringify(event) + "\n";
    await fsp.appendFile(LOG_FILE, line, { encoding: "utf8" });
    console.log("[watchdog]", line.trim());
  } catch (err) {
    console.error("[watchdog] log error:", err);
  }
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

let pm2Connected = false;

async function pm2Connect() {
  if (pm2Connected) return;

  await pm2client.connect();
  pm2Connected = true;
}

async function pm2List() {
  return pm2client.list();
}

async function pm2Reload(procName) {
  return pm2client.restartProcess(procName); 
}

async function pm2Restart(procName) {
  return pm2client.restartProcess(procName);
}

async function pm2Delete(procName) {
  return pm2client.deleteProcess(procName);
}

async function pm2SendSignalToName(signal, procName) {
  return pm2client.sendSignal(signal, procName);
}

async function pm2SendDataToProcessId(pm_id, data) {
  return pm2client.sendData(pm_id, data);
}

function getProcessLimits(proc) {
  const env = proc?.pm2_env?.env || {};
  const cpu = env.WATCHDOG_CPU_LIMIT
    ? Number(env.WATCHDOG_CPU_LIMIT)
    : CPU_LIMIT;
  const mem = env.WATCHDOG_MEM_LIMIT_MB
    ? Number(env.WATCHDOG_MEM_LIMIT_MB)
    : MEM_LIMIT_MB;
  return { cpu, memMb: mem };
}

function overLimits(proc) {
  const monit = proc?.monit || {};
  const cpu = Number(monit.cpu || 0);
  const memBytes = Number(monit.memory || 0);
  const memMb = memBytes / (1024 * 1024);

  const { cpu: cpuLimit, memMb: memLimit } = getProcessLimits(proc);

  return {
    cpu,
    memMb,
    cpuLimit,
    memLimit,
    isOver: cpu > cpuLimit || memMb > memLimit,
  };
}

function isExcluded(proc) {
  const name = proc?.name || "";
  return (
    EXCLUDE.includes(name) || name === "watchdog" || name === "pm2-watchdog"
  );
}

function isCluster(proc) {
  const mode = proc?.pm2_env?.exec_mode;
  return mode === "cluster" || mode === "cluster_mode";
}

const lastActions = new Map();
const interventionHistory = new Map();

function notInCooldown(name) {
  const last = lastActions.get(name) || 0;
  return Date.now() - last > COOLDOWN_SECONDS * 1000;
}

function setCooldown(name) {
  lastActions.set(name, Date.now());
}

function trackIntervention(name) {
  const now = Date.now();
  let history = interventionHistory.get(name) || [];

  history = history.filter((ts) => now - ts < INTERVENTION_WINDOW);
  history.push(now);

  interventionHistory.set(name, history);

  return history.length;
}

async function tryCacheCleanup(proc) {
  const name = proc.name;

  try {
    await pm2SendSignalToName("SIGUSR2", name);
  } catch (err) {
    await logEvent({
      ts: nowIso(),
      level: "warn",
      event: "signal_failed",
      process: name,
      error: String(err),
    });
  }

  try {
    await pm2SendDataToProcessId(proc.pm_id, { action: "clean-cache" });
  } catch (err) {
    await logEvent({
      ts: nowIso(),
      level: "warn",
      event: "ipc_failed",
      process: name,
      error: String(err),
    });
  }

  await sleep(2000);
}

async function intervene(proc, metrics) {
  const name = proc.name;
  setCooldown(name);

  const interventionCount = trackIntervention(name);

  await logEvent({
    ts: nowIso(),
    level: "info",
    event: "limit_exceeded",
    process: name,
    pm_id: proc.pm_id,
    cpu: metrics.cpu,
    cpu_limit: metrics.cpuLimit,
    mem_mb: Number(metrics.memMb.toFixed(1)),
    mem_limit_mb: metrics.memLimit,
    mode: proc?.pm2_env?.exec_mode,
    intervention_count: interventionCount,
  });

  if (interventionCount > MAX_INTERVENTIONS) {
    await logEvent({
      ts: nowIso(),
      level: "error",
      event: "max_interventions_exceeded",
      process: name,
      intervention_count: interventionCount,
    });

    try {
      await pm2Delete(name);
      await logEvent({
        ts: nowIso(),
        level: "info",
        event: "process_deleted",
        process: name,
      });
    } catch (err) {
      await logEvent({
        ts: nowIso(),
        level: "error",
        event: "delete_failed",
        process: name,
        error: String(err),
      });
    }

    return;
  }

  await tryCacheCleanup(proc);

  try {
    if (isCluster(proc)) {
      await pm2Reload(name);
      await logEvent({
        ts: nowIso(),
        level: "info",
        event: "reloaded",
        process: name,
      });
    } else {
      await pm2Restart(name);
      await logEvent({
        ts: nowIso(),
        level: "info",
        event: "restarted",
        process: name,
      });
    }
  } catch (err) {
    await logEvent({
      ts: nowIso(),
      level: "error",
      event: "restart_failed",
      process: name,
      error: String(err),
    });
  }
}

async function pollOnce() {
  const list = await pm2List();

  for (const proc of list) {
    try {
      if (isExcluded(proc)) continue;

      const note = proc?.pm2_env?.note || "";
      if (note === "stopped-by-user") {
        continue;
      }

      const metrics = overLimits(proc);
      if (metrics.isOver && notInCooldown(proc.name)) {
        await intervene(proc, metrics);
      }
    } catch (err) {
      await logEvent({
        ts: nowIso(),
        level: "error",
        event: "proc_check_error",
        process: proc?.name,
        error: String(err),
      });
    }
  }
}

async function startWatchdog() {
  try {
    await pm2Connect();
    await logEvent({
      ts: nowIso(),
      level: "info",
      event: "watchdog_started",
      poll_seconds: POLL_SECONDS,
      cpu_limit: CPU_LIMIT,
      mem_limit_mb: MEM_LIMIT_MB,
      cooldown_seconds: COOLDOWN_SECONDS,
      max_interventions: MAX_INTERVENTIONS,
      intervention_window_ms: INTERVENTION_WINDOW,
      exclude: EXCLUDE,
    });

    await sleep(3000);

    while (true) {
      try {
        await pollOnce();
      } catch (err) {
        await logEvent({
          ts: nowIso(),
          level: "error",
          event: "poll_error",
          error: String(err),
        });
      }
      await sleep(POLL_SECONDS * 1000);
    }
  } catch (err) {
    await logEvent({
      ts: nowIso(),
      level: "fatal",
      event: "startup_failed",
      error: String(err),
    });
    process.exit(1);
  }
}

startWatchdog();

export { startWatchdog };
