
import path from 'path';
import fs from 'fs';
import { createProcessName } from './security';
import { log } from './logger';
import { listProcesses } from './pm2';
import pm2client from './pm2-client.mjs';

interface User {
  id: string | number;
  name: string;
}

interface StartResult {
  message?: string;
  error?: string;
  process?: any;
}

const ALLOWED_SCRIPTS = new Set(
  (process.env.ALLOWED_SCRIPTS || 'propio.js,welocalize.js')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

const DEFAULT_MAX_MEMORY = process.env.AUTOMATION_MAX_MEMORY || '1G';
const DEFAULT_WATCHDOG_CPU = process.env.WATCHDOG_CPU_LIMIT || '85';
const DEFAULT_WATCHDOG_MEM_MB = process.env.WATCHDOG_MEM_LIMIT_MB || '1024';

function pathInside(base: string, target: string) {
  const rel = path.relative(base, target);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export async function startAutomation(
  user: User,
  scriptName: string = ''
): Promise<StartResult> {
  try {
    if (!user || !user.id || !user.name) {
      return { error: 'Invalid user object' };
    }

    if (!scriptName) {
      return { error: 'Script name is required' };
    }

    if (!ALLOWED_SCRIPTS.has(scriptName)) {
      return { error: 'Script not allowed' };
    }

    const processName = createProcessName(user.name, user.id);

    const scriptsDir = path.join(process.cwd(), 'src', 'app', 'scripts');
    const scriptPath = path.resolve(path.join(scriptsDir, scriptName));

    if (!pathInside(scriptsDir, scriptPath)) {
      return { error: 'Invalid script path' };
    }

    try {
      const st = await fs.promises.stat(scriptPath);
      if (!st.isFile()) return { error: 'Script file not found' };
    } catch {
      return { error: 'Script file not found' };
    }

    const logsDir = path.join(process.cwd(), 'logs');
    try {
      await fs.promises.mkdir(logsDir, { recursive: true });
    } catch {}

    const list = await listProcesses();
    const exists = !!(list || []).find((p: any) => p.name === processName);

    let stoppedByUser = false;
    let preDetail: any = null;

    if (exists) {
      preDetail = await pm2client.describe(processName).catch(() => null);
      const note = preDetail?.pm2_env?.note || '';
      stoppedByUser = note === 'stopped-by-user';
    }

    if (exists && stoppedByUser) {
      try {
        await pm2client.deleteProcess(processName);
      } catch (err) {
        console.error('[PM2] Delete failed:', err);
      }
    }

    const userJson = JSON.stringify(user);

    const startOptions = {
      name: processName,
      script: scriptPath,
      args: [userJson],
      cwd: process.cwd(),
      instances: 1,
      exec_mode: 'fork' as const,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: process.env.AUTOMATION_MAX_MEMORY || DEFAULT_MAX_MEMORY,
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        USER_DATA: userJson,
        WATCHDOG_CPU_LIMIT: process.env.WATCHDOG_CPU_LIMIT || DEFAULT_WATCHDOG_CPU,
        WATCHDOG_MEM_LIMIT_MB: process.env.WATCHDOG_MEM_LIMIT_MB || DEFAULT_WATCHDOG_MEM_MB,
      },
      error_file: path.join(logsDir, `${processName}-error.log`),
      out_file: path.join(logsDir, `${processName}-out.log`),
      merge_logs: true,
      time: true,
    };

    if (exists && !stoppedByUser) {
      await pm2client.restartProcess(processName);
      await pm2client.dump();
      const detail = await pm2client.describe(processName);
      await log('info', 'automation_restarted', { userId: user.id, processName, detail });
      return { message: 'Automation restarted successfully', process: detail };
    } else {
      await pm2client.startProcess(Object.assign({}, startOptions));
      await pm2client.dump();
      const detail = await pm2client.describe(processName);
      await log('info', 'automation_started', { userId: user.id, processName, detail });
      return { message: 'Automation started successfully', process: detail };
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Start] Error:', msg);
    await log('error', 'automation_start_error', { error: msg, userId: user?.id, scriptName }).catch(() => {});
    return { error: msg || 'Failed to start process' };
  }
}

process.on('SIGTERM', () => {
  try {
    pm2client.disconnect();
  } catch {}
});

process.on('SIGINT', () => {
  try {
    pm2client.disconnect();
  } catch {}
});
