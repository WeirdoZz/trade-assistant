const fs = require("node:fs");
const path = require("node:path");

const defaultWatchlist = [
  { symbol: "NVDA", name: "NVIDIA" }
];

const legacyDefaultSymbols = ["NVDA", "MSFT", "TSLA", "AMD", "AAPL", "META"];

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

function normalizeName(name, symbol) {
  return String(name || "").trim() || normalizeSymbol(symbol);
}

function createWatchlistStore(userDataPath) {
  const filePath = path.join(userDataPath, "watchlist.json");

  function readWatchlist() {
    try {
      if (!fs.existsSync(filePath)) {
        return defaultWatchlist;
      }

      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (!Array.isArray(parsed)) {
        return defaultWatchlist;
      }

      const normalized = parsed
        .map((item) => ({
          symbol: normalizeSymbol(item?.symbol),
          name: normalizeName(item?.name, item?.symbol)
        }))
        .filter((item) => item.symbol);

      const normalizedSymbols = normalized.map((item) => item.symbol).sort();
      const legacySymbols = [...legacyDefaultSymbols].sort();
      if (JSON.stringify(normalizedSymbols) === JSON.stringify(legacySymbols)) {
        writeWatchlist(defaultWatchlist);
        return defaultWatchlist;
      }

      return normalized.length ? normalized : defaultWatchlist;
    } catch (error) {
      console.warn("Watchlist read failed, using defaults:", error.message);
      return defaultWatchlist;
    }
  }

  function writeWatchlist(items) {
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
  }

  function addWatchlistItem(item) {
    const symbol = normalizeSymbol(item?.symbol);
    if (!symbol) {
      throw new Error("Missing symbol");
    }

    const current = readWatchlist();
    if (current.some((entry) => entry.symbol === symbol)) {
      return current;
    }

    const next = [
      ...current,
      {
        symbol,
        name: normalizeName(item?.name, symbol)
      }
    ];
    writeWatchlist(next);
    return next;
  }

  return {
    readWatchlist,
    addWatchlistItem,
    filePath
  };
}

module.exports = {
  createWatchlistStore,
  defaultWatchlist
};
