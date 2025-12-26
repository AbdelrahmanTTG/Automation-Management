
// ===== pm2.ts =====
import EventEmitter from 'events';
import pm2client from './pm2-client.mjs';
import { log } from './logger';

let pm2Connected = false;
let connectionPromise: Promise<void> | null = null;

const ALLOWED = new Set(
  (process.env.PM2_ALLOWED_PROCESSES || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

const MAX_TRACKED_PROCESSES = Math.max(50, Number(process.env.PM2_MAX_TRACKED || 200));

const emitters = new Map<string, EventEmitter>();
const ringBuffers = new Map<string, any[]>();
const ringOrder: string[] = []; // track insertion order for eviction
const RING_SIZE = Number(process.env.PM2_RING_SIZE || 500);

let busReady = false;
let busInitPromise: Promise<void> | null = null;

const allProcessesEmitter = new EventEmitter();
allProcessesEmitter.setMaxListeners(Math.max(50, Number(process.env.PM2_GLOBAL_MAX_LISTENERS || 200)));

const STAT_POLL_INTERVAL_MS = Number(process.env.PM2_STATS_INTERVAL_MS || 3000);
let pollTimer: NodeJS.Timeout | null = null;
let subscriberCount = 0;
let latestStats: any[] | null = null;
let polling = false;
let lastPollAt = 0;

// Global cap to protect the app from excessive SSE subscriptions (can be set via env)
const MAX_SSE_CONNECTIONS = Math.max(10, Number(process.env.MAX_SSE_CONNECTIONS || 1000));

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
    const timeout = setTimeout(() => {
      connectionPromise = null;
      console.error('[PM2] PM2 connection timeout');
    }, 10000);

    try {
      await pm2client.connect();
      pm2Connected = true;
      clearTimeout(timeout);
    } catch (err) {
      connectionPromise = null;
      clearTimeout(timeout);
      throw err;
    }
  })();

  return connectionPromise;
}

async function ensureBus(): Promise<void> {
  if (busReady) return;
  if (busInitPromise) return busInitPromise;

  busInitPromise = (async () => {
    await connectPM2();

    return new Promise<void>(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('PM2 bus launch timeout'));
      }, 10000);

      try {
        const bus = await pm2client.launchBus();

        bus.on('log:out', (data: any) => handleLog(data, 'log'));
        bus.on('log:err', (data: any) => handleLog(data, 'error'));
        bus.on('process:event', (data: any) => handleEvent(data));

        busReady = true;
        clearTimeout(timeout);
        resolve();
      } catch (busErr) {
        busInitPromise = null;
        clearTimeout(timeout);
        return reject(busErr);
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
    // Evict oldest tracked process if exceeding bounds
    if (ringOrder.length > MAX_TRACKED_PROCESSES) {
      const oldest = ringOrder.shift();
      if (oldest) {
        ringBuffers.delete(oldest);
        const em = emitters.get(oldest);
        if (em) {
          em.removeAllListeners(); // cleanup listeners to avoid leaks
          emitters.delete(oldest);
        }
      }
    }
  }
}

function publish(name: string, ev: any): void {
  if (!name) return;

  // Enforce allowed set if configured
  if (ALLOWED.size > 0 && !ALLOWED.has(name)) {
    return;
  }

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
    em.setMaxListeners(Math.max(10, Number(process.env.PM2_PROCESS_MAX_LISTENERS || 50)));
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
  const list = await pm2client.list();
  return (list || []).map(p => ({
    name: p.name,
    pm_id: p.pm_id,
    status: p.pm2_env?.status || 'unknown',
  })).filter(item => ALLOWED.size === 0 || ALLOWED.has(item.name));
}

export async function describe(processName: string): Promise<any> {
  await ensureBus();
  if (ALLOWED.size > 0 && !ALLOWED.has(processName)) {
    throw new Error('process-not-allowed');
  }
  return pm2client.describe(processName);
}

export async function getProcessesStats(): Promise<any[]> {
  await ensureBus();

  const list = await pm2client.list();

  const processes = (list || []).map(p => {
    const monit = p.monit || {};
    const env = p.pm2_env || {};

    let status = env.status || 'unknown';

    if (status === 'errored' || env.status === 'errored') {
      status = 'errored';
    }

    return {
      name: p.name || 'unnamed',
      pm_id: p.pm_id,
      status: status,
      cpu: monit.cpu || 0,
      memory: monit.memory || 0,
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
  }).filter(p => ALLOWED.size === 0 || ALLOWED.has(p.name));

  return processes;
}

/**
 * Subscribe to centralized, throttled stats updates.
 * Maintains backward compatibility by returning both getProcessesStats() and getLatestStats().
 */
export async function subscribeToAllProcesses(
  callback: (stats: any[]) => void
): Promise<{ unsubscribe: () => void; getProcessesStats: () => Promise<any[]>; getLatestStats: () => Promise<any[] | null> }> {
  // Enforce global subscription cap early to avoid starting heavy resources
  if (subscriberCount + 1 > MAX_SSE_CONNECTIONS) {
    throw new Error('sse-capacity-reached');
  }

  await ensureBus();

  subscriberCount += 1;
  startStatsPoller();

  const handler = (stats: any[]) => {
    try {
      callback(ALLOWED.size > 0 ? stats.filter(s => ALLOWED.has(s.name)) : stats);
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

// Remove duplicate unhandledRejection handler to keep single global one defined in server.mjs

if (process && process.on) {
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
