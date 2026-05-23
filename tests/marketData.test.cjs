const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildDashboardFromFinnhub,
  getFinnhubApiKey,
  getMarketOverview
} = require("../electron/services/marketData.cjs");

function assertPerformanceFields(card) {
  assert.equal(typeof card.symbol, "string");
  assert.equal(typeof card.name, "string");
  assert.equal(typeof card.price, "number");
  assert.equal(typeof card.dayChange.amount, "number");
  assert.equal(typeof card.dayChange.percent, "number");

  for (const period of [5, 10, 15]) {
    const key = `${period}d`;
    assert.equal(typeof card.performance[key].amount, "number");
    assert.equal(typeof card.performance[key].percent, "number");
  }
}

async function withoutFinnhubKey(run) {
  const originalCanonical = process.env.FINNHUB_API_KEY;
  const originalLegacy = process.env.FINNHU_API_KEY;

  delete process.env.FINNHUB_API_KEY;
  delete process.env.FINNHU_API_KEY;

  try {
    return await run();
  } finally {
    if (originalCanonical === undefined) {
      delete process.env.FINNHUB_API_KEY;
    } else {
      process.env.FINNHUB_API_KEY = originalCanonical;
    }

    if (originalLegacy === undefined) {
      delete process.env.FINNHU_API_KEY;
    } else {
      process.env.FINNHU_API_KEY = originalLegacy;
    }
  }
}

test("market overview exposes indexes, watchlist, and macro cards", async () => {
  const overview = await withoutFinnhubKey(() => getMarketOverview());

  assert.equal(overview.indexes.length, 3);
  assert.ok(overview.watchlist.length >= 4);
  assert.ok(overview.macro.length >= 3);

  for (const card of [...overview.indexes, ...overview.watchlist, ...overview.macro]) {
    assertPerformanceFields(card);
  }
});

test("watchlist cards are suitable links into dashboard detail", async () => {
  const overview = await withoutFinnhubKey(() => getMarketOverview());

  for (const card of overview.watchlist) {
    assert.equal(card.kind, "stock");
    assert.match(card.symbol, /^[A-Z.]+$/);
  }
});

test("finnhub api key accepts canonical and legacy env names", () => {
  const originalCanonical = process.env.FINNHUB_API_KEY;
  const originalLegacy = process.env.FINNHU_API_KEY;

  process.env.FINNHUB_API_KEY = " canonical ";
  process.env.FINNHU_API_KEY = "legacy";
  assert.equal(getFinnhubApiKey(), "canonical");

  delete process.env.FINNHUB_API_KEY;
  process.env.FINNHU_API_KEY = " legacy ";
  assert.equal(getFinnhubApiKey(), "legacy");

  if (originalCanonical === undefined) {
    delete process.env.FINNHUB_API_KEY;
  } else {
    process.env.FINNHUB_API_KEY = originalCanonical;
  }

  if (originalLegacy === undefined) {
    delete process.env.FINNHU_API_KEY;
  } else {
    process.env.FINNHU_API_KEY = originalLegacy;
  }
});

test("finnhub dashboard uses quote for latest price and fallback history for chart", () => {
  const dashboard = buildDashboardFromFinnhub("nvda", {
    quote: {
      c: 125.5,
      d: 2.5,
      dp: 2.03,
      pc: 123
    }
  });

  assert.equal(dashboard.symbol, "NVDA");
  assert.equal(dashboard.quote.price, 125.5);
  assert.equal(dashboard.quote.changeAmount, 2.5);
  assert.equal(dashboard.quote.changePercent, 2.03);
  assert.equal(dashboard.quote.previousClose, 123);
  assert.ok(dashboard.prices.length > 1);
  assert.equal(dashboard.prices.at(-1).close, 125.5);
});
