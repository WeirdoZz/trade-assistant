const fs = require("node:fs");
const path = require("node:path");

function normalizeSymbols(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const seen = new Set();
  return items
    .map((item) => ({
      symbol: String(item?.symbol || "").trim().toUpperCase(),
      name: String(item?.name || item?.description || item?.symbol || "").trim(),
      type: String(item?.type || "").trim()
    }))
    .filter((item) => item.symbol && item.name)
    .filter((item) => {
      if (seen.has(item.symbol)) {
        return false;
      }

      seen.add(item.symbol);
      return true;
    });
}

function createSymbolStore(userDataPath, fetchSymbols) {
  const filePath = path.join(userDataPath, "us-symbols.json");
  let memorySymbols = null;
  let refreshPromise = null;

  function readSymbols() {
    if (memorySymbols) {
      return memorySymbols;
    }

    try {
      if (!fs.existsSync(filePath)) {
        memorySymbols = [];
        return memorySymbols;
      }

      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      memorySymbols = normalizeSymbols(Array.isArray(parsed) ? parsed : parsed?.symbols);
      return memorySymbols;
    } catch (error) {
      console.warn("US symbols cache read failed:", error.message);
      memorySymbols = [];
      return memorySymbols;
    }
  }

  function writeSymbols(symbols) {
    const normalized = normalizeSymbols(symbols);
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({
      updatedAt: new Date().toISOString(),
      symbols: normalized
    }, null, 2));
    memorySymbols = normalized;
    return memorySymbols;
  }

  async function refreshSymbols() {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = Promise.resolve()
      .then(fetchSymbols)
      .then((symbols) => writeSymbols(symbols))
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  return {
    readSymbols,
    refreshSymbols,
    filePath
  };
}

module.exports = {
  createSymbolStore,
  normalizeSymbols
};
