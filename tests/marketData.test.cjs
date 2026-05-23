const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildDashboardFromFinnhub,
  buildDashboardFromLongbridgeQuote,
  candlesticksToPrices,
  fetchLongbridgeCandlesticks,
  getFinnhubApiKey,
  getMarketOverview,
  makeMarketCard
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
  const originalDisableLongbridge = process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;

  delete process.env.FINNHUB_API_KEY;
  delete process.env.FINNHU_API_KEY;
  process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES = "1";

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

    if (originalDisableLongbridge === undefined) {
      delete process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;
    } else {
      process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES = originalDisableLongbridge;
    }
  }
}

test("market overview excludes unavailable static indexes and exposes one watchlist card", async () => {
  const overview = await withoutFinnhubKey(() => getMarketOverview());

  assert.equal(overview.indexes.length, 0);
  assert.deepEqual(overview.watchlist.map((card) => card.symbol), ["NVDA"]);
  assert.equal(overview.macro.length, 0);

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

test("longbridge dashboard uses quote fields for latest price", () => {
  const dashboard = buildDashboardFromLongbridgeQuote("nvda", {
    symbol: "NVDA.US",
    lastDone: "100",
    prevClose: "95",
    timestamp: 1710000000
  });

  assert.equal(dashboard.symbol, "NVDA");
  assert.equal(dashboard.quote.price, 100);
  assert.equal(dashboard.quote.previousClose, 95);
  assert.equal(dashboard.quote.changeAmount, 5);
  assert.equal(dashboard.quote.changePercent, 5.26);
  assert.equal(dashboard.prices.at(-1).close, 100);
});

test("longbridge candlesticks convert to daily chart prices", () => {
  const prices = candlesticksToPrices([
    {
      timestamp: 1710000000,
      open: "99.5",
      high: "103.25",
      low: "98.75",
      close: "101.5",
      volume: 12345,
      turnover: "456789.12"
    },
    {
      timestamp: 1710086400,
      open: "101.5",
      high: "104",
      low: "100",
      close: "103",
      volume: "23456",
      turnover: "567890.12"
    }
  ]);

  assert.deepEqual(prices, [
    {
      date: "2024-03-09",
      open: 99.5,
      high: 103.25,
      low: 98.75,
      close: 101.5,
      volume: 12345,
      turnover: 456789.12
    },
    {
      date: "2024-03-10",
      open: 101.5,
      high: 104,
      low: 100,
      close: 103,
      volume: 23456,
      turnover: 567890.12
    }
  ]);
});

test("longbridge dashboard uses candlesticks for four-month price chart", () => {
  const candles = candlesticksToPrices([
    { timestamp: 1710000000, open: "95", high: "101", low: "94", close: "100", volume: 10 },
    { timestamp: 1710086400, open: "100", high: "104", low: "99", close: "103", volume: 20 }
  ]);
  const dashboard = buildDashboardFromLongbridgeQuote("nvda", {
    symbol: "NVDA.US",
    lastDone: "105",
    prevClose: "102",
    timestamp: 1710172800
  }, candles);

  assert.equal(dashboard.prices.length, 2);
  assert.equal(dashboard.prices.at(-1).close, 103);
  assert.equal(dashboard.quote.price, 105);
});

test("watchlist card uses longbridge daily candles for sparkline and performance", () => {
  const prices = Array.from({ length: 20 }, (_, index) => ({
    date: `2024-03-${String(index + 1).padStart(2, "0")}`,
    close: 100 + index,
    volume: index
  }));

  const card = makeMarketCard(
    { symbol: "NVDA", name: "NVIDIA", kind: "stock", base: 100 },
    { c: 119, pc: 118, d: 1, dp: 0.85, t: 1711641600 },
    prices
  );

  assert.deepEqual(card.sparkline, prices.slice(-16).map((point) => point.close));
  assert.deepEqual(card.performance["5d"], { amount: 5, percent: 4.39 });
  assert.deepEqual(card.performance["10d"], { amount: 10, percent: 9.17 });
  assert.deepEqual(card.performance["15d"], { amount: 15, percent: 14.42 });
});

test("longbridge daily candles are cached for the current local day", async () => {
  let calls = 0;
  let currentTime = new Date("2024-03-10T10:00:00");
  const fakeContext = {
    async candlesticks() {
      calls += 1;
      return [
        { timestamp: 1710000000, open: "100", high: "102", low: "99", close: "101", volume: 10 }
      ];
    }
  };
  const options = {
    getStatus: () => ({ configured: true, tokenExists: true }),
    getContext: async () => fakeContext,
    now: () => currentTime
  };

  const first = await fetchLongbridgeCandlesticks(["NVDA"], 90, options);
  const second = await fetchLongbridgeCandlesticks(["NVDA"], 90, options);
  currentTime = new Date("2024-03-11T10:00:00");
  const third = await fetchLongbridgeCandlesticks(["NVDA"], 90, options);

  assert.equal(calls, 2);
  assert.equal(first.get("NVDA").at(-1).close, 101);
  assert.equal(second.get("NVDA").at(-1).close, 101);
  assert.equal(third.get("NVDA").at(-1).close, 101);
});
