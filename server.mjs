// ===== server.mjs =====
import next from "next";
import { createServer } from "node:http";

// Single, consistent global error handlers (avoid duplicates across modules)
const FATAL_EXIT_ON_UNHANDLED = process.env.FATAL_EXIT_ON_UNHANDLED === "1";
const logErr = (type, err) => {
  // Structured logs, non-blocking console
  const payload = {
    level: type,
    ts: Date.now(),
    message: (err && err.message) || String(err),
    stack: err && err.stack ? String(err.stack) : undefined,
  };
  console.error(JSON.stringify(payload));
};

if (process && process.on) {
  if (process.listeners("unhandledRejection").length === 0) {
    process.on("unhandledRejection", (reason) => {
      logErr("error", reason);
      if (FATAL_EXIT_ON_UNHANDLED) {
        // Allow logs to flush, then exit for PM2 to restart
        setTimeout(() => process.exit(1), 100);
      }
    });
  }
  if (process.listeners("uncaughtException").length === 0) {
    process.on("uncaughtException", (err) => {
      logErr("error", err);
      if (FATAL_EXIT_ON_UNHANDLED) {
        setTimeout(() => process.exit(1), 100);
      }
    });
  }
}

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => {
  // Keep request path clean: no sync heavy ops in handler
  handle(req, res);
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(
    JSON.stringify({
      level: "info",
      ts: Date.now(),
      msg: `Next.js server listening`,
      port,
    })
  );
});

function tryCleanCaches() {
  try {
    if (typeof require !== "undefined" && require?.cache) {
      // Cache cleanup may be heavy; keep it out of request path
      for (const k of Object.keys(require.cache)) {
        delete require.cache[k];
      }
    }
    if (global.gc) {
      global.gc();
    }
    console.log(
      JSON.stringify({
        level: "info",
        ts: Date.now(),
        msg: "cache cleanup executed",
      })
    );
  } catch (err) {
    logErr("error", err);
  }
}

process.on("SIGUSR2", () => {
  console.log(
    JSON.stringify({
      level: "warn",
      ts: Date.now(),
      msg: "SIGUSR2 received -> clean caches",
    })
  );
  tryCleanCaches();
});

process.on("message", (packet) => {
  try {
    const action = packet?.data?.action || packet?.action;
    if (action === "clean-cache") {
      console.log(
        JSON.stringify({
          level: "warn",
          ts: Date.now(),
          msg: "IPC clean-cache received -> clean caches",
        })
      );
      tryCleanCaches();
    }
  } catch (err) {
    logErr("error", err);
  }
});
