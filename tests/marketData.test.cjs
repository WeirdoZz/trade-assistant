const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildDashboardFromFinnhub,
  buildDashboardFromLongbridgeQuote,
  candlesticksToPrices,
  fetchAlphaVantageNews,
  fetchLongbridgeCalcIndexes,
  fetchLongbridgeCandlesticks,
  fetchLongbridgeRatings,
  fetchLongbridgeStaticInfo,
  getFinnhubApiKey,
  getMarketOverview,
  getNewsPage,
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

test("alpha vantage news fetch requests 5-day window and returns top 20 by relevance then time", async () => {
  const originalAlpha = process.env.ALPHA_VANTAGE_API_KEY;
  process.env.ALPHA_VANTAGE_API_KEY = "alpha-key";

  try {
    const news = await fetchAlphaVantageNews("AAPL", {
      now: () => new Date("2026-05-23T12:34:00Z"),
      request: async (url) => {
        assert.equal(url.searchParams.get("function"), "NEWS_SENTIMENT");
        assert.equal(url.searchParams.get("tickers"), "AAPL");
        assert.equal(url.searchParams.get("time_from"), "20260518T1234");
        assert.equal(url.searchParams.get("sort"), "RELEVANCE");
        assert.equal(url.searchParams.get("limit"), "50");
        assert.equal(url.searchParams.get("apikey"), "alpha-key");
        return {
          feed: Array.from({ length: 25 }, (_, index) => ({
            title: `Apple news ${index}`,
            url: `https://example.com/aapl-${index}`,
            time_published: index === 2 ? "20260523T153000" : `20260522T${String(1000 + index).padStart(4, "0")}00`,
            source: "Example Wire",
            summary: `Summary ${index}`,
            overall_sentiment_label: "Somewhat-Bullish",
            overall_sentiment_score: "0.236",
            ticker_sentiment: [{
              ticker: "AAPL",
              relevance_score: index === 0 ? "0.95" : index === 1 ? "0.91" : index === 2 ? "0.91" : String(0.9 - index / 100),
              ticker_sentiment_score: "0.42",
              ticker_sentiment_label: "Bullish"
            }]
          }))
        };
      }
    });

    assert.equal(news.length, 20);
    assert.deepEqual(news.slice(0, 3).map((item) => item.title), [
      "Apple news 0",
      "Apple news 2",
      "Apple news 1"
    ]);
    assert.deepEqual(news[0], {
      title: "Apple news 0",
      source: "Example Wire",
      time: "2026-05-22T10:00:00.000Z",
      sentiment: "positive",
      summary: "Summary 0",
      url: "https://example.com/aapl-0",
      sentimentLabel: "Somewhat-Bullish",
      sentimentScore: 0.236,
      tickerSentimentLabel: "Bullish",
      tickerSentimentScore: 0.42,
      relevanceScore: 0.95
    });
  } finally {
    if (originalAlpha === undefined) {
      delete process.env.ALPHA_VANTAGE_API_KEY;
    } else {
      process.env.ALPHA_VANTAGE_API_KEY = originalAlpha;
    }
  }
});

test("news page groups market, macro, topic, and watchlist news", async () => {
  const originalAlpha = process.env.ALPHA_VANTAGE_API_KEY;
  process.env.ALPHA_VANTAGE_API_KEY = "alpha-key";
  const calls = [];
  const request = async (url) => {
    calls.push({
      tickers: url.searchParams.get("tickers"),
      topics: url.searchParams.get("topics")
    });
    const label = url.searchParams.get("tickers") || url.searchParams.get("topics") || "market";
    return {
      feed: [{
        title: `${label} headline`,
        url: `https://example.com/${label}`,
        time_published: "20260523T103000",
        source: "Example Wire",
        summary: `${label} summary`,
        overall_sentiment_label: "Neutral",
        overall_sentiment_score: "0",
        ticker_sentiment: url.searchParams.get("tickers") ? [{
          ticker: url.searchParams.get("tickers"),
          relevance_score: "0.9",
          ticker_sentiment_score: "0.1",
          ticker_sentiment_label: "Neutral"
        }] : []
      }]
    };
  };

  try {
    const page = await getNewsPage([
      { symbol: "AAPL", name: "Apple" },
      { symbol: "NVDA", name: "NVIDIA" }
    ], {
      now: () => new Date("2026-05-24T12:00:00Z"),
      request
    });

    assert.equal(page.market.articles[0].title, "financial_markets headline");
    assert.equal(page.macro.monetary.articles[0].title, "economy_monetary headline");
    assert.ok(page.topics.some((topic) => topic.topic === "technology"));
    assert.deepEqual(page.watchlist.map((item) => item.symbol), ["AAPL"]);
    assert.ok(calls.some((call) => call.topics === "financial_markets"));
    assert.ok(calls.some((call) => call.topics === "economy_monetary"));
    assert.ok(calls.some((call) => call.tickers === "AAPL"));
  } finally {
    if (originalAlpha === undefined) {
      delete process.env.ALPHA_VANTAGE_API_KEY;
    } else {
      process.env.ALPHA_VANTAGE_API_KEY = originalAlpha;
    }
  }
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

test("longbridge dashboard exposes static security info", () => {
  const dashboard = buildDashboardFromLongbridgeQuote("aapl", null, null, {
    symbol: "AAPL.US",
    name_cn: "苹果",
    name_en: "Apple Inc.",
    exchange: "NASD",
    currency: "USD",
    lot_size: 1,
    total_shares: "1631944100",
    circulating_shares: "16302661350",
    eps_ttm: "6.0771",
    dividend_yield: "0.85",
    board: "USMain"
  });

  assert.equal(dashboard.staticInfo.symbol, "AAPL.US");
  assert.equal(dashboard.staticInfo.nameCn, "苹果");
  assert.equal(dashboard.staticInfo.totalShares, 1631944100);
  assert.equal(dashboard.staticInfo.circulatingShares, 16302661350);
  assert.equal(dashboard.quote.name, "苹果");
});

test("longbridge static info fetch maps sdk response by plain symbol", async () => {
  const originalDisableLongbridge = process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;
  delete process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;

  try {
    const result = await fetchLongbridgeStaticInfo(["AAPL"], {
      getStatus: () => ({ configured: true, tokenExists: true }),
      getContext: async () => ({
        staticInfo: async (symbols) => {
          assert.deepEqual(symbols, ["AAPL.US"]);
          return [{
            symbol: "AAPL.US",
            nameEn: "Apple Inc.",
            exchange: "NASD",
            currency: "USD",
            lotSize: 1
          }];
        }
      })
    });

    assert.equal(result.get("AAPL").nameEn, "Apple Inc.");
    assert.equal(result.get("AAPL").lotSize, 1);
  } finally {
    if (originalDisableLongbridge === undefined) {
      delete process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;
    } else {
      process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES = originalDisableLongbridge;
    }
  }
});

test("longbridge calc indexes fetch maps valuation and momentum indexes by plain symbol", async () => {
  const originalDisableLongbridge = process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;
  delete process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;

  try {
    const result = await fetchLongbridgeCalcIndexes(["AAPL"], {
      getStatus: () => ({ configured: true, tokenExists: true }),
      getContext: async () => ({
        calcIndexes: async (symbols, indexes) => {
          assert.deepEqual(symbols, ["AAPL.US"]);
          assert.ok(indexes.includes(7));
          assert.ok(indexes.includes(11));
          assert.ok(indexes.includes(12));
          return [{
            symbol: "AAPL.US",
            totalMarketValue: "2134501670280.00",
            peTtmRatio: "21.26",
            pbRatio: "31.71",
            dividendRatioTtm: "0.64",
            turnoverRate: "0.76",
            ytdChangeRate: "-25.63",
            volumeRatio: "3.22"
          }];
        }
      })
    });

    assert.equal(result.get("AAPL").totalMarketValue, "2134501670280.00");
    assert.equal(result.get("AAPL").peTtmRatio, "21.26");
    assert.equal(result.get("AAPL").pbRatio, "31.71");
    assert.equal(result.get("AAPL").turnoverRate, "0.76");
  } finally {
    if (originalDisableLongbridge === undefined) {
      delete process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;
    } else {
      process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES = originalDisableLongbridge;
    }
  }
});

test("longbridge dashboard exposes calc indexes beside static info", () => {
  const dashboard = buildDashboardFromLongbridgeQuote("aapl", null, null, {
    symbol: "AAPL.US",
    eps_ttm: "6.0771",
    bps: "4.40197"
  }, {
    symbol: "AAPL.US",
    total_market_value: "2134501670280.00",
    pe_ttm_ratio: "21.26",
    pb_ratio: "31.71",
    eps: "6.12",
    dividend_ratio_ttm: "0.64",
    ytd_change_rate: "-25.63"
  });

  assert.equal(dashboard.calcInfo.symbol, "AAPL.US");
  assert.equal(dashboard.calcInfo.totalMarketValue, "2134501670280.00");
  assert.equal(dashboard.calcInfo.peTtmRatio, "21.26");
  assert.equal(dashboard.calcInfo.pbRatio, "31.71");
  assert.equal(dashboard.calcInfo.eps, "6.12");
  assert.equal(dashboard.staticInfo.epsTtm, "6.0771");
});

test("longbridge ratings fetch maps analyst and institution snapshots by plain symbol", async () => {
  const originalDisableLongbridge = process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;
  delete process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;

  try {
    const result = await fetchLongbridgeRatings(["TSLA"], {
      getStatus: () => ({ configured: true, tokenExists: true }),
      getContext: async () => ({
        ratings: async (symbol) => {
          assert.equal(symbol, "TSLA.US");
          return {
            industry_name: "Automobiles",
            industry_rank: 2,
            multi_letter: "B",
            multi_score: "0.32",
            multi_score_change: -1,
            scale_txt_name: "Large",
            style_txt_name: "Blend",
            report_period_txt: "Rating based on Fiscal Year 2026 s.a."
          };
        },
        institutionRating: async (symbol) => {
          assert.equal(symbol, "TSLA.US");
          return {
            latest: {
              evaluate: { buy: 18, hold: 17, sell: 4, total: 51 },
              industry_name: "Automobiles",
              industry_rank: 1,
              industry_total: 30,
              target: {
                highest_price: "600.000",
                lowest_price: "123.000",
                prev_close: "428.35"
              }
            },
            summary: {
              recommend: "Buy",
              ccy_symbol: "$",
              updated_at: "1778198400",
              evaluate: { buy: 18, hold: 17, sell: 4 },
              target: {
                average_target: "350.00",
                highest_price: "600.000",
                lowest_price: "123.000"
              }
            }
          };
        }
      })
    });

    assert.equal(result.get("TSLA").analyst.multiLetter, "B");
    assert.equal(result.get("TSLA").analyst.multiScoreChange, -1);
    assert.equal(result.get("TSLA").institution.summary.recommend, "Buy");
    assert.equal(result.get("TSLA").institution.summary.target.averageTarget, "350.00");
    assert.equal(result.get("TSLA").institution.latest.evaluate.total, 51);
  } finally {
    if (originalDisableLongbridge === undefined) {
      delete process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;
    } else {
      process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES = originalDisableLongbridge;
    }
  }
});

test("longbridge institution rating accepts summary target as a plain string", async () => {
  const originalDisableLongbridge = process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;
  delete process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;

  try {
    const result = await fetchLongbridgeRatings(["AAPL"], {
      getStatus: () => ({ configured: true, tokenExists: true }),
      getContext: async () => ({
        ratings: async () => ({}),
        institutionRating: async () => ({
          summary: {
            recommend: "Buy",
            ccy_symbol: "$",
            target: "350.00"
          }
        })
      })
    });

    assert.equal(result.get("AAPL").institution.summary.target.averageTarget, "350.00");
  } finally {
    if (originalDisableLongbridge === undefined) {
      delete process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;
    } else {
      process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES = originalDisableLongbridge;
    }
  }
});

test("longbridge ratings are cached for the current local day", async () => {
  const originalDisableLongbridge = process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;
  const originalDisableCache = process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_RATINGS_CACHE;
  delete process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;
  delete process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_RATINGS_CACHE;

  let calls = 0;
  let currentTime = new Date("2026-05-23T10:00:00");
  const fakeContext = {
    ratings: async () => {
      calls += 1;
      return { multi_letter: "A" };
    },
    institutionRating: async () => ({
      summary: { recommend: "Buy" }
    })
  };
  const options = {
    getStatus: () => ({ configured: true, tokenExists: true }),
    getContext: async () => fakeContext,
    now: () => currentTime
  };

  try {
    const first = await fetchLongbridgeRatings(["MSFT"], options);
    const second = await fetchLongbridgeRatings(["MSFT"], options);
    currentTime = new Date("2026-05-24T10:00:00");
    const third = await fetchLongbridgeRatings(["MSFT"], options);

    assert.equal(calls, 2);
    assert.equal(first.get("MSFT").analyst.multiLetter, "A");
    assert.equal(second.get("MSFT").institution.summary.recommend, "Buy");
    assert.equal(third.get("MSFT").analyst.multiLetter, "A");
  } finally {
    if (originalDisableLongbridge === undefined) {
      delete process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES;
    } else {
      process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES = originalDisableLongbridge;
    }

    if (originalDisableCache === undefined) {
      delete process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_RATINGS_CACHE;
    } else {
      process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_RATINGS_CACHE = originalDisableCache;
    }
  }
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
