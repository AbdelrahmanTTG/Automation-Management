let busy = false;

process.on("message", (m) => {
  if (m && m.action === "start-cpu") busy = true;
  if (m && m.action === "stop-cpu") busy = false;
});

async function work() {
  while (true) {
    if (busy) {
      const end = Date.now() + 200;
      while (Date.now() < end) {
        Math.sqrt(Math.random());
      }
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

work();
