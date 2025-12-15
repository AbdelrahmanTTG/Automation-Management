import { spawn, ChildProcessWithoutNullStreams } from "child_process";

export function streamPm2Logs(
  processName: string,
  onLog: (log: string) => void
): ChildProcessWithoutNullStreams {
  const pm2 = spawn("pm2", ["logs", processName, "--raw"]);

  pm2.stdout.on("data", (data) => {
    onLog(data.toString());
  });

  pm2.stderr.on("data", (data) => {
    onLog("[ERROR] " + data.toString());
  });

  pm2.on("close", () => {
    onLog("PM2 log stream closed");
  });

  return pm2;
}
