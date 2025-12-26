setTimeout(() => {
  console.error("crashing now");
  process.exit(1);
}, 2000);

setTimeout(() => process.exit(0), 10000);
