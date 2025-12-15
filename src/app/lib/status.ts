import { exec } from "child_process";

export function statusAutomation(user: any) {
  return new Promise((resolve) => {

    const safeName = String(user.name)
      .replace(/[,\s]+/g, "_")
      .replace(/[^a-zA-Z0-9_]/g, "");

    const processName = `${safeName}_${user.id}`;

    exec(`pm2 jlist`, (error, stdout, stderr) => {
      if (error || stderr) {
        return resolve({ error: "Failed to read PM2 list" });
      }

      let list: any[] = [];

      try {
        list = JSON.parse(stdout);
      } catch {
        return resolve({ error: "Failed to parse PM2 data" });
      }

      const proc = list.find((p) => p.name === processName);

      if (!proc) {
        return resolve({
          exists: false,
          status: "Not found process",
        });
      }

      return resolve({
        exists: true,
        name: proc.name,
        pm_id: proc.pm_id,
        status: proc.pm2_env.status,
        cpu: proc.monit.cpu,
        memory: proc.monit.memory,
        pid: proc.pid,
      });
    });
  });
}
