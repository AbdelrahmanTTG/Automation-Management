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
    const proc = list.find((p) => p.name === processName);

    if (!proc) {
      return { error: 'Process not found' };
    }

    try {
      await pm2SetEnv(processName, 'note', 'stopped-by-user');
    } catch (err: any) {
      console.error('[PM2] Set note failed:', err);
      await log('warn', 'set_note_failed', { processName, error: String(err) });
    }

    await pm2Stop(processName);
    await pm2Save();

    const detail = await describeProc(processName);

    await log('info', 'automation_stopped', { userId: user.id, processName, detail });

    return { message: 'Process stopped successfully', process: detail };
  } catch (error: any) {
    console.error('[Stop] Error:', error);
    await log('error', 'automation_stop_error', { error: String(error), userId: user?.id });
    return {
      error: error instanceof Error ? error.message : 'Failed to stop process',
    };
  }
}

process.on('SIGTERM', () => {
  try {
    pm2client.disconnect();
  } catch (err) {
     
  }
});

process.on('SIGINT', () => {
  try {
    pm2client.disconnect();
  } catch (err) {
    
  }
});