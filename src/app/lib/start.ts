// import { exec } from "child_process";
// import path from "path";

// export function startAutomation(user: any, scriptName: string = "") {
//   return new Promise((resolve) => {
//     const processName = `${user.name}_${user.id}`;

//     exec(`pm2 jlist`, (err, stdout, stderr) => {
//       if (err || stderr) {
//         return resolve({ error: "Failed to read PM2 list" });
//       }

//       let list: any[] = [];
//       try {
//         list = JSON.parse(stdout);
//       } catch (e) {
//         return resolve({ error: "Failed to parse PM2 data" });
//       }

//       const proc = list.find((p) => p.name === processName);

//       const scriptPath = path
//         .join(process.cwd(), "src", "app", "scripts", scriptName)
//         .replace(/\\/g, "/");

//       const tsNodeJS = path
//         .join(process.cwd(), "node_modules", "ts-node", "dist", "bin.js")
//         .replace(/\\/g, "/");

//       let safeUser = JSON.stringify(user);                
//       safeUser = safeUser.replace(/\\/g, "\\\\");        
//       safeUser = safeUser.replace(/"/g, '\\"');           

//       const command = proc
//         ? `pm2 restart "${processName}"`
//         : `pm2 start node --name "${processName}" -- "${tsNodeJS}" "${scriptPath}" "${safeUser}"`;

//       exec(command, (error, stdout, stderr) => {
//         if (error) return resolve({ error: "Failed to start/restart process" });
//         if (stderr) console.error(stderr);
//         resolve({ message: `Automation ${proc ? "restarted" : "started"} successfully` });
//       });
//     });
//   });
// }
import { exec } from "child_process";
import path from "path";

export function startAutomation(user: any, scriptName: string = "") {
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

      const scriptPath = path
        .join(process.cwd(), "src", "app", "scripts", scriptName)
        .replace(/\\/g, "/");

      let safeUser = JSON.stringify(user)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');

      const command = proc
        ? `pm2 restart "${processName}"`
        : `pm2 start node --name "${processName}" -- "${scriptPath}" "${safeUser}"`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          return resolve({ error: "Failed to start/restart process" });
        }
        if (stderr) console.error(stderr);
        resolve({
          message: `Automation ${proc ? "restarted" : "started"} successfully`,
        });
      });
    });
  });
}
