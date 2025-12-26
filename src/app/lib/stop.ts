
import { createProcessName } from './security';
import { describe as describeProc, listProcesses } from './pm2';
import { log } from './logger';
import pm2client from './pm2-client.mjs';

interface User {
  id: string | number;
  name: string;
}

interface StopResult {
  message?: string;
  error?: string;
  process?: any;
}

function pm2Stop(processName: string): Promise<void> {
  return pm2client.stopProcess(processName);
}

function pm2SetEnv(processName: string, key: string, value: string): Promise<void> {
  return pm2client.setProcessEnv(processName, key, value);
}

function pm2Save(): Promise<void> {
  return pm2client.dump();
}

export async function stopAutomation(user: User): Promise<StopResult> {
  try {
    if (!user || !user.id || !user.name) {
      return { error: 'Invalid user object' };
    }

    const processName = createProcessName(user.name, user.id);

    const list = await listProcesses();
    const proc = (list || []).find((p: any) => p.name === processName);

    if (!proc) {
      return { error: 'Process not found' };
    }

    try {
      await pm2SetEnv(processName, 'note', 'stopped-by-user');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PM2] Set note failed:', msg);
      await log('warn', 'set_note_failed', { processName, error: msg }).catch(() => {});
    }

    await pm2Stop(processName);
    await pm2Save();

    const detail = await describeProc(processName);

    await log('info', 'automation_stopped', { userId: user.id, processName, detail }).catch(() => {});

    return { message: 'Process stopped successfully', process: detail };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Stop] Error:', msg);
    await log('error', 'automation_stop_error', { error: msg, userId: (user as any)?.id }).catch(() => {});
    return { error: msg || 'Failed to stop process' };
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
