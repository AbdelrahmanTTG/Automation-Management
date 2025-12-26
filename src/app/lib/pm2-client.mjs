import pm2 from "pm2";
import path from "path";
import fs from "fs";

const SCRIPTS_DIR = path.resolve(process.cwd(), "src", "app", "scripts");
const DEFAULT_MAX_MEMORY_MB = Number(process.env.ALLOWED_MAX_MEMORY_MB || 2048);

function now() {
  return new Date().toISOString();
}

function toMb(memStr) {
  if (typeof memStr === "number") return Math.floor(memStr / (1024 * 1024));
  if (typeof memStr !== "string") return null;
  const s = memStr.trim().toUpperCase();
  if (s.endsWith("G")) return Math.floor(parseFloat(s.slice(0, -1)) * 1024);
  if (s.endsWith("M")) return Math.floor(parseFloat(s.slice(0, -1)));
  const n = Number(s);
  if (!isNaN(n)) return Math.floor(n / (1024 * 1024));
  return null;
}

function ensureConnected() {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export async function connect() {
  await ensureConnected();
}

export function disconnect() {
  try {
    pm2.disconnect();
  } catch (err) {
    /* ignore */
  }
}

export function list() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("PM2 list timeout")),
      5000
    );
    pm2.list((err, list) => {
      clearTimeout(timeout);
      if (err) return reject(err);
      resolve(list || []);
    });
  });
}

export function describe(name) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("PM2 describe timeout")),
      5000
    );
    pm2.describe(name, (err, desc) => {
      clearTimeout(timeout);
      if (err) return reject(err);
      resolve((desc || [])[0] || null);
    });
  });
}

export function dump() {
  return new Promise((resolve) => {
    pm2.dump((err) => {
      if (err) console.error("[pm2-client] dump failed", err);
      resolve();
    });
  });
}

export function launchBus() {
  return new Promise((resolve, reject) => {
    pm2.launchBus((err, bus) => {
      if (err) return reject(err);
      resolve(bus);
    });
  });
}

async function validateScriptPath(scriptPath, allowInternal = false) {
  const resolved = path.resolve(scriptPath);
  if (!allowInternal && !resolved.startsWith(SCRIPTS_DIR)) {
    throw new Error("Script path outside allowed scripts directory");
  }
  try {
    const st = await fs.promises.stat(resolved);
    if (!st.isFile()) throw new Error("Script not found");
  } catch (e) {
    throw new Error("Script not found");
  }
  return resolved;
}

export async function startProcess(opts) {
  if (!opts || !opts.name || !opts.script)
    throw new Error("Missing name or script");

  const scriptAbs = await validateScriptPath(
    opts.script,
    Boolean(opts.internal)
  );

  const maxMemMb =
    toMb(
      opts.max_memory_restart || process.env.AUTOMATION_MAX_MEMORY || "1024M"
    ) || DEFAULT_MAX_MEMORY_MB;
  if (maxMemMb > DEFAULT_MAX_MEMORY_MB) {
    throw new Error("Requested memory exceeds allowed maximum");
  }

  const startOpts = Object.assign({}, opts, {
    script: scriptAbs,
    max_memory_restart: `${maxMemMb}M`,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("PM2 start timeout")),
      30000
    );
    pm2.start(startOpts, (err, proc) => {
      clearTimeout(timeout);
      if (err) return reject(err);
      resolve(proc);
    });
  });
}

export function restartProcess(name) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("PM2 restart timeout")),
      30000
    );
    pm2.restart(name, (err) => {
      clearTimeout(timeout);
      if (err) return reject(err);
      resolve();
    });
  });
}

export function stopProcess(name) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("PM2 stop timeout")),
      30000
    );
    pm2.stop(name, (err) => {
      clearTimeout(timeout);
      if (err) return reject(err);
      resolve();
    });
  });
}

export function deleteProcess(name) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("PM2 delete timeout")),
      10000
    );
    pm2.delete(name, (err) => {
      clearTimeout(timeout);
      if (err) return reject(err);
      resolve();
    });
  });
}

export function setProcessEnv(name, key, value) {
  return new Promise((resolve, reject) => {
    pm2.describe(name, (err, desc) => {
      if (err) return reject(err);
      const proc = (desc || [])[0];
      if (!proc) return reject(new Error("Process not found"));
      const env = Object.assign(
        {},
        proc.pm2_env?.env || {},
        proc.pm2_env || {}
      );
      env[key] = value;

      pm2.restart(name, { env }, (restartErr) => {
        if (restartErr) return reject(restartErr);
        resolve();
      });
    });
  });
}

export function sendSignal(signal, name) {
  return new Promise((resolve) => {
    pm2.sendSignalToProcessName(signal, name, () => resolve());
  });
}

export function sendData(pm_id, data) {
  const packet = { type: "process:msg", data, topic: "watchdog" };
  return new Promise((resolve) => {
    pm2.sendDataToProcessId(pm_id, packet, () => resolve());
  });
}

export default {
  connect,
  disconnect,
  list,
  describe,
  dump,
  launchBus,
  startProcess,
  restartProcess,
  stopProcess,
  deleteProcess,
  setProcessEnv,
  sendSignal,
  sendData,
};
