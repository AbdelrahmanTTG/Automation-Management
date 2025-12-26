const assert = require("assert");
const { startAutomation } = require("../../src/app/lib/start");

(async () => {
  try {
    const res = await startAutomation(
      { id: "u1", name: "alice" },
      "../secret.sh"
    );
    assert(res.error, "Should error on traversal script name");
    console.log("OK: traversal blocked");
  } catch (err) {
    console.error("Test failed", err);
    process.exit(1);
  }
})();
