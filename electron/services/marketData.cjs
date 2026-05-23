const { loadDotEnv } = require("./env.cjs");
const path = require("node:path");
const https = require("node:https");
const { Period, AdjustType, TradeSessions, CalcIndex } = require("longbridge");
const { defaultWatchlist } = require("./watchlist.cjs");
const {
  getLongbridgeFundamentalContext,
  getLongbridgeQuoteContext,
  getLongbridgeStatus
} = require("./longbridgeClient.cjs");

loadDotEnv(path.join(__dirname, "../.."));

const LONGBRIDGE_DAILY_CANDLE_COUNT = 90;
const longbridgeCandlestickCache = new Map();
const LONG_BRIDGE_CALC_INDEXES = [
  CalcIndex.LastDone,
  CalcIndex.ChangeValue,
  CalcIndex.ChangeRate,
  CalcIndex.Volume,
  CalcIndex.Turnover,
  CalcIndex.YtdChangeRate,
  CalcIndex.TurnoverRate,
  CalcIndex.TotalMarketValue,
  CalcIndex.CapitalFlow,
  CalcIndex.Amplitude,
  CalcIndex.VolumeRatio,
  CalcIndex.PeTtmRatio,
  CalcIndex.PbRatio,
  CalcIndex.DividendRatioTtm,
  CalcIndex.FiveDayChangeRate,
  CalcIndex.TenDayChangeRate,
  CalcIndex.HalfYearChangeRate,
  CalcIndex.FiveMinutesChangeRate
];

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
    calcInfo: null,
    ratings: null,
    staticInfo: {
      symbol: toLongbridgeSymbol(normalized),
      nameEn: `${normalized} Inc.`,
      nameCn: "",
      nameHk: "",
      exchange: "US",
      currency: "USD",
      lotSize: 1,
      totalShares: null,
      circulatingShares: null,
      hkShares: null,
      eps: null,
      epsTtm: null,
      bps: null,
      dividendYield: null,
      stockDerivatives: [],
      board: "USMain"
    },
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

function normalizeLongbridgeStaticInfo(info) {
  if (!info) {
    return null;
  }

  const toText = (value) => (
    value === undefined || value === null || value === "" ? null : String(value)
  );
  const toInteger = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const stockDerivatives = info.stockDerivatives ?? info.stock_derivatives;

  return {
    symbol: toText(info.symbol),
    nameCn: toText(info.nameCn ?? info.name_cn),
    nameEn: toText(info.nameEn ?? info.name_en),
    nameHk: toText(info.nameHk ?? info.name_hk),
    listingDate: toText(info.listingDate ?? info.listing_date),
    exchange: toText(info.exchange),
    currency: toText(info.currency),
    lotSize: toInteger(info.lotSize ?? info.lot_size),
    totalShares: toInteger(info.totalShares ?? info.total_shares),
    circulatingShares: toInteger(info.circulatingShares ?? info.circulating_shares),
    hkShares: toInteger(info.hkShares ?? info.hk_shares),
    eps: toText(info.eps),
    epsTtm: toText(info.epsTtm ?? info.eps_ttm),
    bps: toText(info.bps),
    dividendYield: toText(info.dividendYield ?? info.dividend_yield),
    stockDerivatives: Array.isArray(stockDerivatives)
      ? stockDerivatives.map(Number).filter(Number.isFinite)
      : [],
    board: toText(info.board)
  };
}

function normalizeLongbridgeStaticResponse(response) {
  const list = Array.isArray(response)
    ? response
    : Array.isArray(response?.secuStaticInfo)
      ? response.secuStaticInfo
      : Array.isArray(response?.secu_static_info)
        ? response.secu_static_info
        : response
          ? [response]
          : [];

  return list.map(normalizeLongbridgeStaticInfo).filter(Boolean);
}

function normalizeLongbridgeCalcInfo(info) {
  if (!info) {
    return null;
  }

  const toText = (value) => (
    value === undefined || value === null || value === "" ? null : String(value)
  );
  const toInteger = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  return {
    symbol: toText(info.symbol),
    lastDone: toText(info.lastDone ?? info.last_done),
    changeValue: toText(info.changeValue ?? info.change_val),
    changeRate: toText(info.changeRate ?? info.change_rate),
    volume: toInteger(info.volume),
    turnover: toText(info.turnover),
    ytdChangeRate: toText(info.ytdChangeRate ?? info.ytd_change_rate),
    turnoverRate: toText(info.turnoverRate ?? info.turnover_rate),
    totalMarketValue: toText(info.totalMarketValue ?? info.total_market_value),
    capitalFlow: toText(info.capitalFlow ?? info.capital_flow),
    amplitude: toText(info.amplitude),
    volumeRatio: toText(info.volumeRatio ?? info.volume_ratio),
    peTtmRatio: toText(info.peTtmRatio ?? info.pe_ttm_ratio),
    pbRatio: toText(info.pbRatio ?? info.pb_ratio),
    eps: toText(info.eps),
    dividendRatioTtm: toText(info.dividendRatioTtm ?? info.dividend_ratio_ttm),
    fiveDayChangeRate: toText(info.fiveDayChangeRate ?? info.five_day_change_rate),
    tenDayChangeRate: toText(info.tenDayChangeRate ?? info.ten_day_change_rate),
    halfYearChangeRate: toText(info.halfYearChangeRate ?? info.half_year_change_rate),
    fiveMinutesChangeRate: toText(info.fiveMinutesChangeRate ?? info.five_minutes_change_rate)
  };
}

function normalizeLongbridgeCalcResponse(response) {
  const list = Array.isArray(response)
    ? response
    : Array.isArray(response?.securityCalcIndex)
      ? response.securityCalcIndex
      : Array.isArray(response?.security_calc_index)
        ? response.security_calc_index
        : response
          ? [response]
          : [];

  return list.map(normalizeLongbridgeCalcInfo).filter(Boolean);
}

function unwrapFundamentalData(response) {
  return response?.data ?? response ?? null;
}

function normalizeLongbridgeAnalystRatings(response) {
  const info = unwrapFundamentalData(response);
  if (!info) {
    return null;
  }

  const toText = (value) => (
    value === undefined || value === null || value === "" ? null : String(value)
  );
  const toInteger = (value) => {
    const number = Number(value);
    return Number.isInteger(number) ? number : null;
  };

  return {
    industryName: toText(info.industryName ?? info.industry_name),
    industryRank: toInteger(info.industryRank ?? info.industry_rank),
    multiLetter: toText(info.multiLetter ?? info.multi_letter),
    multiScore: toText(info.multiScore ?? info.multi_score),
    multiScoreChange: toInteger(info.multiScoreChange ?? info.multi_score_change),
    scaleName: toText(info.scaleTxtName ?? info.scale_txt_name),
    styleName: toText(info.styleTxtName ?? info.style_txt_name),
    reportPeriod: toText(info.reportPeriodTxt ?? info.report_period_txt),
    ratingsJson: toText(info.ratingsJson ?? info.ratings_json)
  };
}

function normalizeLongbridgeInstitutionRating(response) {
  const info = unwrapFundamentalData(response);
  if (!info) {
    return null;
  }

  const toText = (value) => (
    value === undefined || value === null || value === "" ? null : String(value)
  );
  const toInteger = (value) => {
    const number = Number(value);
    return Number.isInteger(number) ? number : null;
  };
  const normalizeEvaluate = (value) => {
    if (!value) {
      return null;
    }

    return {
      buy: toInteger(value.buy),
      hold: toInteger(value.hold),
      sell: toInteger(value.sell),
      over: toInteger(value.over),
      under: toInteger(value.under),
      noOpinion: toInteger(value.noOpinion ?? value.no_opinion),
      total: toInteger(value.total),
      startDate: toText(value.startDate ?? value.start_date),
      endDate: toText(value.endDate ?? value.end_date)
    };
  };
  const normalizeTarget = (value) => {
    if (!value) {
      return null;
    }

    if (typeof value === "string" || typeof value === "number") {
      return {
        averageTarget: toText(value),
        highestPrice: null,
        lowestPrice: null,
        previousClose: null,
        startDate: null,
        endDate: null
      };
    }

    return {
      averageTarget: toText(value.averageTarget ?? value.average_target),
      highestPrice: toText(value.highestPrice ?? value.highest_price),
      lowestPrice: toText(value.lowestPrice ?? value.lowest_price),
      previousClose: toText(value.prevClose ?? value.prev_close),
      startDate: toText(value.startDate ?? value.start_date),
      endDate: toText(value.endDate ?? value.end_date)
    };
  };

  return {
    latest: info.latest ? {
      evaluate: normalizeEvaluate(info.latest.evaluate),
      industryName: toText(info.latest.industryName ?? info.latest.industry_name),
      industryRank: toInteger(info.latest.industryRank ?? info.latest.industry_rank),
      industryTotal: toInteger(info.latest.industryTotal ?? info.latest.industry_total),
      industryMean: toInteger(info.latest.industryMean ?? info.latest.industry_mean),
      industryMedian: toInteger(info.latest.industryMedian ?? info.latest.industry_median),
      target: normalizeTarget(info.latest.target)
    } : null,
    summary: info.summary ? {
      recommend: toText(info.summary.recommend),
      change: toText(info.summary.change),
      currencySymbol: toText(info.summary.ccySymbol ?? info.summary.ccy_symbol),
      updatedAt: toText(info.summary.updatedAt ?? info.summary.updated_at),
      evaluate: normalizeEvaluate(info.summary.evaluate),
      target: normalizeTarget(info.summary.target)
    } : null
  };
}

async function fetchLongbridgeRatings(symbols, options = {}) {
  const {
    getStatus = getLongbridgeStatus,
    getContext = getLongbridgeFundamentalContext
  } = options;
  const normalized = [...new Set(symbols.map((symbol) => String(symbol || "").trim().toUpperCase()).filter(Boolean))];
  if (normalized.length === 0 || process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES === "1") {
    return new Map();
  }

  const status = getStatus();
  if (!status.configured || !status.tokenExists) {
    return new Map();
  }

  try {
    const ctx = await getContext();
    const entries = await Promise.all(normalized.map(async (symbol) => {
      const longbridgeSymbol = toLongbridgeSymbol(symbol);
      const [analystResponse, institutionResponse] = await Promise.all([
        ctx.ratings(longbridgeSymbol),
        ctx.institutionRating(longbridgeSymbol)
      ]);

      return [
        symbol,
        {
          analyst: normalizeLongbridgeAnalystRatings(analystResponse),
          institution: normalizeLongbridgeInstitutionRating(institutionResponse)
        }
      ];
    }));

    return new Map(entries);
  } catch (error) {
    console.warn("[longbridge:ratings] unavailable", formatLongbridgeErrorDetail(error));
    return new Map();
  }
}

async function fetchLongbridgeStaticInfo(symbols, options = {}) {
  const {
    getStatus = getLongbridgeStatus,
    getContext = getLongbridgeQuoteContext
  } = options;
  const normalized = [...new Set(symbols.map((symbol) => String(symbol || "").trim().toUpperCase()).filter(Boolean))];
  if (normalized.length === 0 || process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES === "1") {
    return new Map();
  }

  const status = getStatus();
  if (!status.configured || !status.tokenExists) {
    return new Map();
  }

  try {
    const ctx = await getContext();
    const response = await ctx.staticInfo(normalized.map(toLongbridgeSymbol));
    const infos = normalizeLongbridgeStaticResponse(response);
    return new Map(infos.map((info) => [fromLongbridgeSymbol(info.symbol), info]));
  } catch (error) {
    console.warn("[longbridge:static] unavailable", formatLongbridgeErrorDetail(error));
    return new Map();
  }
}

async function fetchLongbridgeCalcIndexes(symbols, options = {}) {
  const {
    getStatus = getLongbridgeStatus,
    getContext = getLongbridgeQuoteContext
  } = options;
  const normalized = [...new Set(symbols.map((symbol) => String(symbol || "").trim().toUpperCase()).filter(Boolean))];
  if (normalized.length === 0 || process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES === "1") {
    return new Map();
  }

  const status = getStatus();
  if (!status.configured || !status.tokenExists) {
    return new Map();
  }

  try {
    const ctx = await getContext();
    const response = await ctx.calcIndexes(normalized.map(toLongbridgeSymbol), LONG_BRIDGE_CALC_INDEXES);
    const infos = normalizeLongbridgeCalcResponse(response);
    return new Map(infos.map((info) => [fromLongbridgeSymbol(info.symbol), info]));
  } catch (error) {
    console.warn("[longbridge:calc-index] unavailable", formatLongbridgeErrorDetail(error));
    return new Map();
  }
}

function candlestickTimestampToDate(timestamp) {
  if (timestamp instanceof Date) {
    return timestamp.toISOString().slice(0, 10);
  }

  const numeric = Number(timestamp);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000).toISOString().slice(0, 10);
  }

  return null;
}

function candlestickToPrice(candlestick) {
  const date = candlestickTimestampToDate(candlestick?.timestamp ?? candlestick?.t);
  const close = decimalToNumber(candlestick?.close);
  const open = decimalToNumber(candlestick?.open);
  const high = decimalToNumber(candlestick?.high);
  const low = decimalToNumber(candlestick?.low);

  if (!date || !Number.isFinite(close)) {
    return null;
  }

  return {
    date,
    open: Number.isFinite(open) ? open : close,
    high: Number.isFinite(high) ? high : close,
    low: Number.isFinite(low) ? low : close,
    close,
    volume: Number(candlestick?.volume ?? 0),
    turnover: decimalToNumber(candlestick?.turnover)
  };
}

function candlesticksToPrices(candlesticks) {
  return (Array.isArray(candlesticks) ? candlesticks : [])
    .map(candlestickToPrice)
    .filter(Boolean)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function summarizeCandlestickPrices(prices) {
  if (!Array.isArray(prices) || prices.length === 0) {
    return { count: 0 };
  }

  const first = prices[0];
  const last = prices[prices.length - 1];
  return {
    count: prices.length,
    firstDate: first.date,
    firstClose: first.close,
    lastDate: last.date,
    lastClose: last.close
  };
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLongbridgeCandlestickCacheKey({ symbol, count, cacheDate }) {
  return [
    toLongbridgeSymbol(symbol),
    "Period.Day",
    count,
    "AdjustType.NoAdjust",
    "TradeSessions.Intraday",
    cacheDate
  ].join("|");
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

async function fetchLongbridgeCandlesticks(symbols, count = LONGBRIDGE_DAILY_CANDLE_COUNT, options = {}) {
  const {
    getStatus = getLongbridgeStatus,
    getContext = getLongbridgeQuoteContext,
    now = () => new Date()
  } = options;
  const normalized = [...new Set(symbols.map((symbol) => String(symbol || "").trim().toUpperCase()).filter(Boolean))];
  if (normalized.length === 0 || process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES === "1") {
    console.info("[longbridge:kline] skipped", {
      reason: normalized.length === 0 ? "empty symbols" : "disabled by TRADE_ASSISTANT_DISABLE_LONGBRIDGE_QUOTES",
      symbols: normalized,
      count
    });
    return new Map();
  }

  const cacheDisabled = process.env.TRADE_ASSISTANT_DISABLE_LONGBRIDGE_KLINE_CACHE === "1";
  const cacheDate = getLocalDateKey(now());
  const result = new Map();
  const misses = [];

  for (const symbol of normalized) {
    const cacheKey = getLongbridgeCandlestickCacheKey({ symbol, count, cacheDate });
    const cached = cacheDisabled ? null : longbridgeCandlestickCache.get(cacheKey);
    if (cached) {
      console.info("[longbridge:kline] cache hit", {
        symbol: toLongbridgeSymbol(symbol),
        requestCount: count,
        cacheDate,
        cachedBars: cached.length,
        summary: summarizeCandlestickPrices(cached)
      });
      result.set(symbol, cached);
    } else {
      console.info("[longbridge:kline] cache miss", {
        symbol: toLongbridgeSymbol(symbol),
        count,
        cacheDate,
        cacheDisabled
      });
      misses.push({ symbol, cacheKey });
    }
  }

  if (misses.length === 0) {
    return result;
  }

  const status = getStatus();
  if (!status.configured || !status.tokenExists) {
    console.info("[longbridge:kline] skipped", {
      reason: !status.configured ? "missing LONGBRIDGE_CLIENT_ID" : "missing stored OAuth token",
      configured: status.configured,
      tokenExists: status.tokenExists,
      tokenPath: status.tokenPath,
      symbols: normalized,
      count
    });
    return new Map();
  }

  try {
    const ctx = await getContext();
    console.info("[longbridge:kline] request", {
      symbols: misses.map((item) => toLongbridgeSymbol(item.symbol)),
      period: "Day",
      count,
      adjustType: "NoAdjust",
      tradeSession: "Intraday"
    });
    const entries = await Promise.all(misses.map(async ({ symbol, cacheKey }) => {
      const longbridgeSymbol = toLongbridgeSymbol(symbol);
      const response = await ctx.candlesticks(
        longbridgeSymbol,
        Period.Day,
        count,
        AdjustType.NoAdjust,
        TradeSessions.Intraday
      );
      const rawCandlesticks = Array.isArray(response) ? response : response?.candlesticks;
      const prices = candlesticksToPrices(rawCandlesticks);
      console.info("[longbridge:kline] response", {
        symbol: longbridgeSymbol,
        rawCount: Array.isArray(rawCandlesticks) ? rawCandlesticks.length : 0,
        ...summarizeCandlestickPrices(prices)
      });
      if (!cacheDisabled) {
        longbridgeCandlestickCache.set(cacheKey, prices);
      }
      return [symbol, prices];
    }));

    for (const [symbol, prices] of entries) {
      result.set(symbol, prices);
    }

    return result;
  } catch (error) {
    console.warn("[longbridge:kline] unavailable", formatLongbridgeErrorDetail(error));
    return result;
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

function formatLongbridgeErrorDetail(error) {
  if (!error || typeof error !== "object") {
    return formatFinnhubError(error);
  }

  const detail = {
    name: error.name,
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    businessCode: error.businessCode,
    data: error.data,
    cause: error.cause?.message ?? error.cause
  };
  const compact = Object.fromEntries(
    Object.entries(detail).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );

  return Object.keys(compact).length > 0 ? compact : formatFinnhubError(error);
}

async function getDashboard(symbol = "NVDA") {
  const [quotes, candlesBySymbol, staticInfoBySymbol, calcInfoBySymbol, ratingsBySymbol] = await Promise.all([
    fetchLongbridgeQuotes([symbol]),
    fetchLongbridgeCandlesticks([symbol]),
    fetchLongbridgeStaticInfo([symbol]),
    fetchLongbridgeCalcIndexes([symbol]),
    fetchLongbridgeRatings([symbol])
  ]);
  const normalized = String(symbol || "NVDA").trim().toUpperCase();
  const quote = quotes[0];
  const prices = candlesBySymbol.get(normalized) ?? [];
  const staticInfo = staticInfoBySymbol.get(normalized) ?? null;
  const calcInfo = calcInfoBySymbol.get(normalized) ?? null;
  const ratings = ratingsBySymbol.get(normalized) ?? null;

  if (quote || prices.length > 0 || staticInfo || calcInfo || ratings) {
    return {
      ...buildDashboardFromLongbridgeQuote(symbol, quote, prices, staticInfo, calcInfo),
      ratings
    };
  }

  return buildFallbackDashboard(symbol);
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

function makeMarketCard({ symbol, name, kind, base }, quote = null, pricesOverride = null) {
  const prices = Array.isArray(pricesOverride) && pricesOverride.length > 0
    ? pricesOverride
    : buildSeries(symbol, 30, base);
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

function buildDashboardFromLongbridgeQuote(symbol, quote, candlestickPrices = null, staticInfo = null, calcInfo = null) {
  const dashboard = buildFallbackDashboard(symbol);
  const fields = quoteFieldsFromLongbridgeQuote(quote) || {};
  const normalizedStaticInfo = normalizeLongbridgeStaticInfo(staticInfo);
  const normalizedCalcInfo = normalizeLongbridgeCalcInfo(calcInfo);
  const normalized = String(symbol || fields.symbol || fromLongbridgeSymbol(normalizedStaticInfo?.symbol) || dashboard.symbol).trim().toUpperCase();
  const longbridgePrices = Array.isArray(candlestickPrices) && candlestickPrices.length > 0
    ? candlestickPrices
    : null;
  const lastCandleClose = longbridgePrices?.at(-1)?.close;
  const previousCandleClose = longbridgePrices?.at(-2)?.close;
  const price = Number(fields.c ?? lastCandleClose ?? dashboard.quote.price);
  const previousClose = Number(fields.pc ?? previousCandleClose ?? dashboard.quote.previousClose ?? price);
  const changeAmount = Number(fields.d ?? (price - previousClose));
  const changePercent = Number(fields.dp ?? (previousClose === 0 ? 0 : (changeAmount / previousClose) * 100));
  const updatedAt = fields.updatedAt || new Date().toISOString();

  const prices = longbridgePrices ?? (dashboard.prices.length
    ? [
      ...dashboard.prices.slice(0, -1),
      {
        ...dashboard.prices[dashboard.prices.length - 1],
        close: Number(price.toFixed(2))
      }
    ]
    : dashboard.prices);

  return {
    ...dashboard,
    symbol: normalized,
    staticInfo: normalizedStaticInfo ?? dashboard.staticInfo,
    calcInfo: normalizedCalcInfo,
    quote: {
      ...dashboard.quote,
      name: normalizedStaticInfo?.nameCn ?? normalizedStaticInfo?.nameEn ?? dashboard.quote.name,
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
  const watchlistDefinitions = watchlistItems
    .map(toStockDefinition)
    .filter((item) => item.symbol);

  const watchlistSymbols = watchlistDefinitions.map((item) => item.symbol);
  const [longbridgeQuotes, candlesBySymbol] = await Promise.all([
    fetchLongbridgeQuotes(watchlistSymbols),
    fetchLongbridgeCandlesticks(watchlistSymbols)
  ]);
  const quoteBySymbol = new Map(longbridgeQuotes.map((quote) => [
    fromLongbridgeSymbol(quote.symbol),
    quoteFieldsFromLongbridgeQuote(quote)
  ]));
  const watchlist = watchlistDefinitions.map((definition) => (
    makeMarketCard(definition, quoteBySymbol.get(definition.symbol), candlesBySymbol.get(definition.symbol))
  ));

  return {
    updatedAt: new Date().toISOString(),
    indexes: [],
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
  candlesticksToPrices,
  fetchLongbridgeCalcIndexes,
  fetchLongbridgeCandlesticks,
  fetchLongbridgeRatings,
  fetchLongbridgeStaticInfo,
  fetchLongbridgeQuotes,
  getDashboard,
  getFinnhubClient,
  getFinnhubApiKey,
  getMarketOverview,
  makeMarketCard,
  fetchUsSymbols
};
