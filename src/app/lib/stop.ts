import { exec } from "child_process";

export function stopAutomation(
  user: any
): Promise<{ message?: string; error?: string }> {
  return new Promise((resolve) => {

    const safeName = String(user.name)
      .replace(/[,\s]+/g, "_")
      .replace(/[^a-zA-Z0-9_]/g, "");

    const processName = `${safeName}_${user.id}`;

    exec(`pm2 jlist`, (err, stdout, stderr) => {
      if (err || stderr) {
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
        return resolve({ error: "Process not found" });
      }

      exec(`pm2 stop "${processName}"`, (error, stdout, stderr) => {
        if (error) return resolve({ error: "Failed to stop process" });
        if (stderr) console.error(stderr);
        resolve({ message: "Process stopped successfully" });
      });
    });
  });
}
