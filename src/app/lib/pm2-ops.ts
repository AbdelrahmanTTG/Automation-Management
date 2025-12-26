
import pm2client from './pm2-client.mjs';
import path from 'path';
import { log } from './logger';

export async function ensurePm2Saved(): Promise<void> {
  try {
    await pm2client.connect();
    await pm2client.dump();
    await log('info', 'pm2_dumped');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await log('warn', 'pm2_dump_failed', { error: msg }).catch(() => {});
    throw err;
  } finally {
    try {
      pm2client.disconnect();
    } catch {}
  }
}

export async function ensureWatchdogRunning(): Promise<void> {
  try {
    await pm2client.connect();
    const list = await pm2client.list();
    const exists = Array.isArray(list) && list.some((p: any) => p?.name === 'pm2-watchdog');

    if (exists) {
      await log('info', 'watchdog_already_running');
      return;
    }

    const script = path.resolve(process.cwd(), 'src', 'app', 'lib', 'monitor', 'pm2-watchdog.mjs');

    await pm2client.startProcess({
      name: 'pm2-watchdog',
      script,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      max_memory_restart: process.env.WATCHDOG_MEM_LIMIT_MB ? `${process.env.WATCHDOG_MEM_LIMIT_MB}M` : '200M',
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
      internal: true,
    });

    await log('info', 'watchdog_started_manually');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await log('error', 'watchdog_start_failed', { error: msg }).catch(() => {});
    throw err;
  } finally {
    try {
      pm2client.disconnect();
    } catch {}
  }
}
