# Automation-Management — Technical Documentation ✅

**Last updated:** 2025-12-25

> Executive summary: Automation-Management is an in-repo Next.js 16 application and Node-based orchestrator that provides a web UI for managing automation scripts and a runtime that integrates with PM2 to run, monitor, and recover processes. This document reflects the repository’s current implementation (code, scripts, tests, and config) and clarifies planned work and gaps.

---

## Table of Contents

1. Project Overview
2. Current Implementation Status (summary)
3. Architecture & Design
4. PM2 & Process Management
5. Security & Streaming (SSE)
6. Monitoring & Logging
7. Testing & CI Status
8. Roadmap & Planned Work
9. Developer Guidelines
10. Deployment & Operations
11. Appendix: Key Files & Where to Look

---

## 1. Project Overview 🔍

- Purpose: Provide a centralized UI for operators to run, monitor, and manage automation scripts; capture execution logs; and provide real-time visibility into running processes.
- Implementation highlights (present in repo):
  - Next.js 16 app (app/ dir) for UI and server routes under `src/app`.
  - PM2-based process lifecycle integration (`pm2` dependency + helper wrappers under `src/app/lib/pm2*`).
  - A `pm2-watchdog` monitor implemented at `src/app/lib/monitor/pm2-watchdog.mjs` and included in `ecosystem.config.js`.
  - SSE streaming endpoints with token verification and rate limiting (`src/app/api/automation/stream/route.ts` and `processes-stream/route.ts`).
  - File-based structured logging helper (`src/app/lib/logger.ts`).

---

## 2. Current Implementation Status ✅ / ⚠️ / Planned 📝

- SSE protected streams (token HMAC + origin validation + rate limiting) — **Implemented** ✅
- Per-subject & global SSE caps + backpressure (configurable via env) — **Implemented** ✅
- PM2 client wrapper (`src/app/lib/pm2-client.mjs`) & event bus handling (`src/app/lib/pm2.ts`) — **Implemented** ✅
- `pm2-watchdog` monitor with configurable CPU/memory thresholds — **Implemented** ✅
- PM2 persistence helper (`pm2:ensure`) and `scripts/pm2-ensure-watchdog.js` — **Implemented** ✅
- Server-side auth for application routes — **Disabled / Planned** ⚠️ (server-side `requireAuth` throws 501)
- Centralized APM (Sentry/Datadog) and log aggregation (ELK/Opensearch) — **Planned** 📝
- CI pipeline (GitHub Actions) with automated tests/security scans — **Planned** 📝
- Queue-based worker architecture (Redis/Bull) for long-running tasks — **Planned** 📝

> Implementation status section is authoritative — it is derived from the current codebase and scripts, not assumptions.

---

## 3. Architecture & Design 🏗️

### High-Level

- Next.js 16 app (Server + Client components) provides the UI and server API routes under `src/app`.
- PM2 manages the runtime processes (Next server `server.mjs` in cluster mode) and an auxiliary forked watchdog process.
- SSE endpoints expose streaming logs and process stats to authenticated subjects; streaming is implemented as a TransformStream with heartbeats in `src/app/lib/stream.ts`.
- Logging is file-backed (`logs/`) with structured JSON appended by `src/app/lib/logger.ts`.

### Key files to inspect (implementation-first)

- App server entry: `server.mjs` — includes global unhandled rejection/exception handling and IPC hooks (e.g., `clean-cache` message).
- PM2 integration: `src/app/lib/pm2-client.mjs`, `src/app/lib/pm2.ts`, `src/app/lib/pm2-ops.ts`.
- Watchdog: `src/app/lib/monitor/pm2-watchdog.mjs` (implements CPU/memory checks and restarts).
- SSE streams & security: `src/app/api/automation/stream/route.ts`, `src/app/api/automation/processes-stream/route.ts`, `src/app/lib/security.ts`.

---

## 4. PM2 & Process Management 🔧

### What exists (implementation details)

- `ecosystem.config.js` defines two apps:
  - `next-app`: runs `./server.mjs` in cluster mode (instances: max), with memory limits and environment defaults.
  - `pm2-watchdog`: runs `./src/app/lib/monitor/pm2-watchdog.mjs` in fork mode to monitor processes.
- `pm2-client.mjs` is a small promise-wrapper around the `pm2` module providing connect/list/describe/start/restart/stop/delete/dump and a mechanism to send internal messages to processes.
- `pm2.ts`:
  - Launches PM2 bus and subscribes to `log:out`, `log:err`, and `process:event`.
  - Broadcasts events to in-memory ring buffers and EventEmitters for subscribers.
  - Provides `subscribe(processName, subscriber)` and `subscribeToAllProcesses(callback)`.
  - Enforces global SSE subscriber caps and implements polling to collect stats.
- `pm2-ops.ts`:
  - `ensurePm2Saved()` to run `pm2 dump` (persistence) and `ensureWatchdogRunning()` to start `pm2-watchdog` if not present.
- Helper script: `scripts/pm2-ensure-watchdog.js` calls `ensureWatchdogRunning()` and is exposed via `npm run pm2:watchdog`.

### Watchdog details

- Configurable via environment variables (defaults provided):
  - `WATCHDOG_POLL_SECONDS`, `WATCHDOG_CPU_LIMIT`, `WATCHDOG_MEM_LIMIT_MB`, `WATCHDOG_COOLDOWN_SECONDS`, `WATCHDOG_MAX_INTERVENTIONS`, `WATCHDOG_EXCLUDE`.
- The watchdog writes logs to `./logs/pm2-watchdog.log` (configurable), emits events when limits are exceeded, and attempts to restart offending processes.

### How operators should use it

- Use `pm2` on the host with `ecosystem.config.js` to start both apps together for production.
- Call `npm run pm2:ensure` during startup to persist the PM2 process list (convenience for admins/recipes).

---

## 5. Security & Streaming (SSE) 🔐

### SSE & Token Security (Implemented)

- SSE streams require a signed token (HMAC) created by `signToken(...)` in `src/app/lib/security.ts` and verified by `verifyToken(...)`.
- The HMAC secret is taken from `INTERNAL_SSE_SECRET`. In production the code throws if the secret is not set (fail-fast behavior).
- Origin validation is enforced using `ALLOWED_ORIGINS` (env) except in development.
- Rate limiting (IP & subject-based) is implemented in-memory with bounded maps and periodic cleanup. Keys and limits are configurable by environment variables.
- Streaming endpoints include several caps and guards:
  - Per-subject SSE cap (default 5, configurable).
  - Global SSE cap (default 500, configurable).
  - Endpoint-level `SSE capacity reached` and `Too Many Requests` responses where appropriate.

### Authorization & RBAC (Current state)

- SSE tokens carry a `scope` and `subject` and are used to restrict access to streams (for example, a subject is only allowed to connect to its own process, or an admin scope can access all).
- **Server-side authentication for general API routes is disabled**: `src/app/lib/auth.ts` throws a 501 error; full server-side RBAC and authentication is therefore **not currently enforced** and should be addressed before production.

### Other security practices in place

- Input validation and size limits in token parsing (defensive parsing to prevent DoS from oversized token payloads).
- IP extraction helpers and conservative validation for `x-forwarded-for`/`x-real-ip`.

---

## 6. Monitoring & Logging 📊

### What exists

- `src/app/lib/logger.ts` writes structured JSON lines to `logs/automation.log` and logs to stdout.
- `pm2.ts` logs lifecycle events (`process_event`, `unexpected_exit`) through the same logger and records notable events.
- `server.mjs` defines global unhandledRejection/uncaughtException handlers and an opt-in env var `FATAL_EXIT_ON_UNHANDLED` to force exit (allowing PM2 restart on fatal conditions).

### What is missing / planned

- No integrated APM (Sentry/Datadog) or centralized log shipping to ELK/Opensearch is present in the repo — **Planned**.
- Correlation IDs are recommended and not fully implemented across all script runners (Plan to add request/trace id propagation for cross-process tracing).

---

## 7. Testing & CI Status ✅ / ⚠️

### Tests currently in repo (real state)

- Integration tests: present under `tests/integration/` and executed with `node --test tests/integration` (script: `npm run test:integration`). The integration tests exercise PM2 capabilities and watchdog behavior.
- Unit tests: there are small unit-style checks (e.g., `tests/unit/start-sanitization.test.js`) runnable with Node’s test runner.
- `playwright` is included as a dependency and is used by automation scripts (e.g., `src/app/scripts/welocalize.ts`, `propio.ts`) for browser automation; there is no dedicated `npm run test:e2e` script configured in package.json for Playwright tests.

### CI/CD state

- There is **no GitHub Actions / CI pipeline** present in the repository `.github/workflows` at this time — **Planned**.
- Recommended immediate CI work: add GitHub Actions to run lint, node-type-check, `npm run test:integration`, and any e2e jobs (Playwright) in a preview environment.

---

## 8. Roadmap & Planned Work 🛣️

Prioritized items (short-term):

1. Add CI pipeline (GitHub Actions) to run lint, tests, and security scans automatically. (Planned)
2. Implement server-side authentication & RBAC enforcement for API routes (currently disabled). (Planned / High priority)
3. Add centralized observability (Sentry/Datadog) and log-ship to ELK / managed logging. (Planned)
4. Add an OpenAPI spec for server APIs to generate clients and improve contract testing. (Planned)

Longer-term:

- Introduce queue-based workers for heavy, long-running automations (Redis + Bull) and decouple from PM2 process model. (Planned)
- Multi-tenant & scheduling enhancements (CRON UI, dependency graphs) (Planned)

---

## 9. Developer Guidelines & Ops Notes 🧭

- Start local dev: `npm install` → `npm run dev` (Next dev server with turbopack by default).
- For PM2-based host deployments use `ecosystem.config.js` and commands like `pm2 start ecosystem.config.js` then `npm run pm2:ensure` to persist PM2 state.
- Logs are written to `./logs` — operators should forward these to a central log sink in production.
- When deploying to production ensure the following env values are set:
  - `INTERNAL_SSE_SECRET` (required in production)
  - `ALLOWED_ORIGINS` (production frontends)
  - `WATCHDOG_*` env values (tuning thresholds)
  - `FATAL_EXIT_ON_UNHANDLED=1` (optional: make unhandled exceptions fatal so PM2 restarts the process)

---

## 10. Deployment & Operations 🔁

- PM2 is the supported process manager in repo and `ecosystem.config.js` defines the production layout.
- `npm run pm2:watchdog` runs `scripts/pm2-ensure-watchdog.js` which ensures the watchdog process is running in PM2.
- `npm run pm2:ensure` will run `ensurePm2Saved()` to call `pm2 dump` and log the action — useful in startup scripts and operator runbooks.

Operational checklist for production rollout:

- Ensure `INTERNAL_SSE_SECRET` and `ALLOWED_ORIGINS` are configured.
- Configure log forwarding (e.g., Filebeat → ELK or Datadog Agent).
- Add CI pipeline for pre-merge testing and preview deployments.

---

## 11. Appendix — Key Files & Where to Look 🗂️

| Area / Concern                 | Path / File                                              | Note / Purpose                                         |
| ------------------------------ | -------------------------------------------------------- | ------------------------------------------------------ |
| Next server entry              | `server.mjs`                                             | Global error handling and IPC hooks.                   |
| PM2 ecosystem                  | `ecosystem.config.js`                                    | Defines `next-app` and `pm2-watchdog` processes.       |
| PM2 client wrapper             | `src/app/lib/pm2-client.mjs`                             | Promise-based `pm2` helper.                            |
| PM2 bus and event handling     | `src/app/lib/pm2.ts`                                     | Event bus, ring buffers, subscribe APIs.               |
| PM2 operations utilities       | `src/app/lib/pm2-ops.ts`                                 | Ensure dump/save, start watchdog helper.               |
| Watchdog                       | `src/app/lib/monitor/pm2-watchdog.mjs`                   | CPU/memory monitoring and restarts.                    |
| SSE routes / streaming         | `src/app/api/automation/stream/route.ts`                 | Process-level SSE with token checks.                   |
| Processes SSE aggregated route | `src/app/api/automation/processes-stream/route.ts`       | Global processes SSE with caps and counters.           |
| Security & tokens              | `src/app/lib/security.ts`                                | Token signing/verification, origin, rate-limiting.     |
| Logger                         | `src/app/lib/logger.ts`                                  | File-backed JSON logging helper.                       |
| Tests                          | `tests/integration/`, `tests/unit/`                      | Integration tests run via `node --test`.               |
| PM2 helper scripts             | `scripts/pm2-ensure-watchdog.js`, `package.json` scripts | Helpers: `npm run pm2:watchdog`, `npm run pm2:ensure`. |

---

## Quick Actions (next steps for ops and engineering) ✅

- Mandatory before production: enable server-side auth, set `INTERNAL_SSE_SECRET`, and configure `ALLOWED_ORIGINS`.
- Add a GitHub Actions workflow that runs lint, type-check, and `npm run test:integration` on PRs.
- Wire up a logging pipeline (ELK or hosted logs) and add an APM provider (Sentry/Datadog).

---

This file reflects the current repository implementation and recommended, prioritized next steps. For questions or if you want me to open a PR with the CI/workflow or a draft runbook for deployment, tell me which item to prioritize next.
