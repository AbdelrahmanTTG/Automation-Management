const heap = [];
let running = true;

process.on("message", (m) => {
  if (m && m.action === "clean-cache") {
    heap.length = 0;
    console.log("cleaned");
  }
});

function leak() {
  try {
    heap.push(Buffer.alloc(1024 * 1024));
  } catch (e) {
  }
}

setInterval(leak, 200);

setInterval(() => {
  if (!running) process.exit(0);
}, 1000);

// safety stop
setTimeout(() => {
  running = false;
}, 5 * 60 * 1000);
