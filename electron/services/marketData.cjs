const { loadDotEnv } = require("./env.cjs");
const path = require("node:path");
const https = require("node:https");
const { defaultWatchlist } = require("./watchlist.cjs");
const { getLongbridgeQuoteContext, getLongbridgeStatus } = require("./longbridgeClient.cjs");

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
  return apiKey ? { apiKey } : null;
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

function requestFinnhub(pathname, params = {}, { timeout = 20_000 } = {}) {
  const apiKey = getFinnhubApiKey();
  if (!apiKey) {
    return Promise.resolve(null);
  }

  const url = new URL(pathname.replace(/^\/+/, ""), "https://finnhub.io/api/v1/");
  Object.entries({ ...params, token: apiKey }).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  return requestJson(url, { timeout });
}

function requestJson(url, { timeout, redirectsLeft = 4, headers = {} }) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      timeout,
      headers: {
        accept: "application/json",
        "user-agent": "trade-assistant/0.1",
        ...headers
      }
    }, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        if (redirectsLeft <= 0) {
          reject(new Error("Finnhub redirect limit exceeded"));
          return;
        }

        requestJson(new URL(response.headers.location, url), {
          timeout,
          redirectsLeft: redirectsLeft - 1,
          headers
        }).then(resolve, reject);
        return;
      }

      const chunks = [];

      response.on("data", (chunk) => {
        chunks.push(chunk);
      });

      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let data = text;

        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }

        if (response.statusCode && response.statusCode >= 400) {
          const error = new Error(`Finnhub request failed: ${response.statusCode}`);
          error.statusCode = response.statusCode;
          error.data = data;
          reject(error);
          return;
        }

        resolve(data);
      });
    });

    request.on("timeout", () => {
      request.destroy(new Error("Finnhub request timed out"));
    });

    request.on("error", reject);
  });
}

function callFinnhub(method, ...args) {
  if (method === "quote") {
    return requestFinnhub("/quote", { symbol: args[0] }, { timeout: 20_000 });
  }

  if (method === "stockSymbols") {
    const [exchange, opts = {}] = args;
    return requestFinnhub("/stock/symbol", {
      exchange,
      mic: opts.mic,
      securityType: opts.securityType,
      currency: opts.currency
    }, { timeout: 30_000 });
  }

  return Promise.reject(new Error(`Unsupported Finnhub method: ${method}`));
}

async function callFinnhubWithRetry(method, ...args) {
  try {
    return await callFinnhub(method, ...args);
  } catch (error) {
    if (!["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"].includes(error?.code)) {
      throw error;
    }

    return callFinnhub(method, ...args);
  }
}

function withTimeout(promise, milliseconds, message) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function toLongbridgeSymbol(symbol) {
  const normalized = String(symbol || "").trim().toUpperCase();
  if (!normalized) {
    return "";
  }

  return normalized.includes(".") ? normalized : `${normalized}.US`;
}

function fromLongbridgeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/\.US$/, "");
}

function decimalToNumber(value) {
  if (value === undefined || value === null) {
    return NaN;
  }

  return Number(value);
}

function quoteTimestampToIso(timestamp) {
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  const numeric = Number(timestamp);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000).toISOString();
  }

  return new Date().toISOString();
}

function quoteFieldsFromLongbridgeQuote(quote) {
  if (!quote) {
    return null;
  }

  const currentPrice = decimalToNumber(quote.lastDone ?? quote.last_done);
  const previousClose = decimalToNumber(quote.prevClose ?? quote.prev_close);
  if (!Number.isFinite(currentPrice) || !Number.isFinite(previousClose)) {
    return null;
  }

  const changeAmount = currentPrice - previousClose;
  const changePercent = previousClose === 0 ? 0 : (changeAmount / previousClose) * 100;
  const timestamp = quote.timestamp ?? quote.t;

  return {
    symbol: fromLongbridgeSymbol(quote.symbol),
    c: currentPrice,
    pc: previousClose,
    d: changeAmount,
    dp: changePercent,
    t: timestamp instanceof Date ? Math.floor(timestamp.getTime() / 1000) : timestamp,
    updatedAt: quoteTimestampToIso(timestamp)
  };
}

async function fetchLongbridgeQuotes(symbols) {
  const normalized = [...new Set(symbols.map((symbol) => String(symbol || "").trim().toUpperCase()).filter(Boolean))];
  if (normalized.length === 0 || process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES === "1") {
    return [];
  }

  const status = getLongbridgeStatus();
  if (!status.configured || !status.tokenExists) {
    return [];
  }

  try {
    const ctx = await getLongbridgeQuoteContext();
    const quotes = await ctx.quote(normalized.map(toLongbridgeSymbol));
    return Array.isArray(quotes) ? quotes : [quotes];
  } catch (error) {
    console.warn("Longbridge quote unavailable:", formatFinnhubError(error));
    return [];
  }
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
  const quote = (await fetchLongbridgeQuotes([symbol]))[0];
  return quote ? buildDashboardFromLongbridgeQuote(symbol, quote) : buildFallbackDashboard(symbol);
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
  const updatedAt = Number(quote?.t)
    ? new Date(Number(quote.t) * 1000).toISOString()
    : new Date().toISOString();

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
    updatedAt,
    sparkline: prices.slice(-16).map((point) => point.close)
  };
}

function buildDashboardFromLongbridgeQuote(symbol, quote) {
  const dashboard = buildFallbackDashboard(symbol);
  const fields = quoteFieldsFromLongbridgeQuote(quote) || {};
  const normalized = String(symbol || fields.symbol || dashboard.symbol).trim().toUpperCase();
  const price = Number(fields.c ?? dashboard.quote.price);
  const previousClose = Number(fields.pc ?? dashboard.quote.previousClose ?? price);
  const changeAmount = Number(fields.d ?? (price - previousClose));
  const changePercent = Number(fields.dp ?? (previousClose === 0 ? 0 : (changeAmount / previousClose) * 100));
  const updatedAt = fields.updatedAt || new Date().toISOString();

  const prices = dashboard.prices.length
    ? [
      ...dashboard.prices.slice(0, -1),
      {
        ...dashboard.prices[dashboard.prices.length - 1],
        close: Number(price.toFixed(2))
      }
    ]
    : dashboard.prices;

  return {
    ...dashboard,
    symbol: normalized,
    quote: {
      ...dashboard.quote,
      price: Number(price.toFixed(2)),
      changeAmount: Number(changeAmount.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      previousClose: Number(previousClose.toFixed(2)),
      updatedAt
    },
    prices
  };
}

function baseForSymbol(symbol) {
  const random = makeRandom(`base:${symbol}`);
  return 80 + random() * 520;
}

function toStockDefinition(item) {
  const symbol = String(item?.symbol || "").trim().toUpperCase();
  return {
    symbol,
    name: String(item?.name || symbol).trim() || symbol,
    kind: "stock",
    base: baseForSymbol(symbol)
  };
}

async function getMarketOverview(watchlistItems = defaultWatchlist) {
  const indexDefinitions = [
    { symbol: "IXIC", name: "Nasdaq Composite", kind: "index", base: 18940 },
    { symbol: "DJI", name: "Dow Jones Industrial Average", kind: "index", base: 42112 },
    { symbol: "SPX", name: "S&P 500", kind: "index", base: 5824 }
  ];

  const watchlistDefinitions = watchlistItems
    .map(toStockDefinition)
    .filter((item) => item.symbol);

  const longbridgeQuotes = await fetchLongbridgeQuotes(watchlistDefinitions.map((item) => item.symbol));
  const quoteBySymbol = new Map(longbridgeQuotes.map((quote) => [
    fromLongbridgeSymbol(quote.symbol),
    quoteFieldsFromLongbridgeQuote(quote)
  ]));
  const indexes = indexDefinitions.map(makeMarketCard);
  const watchlist = watchlistDefinitions.map((definition) => (
    makeMarketCard(definition, quoteBySymbol.get(definition.symbol))
  ));

  return {
    updatedAt: new Date().toISOString(),
    indexes,
    watchlist,
    macro: []
  };
}

async function fetchUsSymbols() {
  if (!getFinnhubApiKey()) {
    return [];
  }

  try {
    const payload = await withTimeout(
      callFinnhubWithRetry("stockSymbols", "US", {}),
      35_000,
      "Finnhub US symbols timed out"
    );
    const mapped = Array.isArray(payload)
      ? payload
        .map((item) => ({
          symbol: String(item.displaySymbol || item.symbol || "").trim().toUpperCase(),
          name: String(item.description || "").trim(),
          type: String(item.type || "").trim()
        }))
        .filter((item) => item.symbol && item.name)
      : [];

    return mapped;
  } catch (error) {
    console.warn("Finnhub US symbols unavailable:", formatFinnhubError(error));
    return [];
  }
}

module.exports = {
  buildDashboardFromFinnhub,
  buildDashboardFromLongbridgeQuote,
  fetchLongbridgeQuotes,
  getDashboard,
  getFinnhubClient,
  getFinnhubApiKey,
  getMarketOverview,
  fetchUsSymbols
};
