import pm2client from './pm2-client.mjs';
import path from 'path';
import { log } from './logger';

/**
 * Utility functions to help ensure PM2 startup/persistence is configured and the
 * watchdog / core processes are running. These are admin utilities and should be
 * executed by an operator or as part of bootstrapping.
 */

export async function ensurePm2Saved(): Promise<void> {
  try {
    await pm2client.connect();
    await pm2client.dump();
    pm2client.disconnect();
    await log('info', 'pm2_dumped');
  } catch (err) {
    await log('warn', 'pm2_dump_failed', { error: String(err) }).catch(() => {});
    throw err;
  }
}

export async function ensureWatchdogRunning(): Promise<void> {
  try {
    await pm2client.connect();
    const list = await pm2client.list();
    const exists = (list || []).some(p => p.name === 'pm2-watchdog');

    if (exists) {
      pm2client.disconnect();
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

    pm2client.disconnect();
    await log('info', 'watchdog_started_manually');
  } catch (err) {
    pm2client.disconnect();
    await log('error', 'watchdog_start_failed', { error: String(err) }).catch(() => {});
    throw err;
  }
}
