import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";

// Verify the source contains the runtime early-rejection check for SSE cap
// and that it appears before the call to `ensureBus()` (i.e., early).
const pm2path = path.resolve(process.cwd(), "src", "app", "lib", "pm2.ts");
const txt = await fs.readFile(pm2path, "utf8");
assert(
  txt.includes("sse-capacity-reached"),
  "Expected pm2.ts to contain sse-capacity-reached check"
);
assert(
  txt.includes("subscriberCount + 1 > MAX_SSE_CONNECTIONS"),
  "Expected explicit subscriber count check"
);

const guardIndex = txt.indexOf("sse-capacity-reached");
const busIndex = txt.indexOf("await ensureBus(");
assert(
  guardIndex !== -1 && busIndex !== -1 && guardIndex < busIndex,
  "Expected early guard to appear before ensureBus() call"
);
