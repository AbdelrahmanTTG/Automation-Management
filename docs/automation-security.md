# Automation Management - Security & Reliability Changes

Summary of changes applied to improve security, stability, and observability:

- **Server-side authentication for automation APIs was intentionally disabled.** Routes now accept a client-supplied `user` object in the request body and apply server-side rate-limits; this reduces server-side guarantees about identity and should be used with caution.

  - If you later re-enable server-side checks, configure `ACCESS_TOKEN_NAME` and `API_BASE_URL` and restore `requireAuth` usage in API routes.

- Structured logging (`src/app/lib/logger.ts`) with JSON entries and fallback to console.

  - All automation actions now log `event`, `level`, `ts`, and relevant metadata (userId, process, error).

- Hardened PM2 process start/stop flow:

  - `src/app/lib/start.ts` now validates `scriptName` against `ALLOWED_SCRIPTS`, ensures resolved path is inside `src/app/scripts`, and checks file existence.
  - Uses conservative defaults for memory (`AUTOMATION_MAX_MEMORY`) and exposes watchdog limits via env (`WATCHDOG_CPU_LIMIT`, `WATCHDOG_MEM_LIMIT_MB`).
  - `src/app/lib/stop.ts` sets `note = stopped-by-user` before stopping to distinguish user stops vs crashes.

- Centralized PM2 helpers & monitoring:

  - `src/app/lib/pm2.ts` centralizes bus, process list, and adds lifecycle event logging.
  - `src/app/lib/monitor/pm2-watchdog.mjs` detects limit exceeded scenarios and performs cache cleanup / restarts.
  - `src/app/lib/pm2-ops.ts` provides helper functions to ensure PM2 `dump` (save) and to start the watchdog automatically.

- API route hardening:

  - `start`, `stop`, and `status` API routes accept client-provided `user` objects and enforce per-user rate limits.
  - SSE `stream` endpoint validates origin, token signature, applies rate limits, and restricts which process a token can subscribe to.

- Startup & persistence guidance added in `docs/pm2-startup.md` and a small script to ensure watchdog start `scripts/pm2-ensure-watchdog.js`.

Why these changes:

- Prevents spoofed client actions by validating the session server-side and applying role checks.
- Prevents path traversal and script injection by whitelisting and path resolution checks.
- Adds observability to understand root causes of process restarts and resource limits.
- Ensures processes can be managed centrally and recovered automatically on resource problems or restarts.

Next steps / recommendations:

- Configure `ACCESS_TOKEN_NAME` and `API_BASE_URL` in production to enable server-side checks.
- Run `pm2 save` and `pm2 startup` according to `docs/pm2-startup.md`.
- Consider integrating external logging (ELK, CloudWatch) for alerts on `automation_start/stop/error` events.
