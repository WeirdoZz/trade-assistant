const { loadDotEnv } = require("./env.cjs");
const path = require("node:path");
const finnhub = require("finnhub");

loadDotEnv(path.join(__dirname, "../.."));

function makeRandom(seedText) {
  let seed = 0;
  for (let index = 0; index < seedText.length; index += 1) {
    seed = (seed * 31 + seedText.charCodeAt(index)) >>> 0;
  }

  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getFinnhubApiKey() {
  return ((process.env.FINNHUB_API_KEY || process.env.FINNHU_API_KEY || "").trim());
}

function getFinnhubClient(apiKey = getFinnhubApiKey()) {
  return apiKey ? new finnhub.DefaultApi(apiKey) : null;
}

function buildFallbackDashboard(symbol = "NVDA") {
  const normalized = String(symbol || "NVDA").trim().toUpperCase();
  const random = makeRandom(normalized);
  const start = addDays(new Date(), -120);
  const base = 140 + random() * 160;
  const prices = [];

  for (let index = 0; index <= 120; index += 1) {
    const current = addDays(start, index);
    const drift = index * (0.22 + random() * 0.02);
    const cycle = Math.sin(index / 7) * 7.5;
    const noise = random() * 8.4 - 4.2;
    const close = Number((base + drift + cycle + noise).toFixed(2));
    const volume = Math.floor(28_000_000 + random() * 75_000_000);

    prices.push({
      date: current.toISOString().slice(0, 10),
      close,
      volume
    });
  }

  const lastClose = prices[prices.length - 1].close;
  const previousClose = prices[prices.length - 2].close;
  const changePercent = Number((((lastClose - previousClose) / previousClose) * 100).toFixed(2));

  return {
    symbol: normalized,
    quote: {
      name: `${normalized} Inc.`,
      price: lastClose,
      changeAmount: Number((lastClose - previousClose).toFixed(2)),
      changePercent,
      previousClose,
      market: "US",
      updatedAt: new Date().toISOString().slice(0, 10)
    },
    prices,
    signals: [
      { label: "趋势强度", value: "偏强", score: 78 },
      { label: "消息情绪", value: "谨慎乐观", score: 64 },
      { label: "期权异动", value: "Call 放量", score: 71 },
      { label: "波动风险", value: "中高", score: 58 }
    ],
    news: [
      {
        title: `${normalized} 近月营收预期被上调，机构关注 AI 与云端支出`,
        source: "Market Wire",
        time: "2 小时前",
        sentiment: "positive"
      },
      {
        title: "美债收益率回落，成长股估值压力短线缓解",
        source: "Macro Desk",
        time: "5 小时前",
        sentiment: "neutral"
      },
      {
        title: `${normalized} 本周看涨期权成交量高于 30 日均值`,
        source: "Options Flow",
        time: "昨天",
        sentiment: "positive"
      }
    ],
    analysis: {
      stance: "观察偏多",
      buyZone: `${(lastClose * 0.96).toFixed(2)} - ${(lastClose * 0.985).toFixed(2)}`,
      sellZone: `${(lastClose * 1.08).toFixed(2)} - ${(lastClose * 1.14).toFixed(2)}`,
      risk: `若跌破 ${(lastClose * 0.93).toFixed(2)}，短线趋势可能转弱。`,
      summary: "占位分析：价格维持上行通道，成交量未出现明显背离，新闻与期权流目前偏正面。接入长桥数据后，这里会输出可追溯的综合研判。"
    }
  };
}

function buildDashboardFromFinnhub(symbol, { quote }) {
  const normalized = String(symbol || "NVDA").trim().toUpperCase();
  const fallback = buildFallbackDashboard(normalized);
  const currentPrice = Number(quote?.c ?? fallback.quote.price);
  const previousClose = Number(quote?.pc ?? fallback.quote.previousClose ?? currentPrice);
  const changeAmount = Number(quote?.d ?? (currentPrice - previousClose));
  const changePercent = Number(quote?.dp ?? (previousClose === 0 ? 0 : (changeAmount / previousClose) * 100));
  const updatedAt = new Date(Number(quote?.t ? quote.t * 1000 : Date.now())).toISOString();

  const mergedPrices = fallback.prices.length
    ? [
      ...fallback.prices.slice(0, -1),
      {
        ...fallback.prices.at(-1),
        close: currentPrice,
        volume: fallback.prices.at(-1).volume
      }
    ]
    : [{
      date: updatedAt.slice(0, 10),
      close: currentPrice,
      volume: 0
    }];

  return {
    ...fallback,
    symbol: normalized,
    quote: {
      name: fallback.quote.name,
      price: Number(currentPrice.toFixed(2)),
      changeAmount: Number(changeAmount.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      previousClose: Number(previousClose.toFixed(2)),
      market: "US",
      updatedAt
    },
    prices: mergedPrices
  };
}

function callFinnhub(method, ...args) {
  const client = getFinnhubClient();
  if (!client) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    client[method](...args, (error, data, response) => {
      if (error) {
        reject(error);
        return;
      }

      if (response?.statusCode && response.statusCode >= 400) {
        reject(new Error(`Finnhub ${method} failed: ${response.statusCode}`));
        return;
      }

      resolve(data);
    });
  });
}

async function getFinnhubDashboard(symbol) {
  if (!getFinnhubApiKey()) {
    return null;
  }

  const normalized = String(symbol || "NVDA").trim().toUpperCase();
  const quote = await callFinnhub("quote", normalized);

  return buildDashboardFromFinnhub(normalized, {
    quote
  });
}

function formatFinnhubError(error) {
  if (!error) {
    return "unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  if (error.error) {
    return error.error;
  }

  return JSON.stringify(error);
}

async function getDashboard(symbol = "NVDA") {
  try {
    return await getFinnhubDashboard(symbol) ?? buildFallbackDashboard(symbol);
  } catch (error) {
    console.warn("Finnhub dashboard unavailable, using fallback data:", formatFinnhubError(error));
    return buildFallbackDashboard(symbol);
  }
}

function buildSeries(symbol, days = 30, baseOverride) {
  const normalized = String(symbol || "NVDA").trim().toUpperCase();
  const random = makeRandom(`overview:${normalized}`);
  const start = addDays(new Date(), -days);
  const base = baseOverride ?? (80 + random() * 420);
  const points = [];

  for (let index = 0; index <= days; index += 1) {
    const current = addDays(start, index);
    const drift = index * (0.08 + random() * 0.18);
    const cycle = Math.sin(index / 3.4) * (base * 0.012);
    const noise = (random() - 0.5) * (base * 0.018);
    const close = Number(Math.max(base * 0.2, base + drift + cycle + noise).toFixed(2));

    points.push({
      date: current.toISOString().slice(0, 10),
      close
    });
  }

  return points;
}

function calculateChange(points, period) {
  const last = points[points.length - 1]?.close ?? 0;
  const previous = points[Math.max(0, points.length - 1 - period)]?.close ?? last;
  const amount = Number((last - previous).toFixed(2));
  const percent = previous === 0 ? 0 : Number(((amount / previous) * 100).toFixed(2));

  return { amount, percent };
}

function makeMarketCard({ symbol, name, kind, base }, quote = null) {
  const prices = buildSeries(symbol, 30, base);
  const fallbackLatest = prices[prices.length - 1].close;
  const latest = Number(quote?.c ?? fallbackLatest);
  const previousClose = Number(quote?.pc ?? prices[prices.length - 2]?.close ?? latest);
  const dayAmount = Number(quote?.d ?? (latest - previousClose));
  const dayPercent = Number(quote?.dp ?? (previousClose === 0 ? 0 : (dayAmount / previousClose) * 100));

  return {
    symbol,
    name,
    kind,
    price: Number(latest.toFixed(2)),
    dayChange: {
      amount: Number(dayAmount.toFixed(2)),
      percent: Number(dayPercent.toFixed(2))
    },
    performance: {
      "5d": calculateChange(prices, 5),
      "10d": calculateChange(prices, 10),
      "15d": calculateChange(prices, 15)
    },
    updatedAt: new Date().toISOString().slice(0, 10),
    sparkline: prices.slice(-16).map((point) => point.close)
  };
}

async function buildMarketCardWithQuote(definition) {
  if (!getFinnhubApiKey()) {
    return makeMarketCard(definition);
  }

  try {
    const quote = await callFinnhub("quote", definition.symbol);
    return makeMarketCard(definition, quote);
  } catch (error) {
    console.warn(`Finnhub quote unavailable for ${definition.symbol}, using fallback card:`, formatFinnhubError(error));
    return makeMarketCard(definition);
  }
}

async function getMarketOverview() {
  const indexDefinitions = [
    { symbol: "IXIC", name: "NASDAQ Composite", kind: "index", base: 18940 },
    { symbol: "SPX", name: "S&P 500", kind: "index", base: 5824 },
    { symbol: "DJI", name: "Dow Jones", kind: "index", base: 42112 }
  ];

  const watchlistDefinitions = [
    { symbol: "NVDA", name: "NVIDIA", kind: "stock", base: 213 },
    { symbol: "MSFT", name: "Microsoft", kind: "stock", base: 487 },
    { symbol: "TSLA", name: "Tesla", kind: "stock", base: 178 },
    { symbol: "AMD", name: "AMD", kind: "stock", base: 163 },
    { symbol: "AAPL", name: "Apple", kind: "stock", base: 198 },
    { symbol: "META", name: "Meta Platforms", kind: "stock", base: 642 }
  ];

  const macroDefinitions = [
    { symbol: "XAUUSD", name: "Gold Spot", kind: "macro", base: 2375 },
    { symbol: "WTI", name: "WTI Crude Oil", kind: "macro", base: 78 },
    { symbol: "DXY", name: "US Dollar Index", kind: "macro", base: 104 }
  ];

  const [indexes, watchlist, macro] = await Promise.all([
    Promise.all(indexDefinitions.map(buildMarketCardWithQuote)),
    Promise.all(watchlistDefinitions.map(buildMarketCardWithQuote)),
    Promise.all(macroDefinitions.map(buildMarketCardWithQuote))
  ]);

  return {
    updatedAt: new Date().toISOString(),
    indexes,
    watchlist,
    macro
  };
}

module.exports = {
  buildDashboardFromFinnhub,
  getDashboard,
  getFinnhubClient,
  getFinnhubApiKey,
  getMarketOverview
};
