const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createWatchlistStore } = require("../electron/services/watchlist.cjs");

function withTempUserData(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "trade-assistant-watchlist-"));
  try {
    return run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("watchlist store removes a symbol and persists remaining items", () => {
  withTempUserData((directory) => {
    const store = createWatchlistStore(directory);

    store.addWatchlistItem({ symbol: "MSFT", name: "Microsoft" });
    const next = store.removeWatchlistItem("nvda");

    assert.deepEqual(next, [{ symbol: "MSFT", name: "Microsoft" }]);
    assert.deepEqual(store.readWatchlist(), [{ symbol: "MSFT", name: "Microsoft" }]);
  });
});

test("watchlist store can persist an empty watchlist", () => {
  withTempUserData((directory) => {
    const store = createWatchlistStore(directory);

    const next = store.removeWatchlistItem("NVDA");

    assert.deepEqual(next, []);
    assert.deepEqual(store.readWatchlist(), []);
  });
});
