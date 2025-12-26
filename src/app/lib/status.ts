
import { createProcessName } from './security';
import { listProcesses, describe } from './pm2';

interface User {
  id: string | number;
  name: string;
}

interface StatusResult {
  exists: boolean;
  name?: string;
  pm_id?: number;
  status?: string;
  cpu?: number;
  memory?: number;
  pid?: number;
  uptime?: number;
  restarts?: number;
  error?: string;
  detail?: any;
}

export async function statusAutomation(user: User): Promise<StatusResult> {
  try {
    if (!user || !user.id || !user.name) {
      return { exists: false, error: 'Invalid user object' };
    }

    const processName = createProcessName(user.name, user.id);
    const list = await listProcesses();
    const proc = list.find((p: any) => p.name === processName);

    if (!proc) {
      return { exists: false, status: 'Process not found' };
    }

    const detail = await describe(processName);

    return {
      exists: true,
      name: proc.name,
      pm_id: proc.pm_id,
      status: detail?.pm2_env?.status || 'unknown',
      cpu: detail?.monit?.cpu || 0,
      memory: detail?.monit?.memory || 0,
      pid: detail?.pid || 0,
      uptime: detail?.pm2_env?.pm_uptime ? Date.now() - detail.pm2_env.pm_uptime : 0,
      restarts: detail?.pm2_env?.restart_time || 0,
      detail,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Status] Error:', msg);
    return { exists: false, error: msg || 'Failed to get status' };
  }
}
