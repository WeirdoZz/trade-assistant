const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildFallbackOptionsHome,
  buildOptionsHomeFromSnapshots,
  getMassiveApiKey,
  getOptionsHome
} = require("../electron/services/optionsData.cjs");

test("massive api key accepts MASSIVE_API_KEY and POLYGON_API_KEY", () => {
  const originalMassive = process.env.MASSIVE_API_KEY;
  const originalPolygon = process.env.POLYGON_API_KEY;

  process.env.MASSIVE_API_KEY = " massive ";
  process.env.POLYGON_API_KEY = "polygon";
  assert.equal(getMassiveApiKey(), "massive");

  delete process.env.MASSIVE_API_KEY;
  process.env.POLYGON_API_KEY = " polygon ";
  assert.equal(getMassiveApiKey(), "polygon");

  if (originalMassive === undefined) {
    delete process.env.MASSIVE_API_KEY;
  } else {
    process.env.MASSIVE_API_KEY = originalMassive;
  }

  if (originalPolygon === undefined) {
    delete process.env.POLYGON_API_KEY;
  } else {
    process.env.POLYGON_API_KEY = originalPolygon;
  }
});

test("fallback options home ranks watchlist symbols by score", () => {
  const page = buildFallbackOptionsHome([
    { symbol: "NVDA", name: "NVIDIA" },
    { symbol: "AAPL", name: "Apple" }
  ]);

  assert.equal(page.window, "T-3");
  assert.equal(page.poolName, "自选池");
  assert.deepEqual(page.symbols.map((item) => item.symbol), ["NVDA", "AAPL"]);
  assert.ok(page.symbols[0].score >= page.symbols[1].score);
  assert.equal(page.summary.unusualSymbolCount, 2);
});

test("snapshot builder normalizes Massive option chain fields", () => {
  const page = buildOptionsHomeFromSnapshots([
    {
      symbol: "TSLA",
      name: "Tesla",
      snapshot: {
        results: [
          {
            day: { volume: 1200, close: 2.4, previous_close: 1.7 },
            details: {
              contract_type: "call",
              expiration_date: "2026-06-19",
              strike_price: 250,
              ticker: "O:TSLA260619C00250000"
            },
            implied_volatility: 0.62,
            last_quote: { ask: 2.5, bid: 2.35, midpoint: 2.425 },
            last_trade: { price: 2.48, size: 80 },
            open_interest: 300,
            underlying_asset: { price: 242, ticker: "TSLA" }
          },
          {
            day: { volume: 500, close: 3.1, previous_close: 3.4 },
            details: {
              contract_type: "put",
              expiration_date: "2026-06-19",
              strike_price: 220,
              ticker: "O:TSLA260619P00220000"
            },
            implied_volatility: 0.51,
            last_trade: { price: 3, size: 20 },
            open_interest: 1000,
            underlying_asset: { price: 242, ticker: "TSLA" }
          }
        ]
      }
    }
  ]);

  assert.equal(page.symbols[0].symbol, "TSLA");
  assert.equal(page.symbols[0].direction, "bullish");
  assert.equal(page.symbols[0].contracts[0].contractSymbol, "O:TSLA260619C00250000");
  assert.ok(page.symbols[0].totalPremium > 0);
  assert.ok(page.symbols[0].score > 0);
});

test("getOptionsHome falls back when Massive key is missing", async () => {
  const originalMassive = process.env.MASSIVE_API_KEY;
  const originalPolygon = process.env.POLYGON_API_KEY;
  delete process.env.MASSIVE_API_KEY;
  delete process.env.POLYGON_API_KEY;

  const page = await getOptionsHome([{ symbol: "AMD", name: "AMD" }]);
  assert.equal(page.symbols[0].symbol, "AMD");
  assert.equal(page.source, "fallback");

  if (originalMassive === undefined) {
    delete process.env.MASSIVE_API_KEY;
  } else {
    process.env.MASSIVE_API_KEY = originalMassive;
  }

  if (originalPolygon === undefined) {
    delete process.env.POLYGON_API_KEY;
  } else {
    process.env.POLYGON_API_KEY = originalPolygon;
  }
});
