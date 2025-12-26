process.on("message", (m) => {
  if (m && m.action === "clean-cache") {
    console.log("cache cleared");
  }
});

setInterval(() => {
  process.stdout.write(".");
}, 1000);
