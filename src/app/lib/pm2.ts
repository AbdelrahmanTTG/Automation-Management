import { EventEmitter } from 'events';
import pm2client from './pm2-client.mjs';
import { log } from './logger';
import os from 'os';
import { readFile } from 'fs/promises';

let pm2Connected = false;
let connectionPromise: Promise<void> | null = null;

const parseNum = (v: string | undefined, fallback: number) => {
  const n = v !== undefined ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const IGNORED = new Set(['next-app', 'pm2-watchdog']);
const ALLOWED = new Set(
  (process.env.PM2_ALLOWED_PROCESSES || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

const MAX_TRACKED_PROCESSES = Math.max(50, parseNum(process.env.PM2_MAX_TRACKED, 200));
const RING_SIZE = parseNum(process.env.PM2_RING_SIZE, 500);
const STAT_POLL_INTERVAL_MS = parseNum(process.env.PM2_STATS_INTERVAL_MS, 3000);
const MAX_SSE_CONNECTIONS = Math.max(10, parseNum(process.env.MAX_SSE_CONNECTIONS, 1000));

const emitters = new Map<string, EventEmitter>();
const ringBuffers = new Map<string, any[]>();
const ringOrder: string[] = [];

let busReady = false;
let busInitPromise: Promise<void> | null = null;

const allProcessesEmitter = new EventEmitter();
allProcessesEmitter.setMaxListeners(Math.max(50, parseNum(process.env.PM2_GLOBAL_MAX_LISTENERS, 200)));

let pollTimer: NodeJS.Timeout | null = null;
let subscriberCount = 0;
let latestStats: any[] | null = null;
let polling = false;
let lastPollAt = 0;
let immediatePollScheduled: NodeJS.Timeout | null = null;
const MIN_IMMEDIATE_POLL_GAP_MS = 500;

function startStatsPoller(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void pollStats('interval');
  }, STAT_POLL_INTERVAL_MS);
}

function stopStatsPollerIfIdle(): void {
  if (subscriberCount <= 0 && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollStats(reason: 'interval' | 'immediate' = 'interval'): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    latestStats = await getProcessesStats();
    lastPollAt = Date.now();
    try {
      allProcessesEmitter.emit('stats', latestStats);
    } catch (emitErr) {
      console.error('[PM2] Broadcast stats emit error:', emitErr);
    }
  } catch (err) {
    console.error(`[PM2] Poll stats error (${reason}):`, err);
  } finally {
    polling = false;
  }
}

function scheduleImmediatePoll(): void {
  const now = Date.now();
  if (now - lastPollAt < MIN_IMMEDIATE_POLL_GAP_MS) {
    if (immediatePollScheduled) return;
    immediatePollScheduled = setTimeout(() => {
      immediatePollScheduled = null;
      void pollStats('immediate');
    }, MIN_IMMEDIATE_POLL_GAP_MS);
    return;
  }
  void pollStats('immediate');
}

async function connectPM2(): Promise<void> {
  if (pm2Connected) return;
  if (connectionPromise) return connectionPromise;
  connectionPromise = (async () => {
    const timeoutMs = 10000;
    await Promise.race([
      (async () => {
        await pm2client.connect();
        pm2Connected = true;
      })(),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('PM2 connection timeout')), timeoutMs);
      }),
    ]);
  })().catch(err => {
    connectionPromise = null;
    throw err;
  });
  return connectionPromise;
}

async function ensureBus(): Promise<void> {
  if (busReady) return;
  if (busInitPromise) return busInitPromise;
  busInitPromise = (async () => {
    await connectPM2();
    await new Promise<void>(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('PM2 bus launch timeout'));
      }, 10000);
      try {
        const bus: any = await pm2client.launchBus();
        bus.on('log:out', (data: any) => handleLog(data, 'log'));
        bus.on('log:err', (data: any) => handleLog(data, 'error'));
        bus.on('process:event', (data: any) => handleEvent(data));
        busReady = true;
        clearTimeout(timeout);
        resolve();
      } catch (busErr) {
        busInitPromise = null;
        clearTimeout(timeout);
        reject(busErr);
      }
    });
  })();
  return busInitPromise;
}

function stripPm2Timestamp(s: string): string {
  const idx = s.indexOf(': ');
  return idx > 10 ? s.slice(idx + 2) : s;
}

function ensureTracked(name: string) {
  if (!ringBuffers.has(name)) {
    ringBuffers.set(name, []);
    ringOrder.push(name);
    if (ringOrder.length > MAX_TRACKED_PROCESSES) {
      const oldest = ringOrder.shift();
      if (oldest) {
        ringBuffers.delete(oldest);
        const em = emitters.get(oldest);
        if (em) {
          em.removeAllListeners();
          emitters.delete(oldest);
        }
      }
    }
  }
}

function publish(name: string, ev: any): void {
  if (!name) return;
  if (IGNORED.has(name)) return;
  if (ALLOWED.size > 0 && !ALLOWED.has(name)) return;

  const em = emitters.get(name);
  if (em) {
    try {
      em.emit('event', ev);
    } catch (err) {
      console.error('[PM2] Emit error:', err);
    }
  }

  ensureTracked(name);
  const buf = ringBuffers.get(name)!;
  buf.push(ev);
  if (buf.length > RING_SIZE) {
    buf.splice(0, buf.length - RING_SIZE);
  }

  try {
    allProcessesEmitter.emit('process-update', { name, event: ev });
  } catch (err) {
    console.error('[PM2] Global emit error:', err);
  }

  scheduleImmediatePoll();
}

function handleLog(data: any, type: 'log' | 'error'): void {
  const name = data?.process?.name;
  const pm_id = data?.process?.pm_id;
  const text = String(data?.data ?? '');
  if (!name) return;

  publish(name, {
    type,
    ts: Date.now(),
    pm_id,
    name,
    data: stripPm2Timestamp(text),
  });

  if (type === 'log') {
    const m = text.match(/(?:progress\s*[:=]\s*)(\d{1,3})/i);
    if (m) {
      const pct = Math.max(0, Math.min(100, Number(m[1])));
      publish(name, {
        type: 'progress',
        ts: Date.now(),
        pm_id,
        name,
        progress: pct,
        raw: text,
      });
    }
  }
}

function handleEvent(data: any): void {
  const name = data?.process?.name;
  const pm_id = data?.process?.pm_id;
  const status = String(data?.event ?? 'unknown');
  if (!name) return;

  publish(name, {
    type: 'status',
    ts: Date.now(),
    pm_id,
    name,
    status,
  });

  try {
    if (status === 'exit' || status === 'stop' || status === 'restart' || status === 'online') {
      log('info', 'process_event', { name, pm_id, status }).catch((err: any) => {
        console.error('[PM2] log(process_event) failed:', err);
      });
      if (status === 'exit') {
        try {
          pm2client
            .describe(name)
            .then((proc: any) => {
              const note = proc?.pm2_env?.note || '';
              if (note !== 'stopped-by-user') {
                log('error', 'unexpected_exit', {
                  name,
                  pm_id,
                  note,
                  exit_code: proc?.pm2_env?.exit_code,
                  exit_signal: proc?.pm2_env?.exit_signal,
                }).catch((err: any) => {
                  console.error('[PM2] log(unexpected_exit) failed:', err);
                });
              }
            })
            .catch((err: any) => {
              console.error('[PM2] pm2client.describe failed:', err);
            });
        } catch (e) {
          console.error('[PM2] describe exception:', e);
        }
      }
    } else if (status === 'launch' || status === 'error' || status === 'unexpected') {
      log('warn', 'process_event_unusual', { name, pm_id, status }).catch((err: any) => {
        console.error('[PM2] log(process_event_unusual) failed:', err);
      });
    }
  } catch (err) {
    console.error('[PM2] handleEvent logging error:', err);
  }
}

export async function subscribe(
  processName: string,
  subscriber: (ev: any) => void
): Promise<{ unsubscribe: () => void; initial: any[] }> {
  await ensureBus();
  if (ALLOWED.size > 0 && !ALLOWED.has(processName)) {
    throw new Error('process-not-allowed');
  }

  let em = emitters.get(processName);
  if (!em) {
    em = new EventEmitter();
    em.setMaxListeners(Math.max(10, parseNum(process.env.PM2_PROCESS_MAX_LISTENERS, 50)));
    emitters.set(processName, em);
  }

  const handler = (ev: any) => {
    try {
      subscriber(ev);
    } catch (err) {
      console.error('[PM2] Subscriber error:', err);
    }
  };

  em.on('event', handler);

  return {
    unsubscribe: () => {
      try {
        em?.off('event', handler);
      } catch (err) {
        console.error('[PM2] Unsubscribe error:', err);
      }
    },
    initial: [...(ringBuffers.get(processName) || [])],
  };
}

export async function listProcesses(): Promise<any[]> {
  await ensureBus();
  const list: any[] = await pm2client.list();
  return (list || [])
    .map((p: any) => ({
      name: p?.name,
      pm_id: p?.pm_id,
      status: p?.pm2_env?.status || 'unknown',
    }))
    .filter(item => !IGNORED.has(item.name) && (ALLOWED.size === 0 ? true : ALLOWED.has(item.name)));
}

export async function describe(processName: string): Promise<any> {
  await ensureBus();
  if (ALLOWED.size > 0 && !ALLOWED.has(processName)) {
    throw new Error('process-not-allowed');
  }
  return pm2client.describe(processName);
}

async function getMemoryUsageLinux(pid: number): Promise<number> {
  try {
    const statusContent = await readFile(`/proc/${pid}/status`, 'utf8');
    const match = statusContent.match(/VmRSS:\s+(\d+)/);
    if (match) {
      return parseInt(match[1], 10) * 1024;
    }
  } catch {}
  return 0;
}

async function getMemoryUsageMac(pid: number): Promise<number> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execPromise = promisify(exec);
    const { stdout } = await execPromise(`ps -o rss= -p ${pid}`);
    const rss = parseInt(stdout.trim(), 10);
    if (!isNaN(rss)) {
      return rss * 1024;
    }
  } catch {}
  return 0;
}

const platform = os.platform();
const getMemoryUsage = platform === 'linux' ? getMemoryUsageLinux : platform === 'darwin' ? getMemoryUsageMac : async () => 0;

export async function getProcessesStats(): Promise<any[]> {
  await ensureBus();
  const list: any[] = await pm2client.list();
  
  const totalMemory = os.totalmem();
  const numCpus = os.cpus().length;
  
  let totalProcessCpu = 0;
  let totalProcessMemory = 0;
  let totalProcessMemoryUsed = 0;
  
  const processesPromises = (list || []).map(async (p: any) => {
    const monit = p?.monit || {};
    const env = p?.pm2_env || {};
    let status = env.status || 'unknown';
    if (status === 'errored' || env.status === 'errored') {
      status = 'errored';
    }
    
    const cpu = monit.cpu || 0;
    const memoryReserved = monit.memory || 0;
    const pid = p?.pid;
    
    let memoryUsed = memoryReserved;
    if (pid && status === 'online') {
      const actualMemory = await getMemoryUsage(pid);
      if (actualMemory > 0) {
        memoryUsed = actualMemory;
      }
    }
    
    totalProcessCpu += cpu;
    totalProcessMemory += memoryReserved;
    totalProcessMemoryUsed += memoryUsed;
    
    return {
      name: p?.name || 'unnamed',
      pm_id: p?.pm_id,
      pid: pid,
      status,
      cpu,
      memory: memoryReserved,
      memoryUsed: memoryUsed,
      uptime: env.pm_uptime ? Date.now() - env.pm_uptime : 0,
      restarts: env.restart_time || 0,
      createdAt: env.created_at || env.pm_uptime || Date.now(),
      updatedAt: Date.now(),
      error:
        status === 'errored'
          ? {
              code: env.exit_code,
              signal: env.exit_signal,
              unstable_restarts: env.unstable_restarts || 0,
            }
          : null,
    };
  });
  
  const processes = (await Promise.all(processesPromises))
    .filter((p: any) => !IGNORED.has(p.name) && (ALLOWED.size === 0 ? true : ALLOWED.has(p.name)));
  
  const totalCpuPercent = totalProcessCpu / numCpus;
  const totalMemoryPercent = (totalProcessMemoryUsed / totalMemory) * 100;
  
  processes.push({
    name: '__system__',
    pm_id: -1,
    pid: null,
    status: 'system',
    cpu: totalCpuPercent,
    memory: totalProcessMemory,
    memoryUsed: totalProcessMemoryUsed,
    totalMemoryAvailable: totalMemory,
    memoryPercent: totalMemoryPercent,
    numCpus: numCpus,
    uptime: 0,
    restarts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    error: null,
  });
  
  return processes;
}

export async function subscribeToAllProcesses(
  callback: (stats: any[]) => void
): Promise<{
  unsubscribe: () => void;
  getProcessesStats: () => Promise<any[]>;
  getLatestStats: () => Promise<any[] | null>;
}> {
  if (subscriberCount + 1 > MAX_SSE_CONNECTIONS) {
    throw new Error('sse-capacity-reached');
  }

  await ensureBus();
  subscriberCount += 1;
  startStatsPoller();

  const handler = (stats: any[]) => {
    try {
      callback(ALLOWED.size > 0 ? stats.filter(s => ALLOWED.has(s.name) || s.name === '__system__') : stats);
    } catch (err) {
      console.error('[PM2] Stats subscriber callback error:', err);
    }
  };

  allProcessesEmitter.on('stats', handler);

  return {
    unsubscribe: () => {
      try {
        allProcessesEmitter.off('stats', handler);
      } catch (err) {
        console.error('[PM2] All processes unsubscribe error:', err);
      } finally {
        subscriberCount = Math.max(0, subscriberCount - 1);
        stopStatsPollerIfIdle();
      }
    },
    getProcessesStats,
    getLatestStats: async () => latestStats,
  };
}

if (process && (process as any).on) {
  process.on('SIGTERM', () => {
    if (pm2Connected) {
      try {
        pm2client.disconnect();
      } catch (e) {
        console.error('[PM2] disconnect on SIGTERM failed:', e);
      }
    }
  });

  process.on('SIGINT', () => {
    if (pm2Connected) {
      try {
        pm2client.disconnect();
      } catch (e) {
        console.error('[PM2] disconnect on SIGINT failed:', e);
      }
    }
  });
}