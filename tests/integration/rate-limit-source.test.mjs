import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";

// Static source checks to confirm rate limiter primitives and cleanup placement
const secPath = path.resolve(process.cwd(), "src", "app", "lib", "security.ts");
const txt = await fs.readFile(secPath, "utf8");
assert(
  txt.includes("MAX_RATE_KEYS"),
  "Expected security.ts to define MAX_RATE_KEYS"
);
assert(
  txt.includes("ensureCapacity("),
  "Expected ensureCapacity to be implemented"
);
assert(
  txt.includes("ensureCapacity(ipCounters);"),
  "Expected ensureCapacity to be called for ipCounters in cleanup"
);
assert(
  txt.includes("ensureCapacity(subjectCounters);"),
  "Expected ensureCapacity to be called for subjectCounters in cleanup"
);
assert(txt.includes("setInterval("), "Expected periodic cleanup to be present");
assert(txt.includes("BLOCK_DURATION"), "Expected BLOCK_DURATION to be defined");
assert(
  txt.includes("entry.blocked"),
  "Expected rate limit blocking logic to reference entry.blocked"
);
