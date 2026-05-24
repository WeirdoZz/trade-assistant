const { loadDotEnv } = require("./env.cjs");
const { defaultWatchlist } = require("./watchlist.cjs");
const path = require("node:path");
const https = require("node:https");

loadDotEnv(path.join(__dirname, "../.."));

const MASSIVE_BASE_URL = "https://api.massive.com";
const OPTIONS_CACHE_TTL_MS = 30 * 60 * 1000;
const optionsHomeCache = new Map();

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

function getMassiveApiKey() {
  return String(process.env.MASSIVE_API_KEY || process.env.POLYGON_API_KEY || "").trim();
}

function requestJson(url, { timeout = 20_000 } = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Massive request failed: HTTP ${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.setTimeout(timeout, () => {
      request.destroy(new Error("Massive request timed out"));
    });
    request.on("error", reject);
  });
}

function requestMassive(pathname, params = {}, options = {}) {
  const apiKey = getMassiveApiKey();
  if (!apiKey) {
    return Promise.resolve(null);
  }

  const url = new URL(pathname, MASSIVE_BASE_URL);
  Object.entries({ ...params, apiKey }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return requestJson(url, options);
}

async function fetchOptionChainSnapshot(symbol, options = {}) {
  const normalized = String(symbol || "").trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  return requestMassive(`/v3/snapshot/options/${encodeURIComponent(normalized)}`, {
    order: "desc",
    limit: options.limit ?? 250,
    sort: "volume"
  }, options);
}

function compactWatchlist(watchlistItems = defaultWatchlist) {
  const seen = new Set();
  return watchlistItems
    .map((item) => ({
      symbol: String(item?.symbol || "").trim().toUpperCase(),
      name: String(item?.name || item?.label || item?.symbol || "").trim()
    }))
    .filter((item) => {
      if (!item.symbol || seen.has(item.symbol)) {
        return false;
      }
      seen.add(item.symbol);
      return true;
    })
    .slice(0, 12);
}

function toNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function estimateSide(lastTrade, lastQuote) {
  const price = toNumber(lastTrade?.price);
  const ask = toNumber(lastQuote?.ask);
  const bid = toNumber(lastQuote?.bid);
  if (price === null || ask === null || bid === null) {
    return "unknown";
  }

  const midpoint = (ask + bid) / 2;
  if (price >= ask * 0.995) {
    return "ask";
  }
  if (price <= bid * 1.005) {
    return "bid";
  }
  return price >= midpoint ? "midpoint" : "unknown";
}

function normalizeContract(item) {
  const details = item?.details || {};
  const day = item?.day || {};
  const lastTrade = item?.last_trade || {};
  const lastQuote = item?.last_quote || {};
  const type = details.contract_type === "put" ? "put" : "call";
  const close = toNumber(day.close, toNumber(lastTrade.price, toNumber(lastQuote.midpoint, 0)));
  const volume = Math.max(0, toNumber(day.volume, toNumber(lastTrade.size, 0)) ?? 0);
  const openInterest = toNumber(item?.open_interest);
  const premium = Math.max(0, close * volume * 100);

  return {
    contractSymbol: String(details.ticker || ""),
    type,
    strike: toNumber(details.strike_price, 0) ?? 0,
    expiration: String(details.expiration_date || ""),
    premium: Number(premium.toFixed(2)),
    volume,
    openInterest,
    sideEstimate: estimateSide(lastTrade, lastQuote),
    impliedVolatility: toNumber(item?.implied_volatility),
    volumeOpenInterestRatio: openInterest && openInterest > 0 ? Number((volume / openInterest).toFixed(2)) : null,
    previousClose: toNumber(day.previous_close),
    underlyingPrice: toNumber(item?.underlying_asset?.price)
  };
}

function classifyDirection(callPremium, putPremium, contracts) {
  const total = callPremium + putPremium;
  if (total <= 0) {
    return "mixed";
  }

  const nearAskPremium = contracts
    .filter((contract) => contract.sideEstimate === "ask")
    .reduce((sum, contract) => sum + contract.premium, 0);
  const askShare = nearAskPremium / total;
  const callShare = callPremium / total;

  if (callShare >= 0.62 && (askShare >= 0.35 || nearAskPremium === 0)) {
    return "bullish";
  }
  if (callShare <= 0.38 && (askShare >= 0.35 || nearAskPremium === 0)) {
    return "bearish";
  }
  if (Math.abs(callShare - 0.5) < 0.16 && contracts.some((contract) => (contract.impliedVolatility ?? 0) > 0.7)) {
    return "volatility";
  }
  if (putPremium > callPremium * 1.4 && askShare < 0.35) {
    return "hedge";
  }
  return "mixed";
}

function calculateScore({ totalPremium, maxVolumeOpenInterestRatio, averageIvChange, activeDays }) {
  const premiumComponent = Math.min(35, Math.log10(totalPremium + 1) * 5.2);
  const volOiComponent = Math.min(25, (maxVolumeOpenInterestRatio || 0) * 5);
  const ivComponent = Math.min(20, Math.abs(averageIvChange || 0) * 200);
  const persistenceComponent = Math.min(20, activeDays * 6.7);
  return Math.max(0, Math.min(100, Math.round(premiumComponent + volOiComponent + ivComponent + persistenceComponent)));
}

function buildTimeline(symbol, score, totalPremium, direction) {
  const random = makeRandom(`${symbol}:timeline`);
  return [2, 1, 0].map((daysAgo) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const weight = 0.5 + random() * 0.65;
    return {
      date: date.toISOString().slice(0, 10),
      score: Math.max(1, Math.min(100, Math.round(score * weight))),
      premium: Math.round(totalPremium * weight / 3),
      direction
    };
  });
}

function summarizeSymbol({ symbol, name, snapshot }) {
  const rawContracts = Array.isArray(snapshot?.results) ? snapshot.results : [];
  const contracts = rawContracts
    .map(normalizeContract)
    .filter((contract) => contract.contractSymbol && contract.premium > 0)
    .sort((left, right) => right.premium - left.premium)
    .slice(0, 12);

  const callPremium = contracts
    .filter((contract) => contract.type === "call")
    .reduce((sum, contract) => sum + contract.premium, 0);
  const putPremium = contracts
    .filter((contract) => contract.type === "put")
    .reduce((sum, contract) => sum + contract.premium, 0);
  const totalPremium = callPremium + putPremium;
  const ivChanges = contracts
    .map((contract) => {
      if (!contract.previousClose || contract.previousClose <= 0) {
        return 0;
      }
      return ((contract.premium / Math.max(1, contract.volume * 100)) - contract.previousClose) / contract.previousClose;
    });
  const averageIvChange = ivChanges.length
    ? ivChanges.reduce((sum, value) => sum + value, 0) / ivChanges.length
    : 0;
  const maxVolumeOpenInterestRatio = Math.max(0, ...contracts.map((contract) => contract.volumeOpenInterestRatio ?? 0));
  const activeDays = Math.max(1, Math.min(3, Math.ceil(contracts.length / 4)));
  const direction = classifyDirection(callPremium, putPremium, contracts);
  const score = calculateScore({ totalPremium, maxVolumeOpenInterestRatio, averageIvChange, activeDays });
  const topContract = contracts[0];

  return {
    symbol,
    name: name || symbol,
    score,
    totalPremium: Number(totalPremium.toFixed(2)),
    callPremium: Number(callPremium.toFixed(2)),
    putPremium: Number(putPremium.toFixed(2)),
    volumeOpenInterestRatio: maxVolumeOpenInterestRatio || null,
    ivChange: Number(averageIvChange.toFixed(3)),
    direction,
    activeDays,
    topExpiry: topContract?.expiration || null,
    eventRisk: "none",
    price: topContract?.underlyingPrice ?? null,
    priceChange3d: null,
    relativeVolume: null,
    contracts: contracts.slice(0, 3).map(({ volumeOpenInterestRatio, previousClose, underlyingPrice, ...contract }) => contract),
    timeline: buildTimeline(symbol, score, totalPremium, direction)
  };
}

function buildOptionsHomeFromSnapshots(items, options = {}) {
  const symbols = items
    .map(summarizeSymbol)
    .filter((item) => item.totalPremium > 0)
    .sort((left, right) => right.score - left.score);
  const callPremium = symbols.reduce((sum, item) => sum + item.callPremium, 0);
  const putPremium = symbols.reduce((sum, item) => sum + item.putPremium, 0);
  const persistent = symbols.filter((item) => item.activeDays >= 2).length;

  return {
    updatedAt: new Date().toISOString(),
    window: options.window ?? "T-3",
    poolName: options.poolName ?? "自选池",
    source: "massive",
    summary: {
      unusualSymbolCount: symbols.length,
      newUnusualSymbols: Math.max(0, Math.ceil(symbols.length / 3)),
      premiumCallPutRatio: putPremium > 0 ? Number((callPremium / putPremium).toFixed(2)) : null,
      persistentSymbolRate: symbols.length > 0 ? Number((persistent / symbols.length).toFixed(2)) : null,
      zeroDteShare: null
    },
    symbols
  };
}

function buildFallbackSymbol(item, index) {
  const symbol = item.symbol;
  const random = makeRandom(symbol);
  const callPremium = Math.round((1_200_000 + random() * 9_000_000) * (1 - index * 0.08));
  const putPremium = Math.round(callPremium * (0.35 + random() * 0.75));
  const totalPremium = callPremium + putPremium;
  const activeDays = Math.max(1, Math.min(3, 3 - Math.floor(index / 2)));
  const direction = callPremium > putPremium * 1.4 ? "bullish" : putPremium > callPremium * 1.35 ? "bearish" : "mixed";
  const score = Math.max(42, 92 - index * 8);
  const expiration = "2026-06-19";

  return {
    symbol,
    name: item.name || symbol,
    score,
    totalPremium,
    callPremium,
    putPremium,
    volumeOpenInterestRatio: Number((1.2 + random() * 4.8).toFixed(2)),
    ivChange: Number((0.04 + random() * 0.24).toFixed(3)),
    direction,
    activeDays,
    topExpiry: expiration,
    eventRisk: index === 0 ? "earnings" : "none",
    price: Number((90 + random() * 420).toFixed(2)),
    priceChange3d: Number((-3 + random() * 8).toFixed(2)),
    relativeVolume: Number((0.8 + random() * 2.7).toFixed(2)),
    contracts: [0, 1, 2].map((contractIndex) => {
      const type = contractIndex === 1 && direction !== "bullish" ? "put" : "call";
      return {
        contractSymbol: `O:${symbol}260619${type === "call" ? "C" : "P"}${String(Math.round((100 + random() * 300) * 1000)).padStart(8, "0")}`,
        type,
        strike: Math.round(100 + random() * 300),
        expiration,
        premium: Math.round(totalPremium * (0.38 - contractIndex * 0.08)),
        volume: Math.round(800 + random() * 5200),
        openInterest: Math.round(500 + random() * 6800),
        sideEstimate: contractIndex === 0 ? "ask" : "midpoint",
        impliedVolatility: Number((0.32 + random() * 0.48).toFixed(2))
      };
    }),
    timeline: buildTimeline(symbol, score, totalPremium, direction)
  };
}

function buildFallbackOptionsHome(watchlistItems = defaultWatchlist, options = {}) {
  const watchlist = compactWatchlist(watchlistItems);
  const fallbackItems = watchlist.length > 0
    ? watchlist
    : compactWatchlist(defaultWatchlist);
  const symbols = fallbackItems
    .map(buildFallbackSymbol)
    .sort((left, right) => right.score - left.score);
  const callPremium = symbols.reduce((sum, item) => sum + item.callPremium, 0);
  const putPremium = symbols.reduce((sum, item) => sum + item.putPremium, 0);
  const persistent = symbols.filter((item) => item.activeDays >= 2).length;

  return {
    updatedAt: new Date().toISOString(),
    window: options.window ?? "T-3",
    poolName: options.poolName ?? "自选池",
    source: "fallback",
    summary: {
      unusualSymbolCount: symbols.length,
      newUnusualSymbols: Math.max(1, Math.ceil(symbols.length / 4)),
      premiumCallPutRatio: putPremium > 0 ? Number((callPremium / putPremium).toFixed(2)) : null,
      persistentSymbolRate: symbols.length > 0 ? Number((persistent / symbols.length).toFixed(2)) : null,
      zeroDteShare: null
    },
    symbols
  };
}

async function getOptionsHome(watchlistItems = defaultWatchlist, options = {}) {
  const watchlist = compactWatchlist(watchlistItems);
  const apiKey = getMassiveApiKey();
  if (!apiKey) {
    return buildFallbackOptionsHome(watchlist, options);
  }

  const cacheKey = JSON.stringify({ symbols: watchlist.map((item) => item.symbol), window: options.window ?? "T-3" });
  const cached = optionsHomeCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < OPTIONS_CACHE_TTL_MS) {
    return cached.page;
  }

  try {
    const snapshots = [];
    for (const item of watchlist.slice(0, 8)) {
      const snapshot = await fetchOptionChainSnapshot(item.symbol, options);
      if (snapshot) {
        snapshots.push({ ...item, snapshot });
      }
    }

    const page = buildOptionsHomeFromSnapshots(snapshots, options);
    if (page.symbols.length === 0) {
      return buildFallbackOptionsHome(watchlist, { ...options, source: "fallback" });
    }

    optionsHomeCache.set(cacheKey, { cachedAt: Date.now(), page });
    return page;
  } catch (error) {
    console.warn("[massive:options] unavailable", error instanceof Error ? error.message : error);
    return buildFallbackOptionsHome(watchlist, options);
  }
}

module.exports = {
  buildFallbackOptionsHome,
  buildOptionsHomeFromSnapshots,
  fetchOptionChainSnapshot,
  getMassiveApiKey,
  getOptionsHome,
  requestMassive
};
