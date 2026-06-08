// services/bcb-sync/sync-once.js
// One-shot sync — runs once and exits. Used for testing.
// Usage:  node sync-once.js

const { runSync } = require("./lib");

runSync("manual")
  .then((r) => {
    console.log("\nResult:", JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error("\nFAILED:", e.message);
    process.exit(1);
  });
