import { createElement, useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import {
  Activity,
  Bell,
  Bot,
  BrainCircuit,
  CandlestickChart,
  ChevronDown,
  ChevronLeft,
  CircleDollarSign,
  Database,
  Gauge,
  LineChart,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Moon,
  Sun,
  TrendingUp,
  WalletCards,
  Zap
} from "lucide-react";
import {
  buildTradingViewWidgetConfig,
  getTradingViewScriptSource,
  getTradingViewSymbolUrl,
  type TradingViewWidgetKind
} from "./tradingView";

type PricePoint = {
  date: string;
  close: number;
  volume: number;
};

type DashboardData = {
  symbol: string;
  calcInfo?: SecurityCalcInfo | null;
  ratings?: SecurityRatings | null;
  staticInfo?: SecurityStaticInfo | null;
  quote: {
    name: string;
    price: number;
    changeAmount: number;
    changePercent: number;
    previousClose: number;
    market: string;
    updatedAt: string;
  };
  prices: PricePoint[];
  signals: Array<{ label: string; value: string; score: number }>;
  news: NewsItem[];
  analysis: {
    stance: string;
    buyZone: string;
    sellZone: string;
    risk: string;
    summary: string;
  };
};

type NewsItem = {
  title: string;
  source: string;
  time: string;
  sentiment: string;
  summary?: string;
  url?: string;
  sentimentLabel?: string | null;
  sentimentScore?: number | null;
  tickerSentimentLabel?: string | null;
  tickerSentimentScore?: number | null;
  relevanceScore?: number | null;
};

type NewsBucket = {
  label: string;
  articleCount: number;
  averageScore: number;
  stance: string;
  positive: number;
  neutral: number;
  negative: number;
  articles: NewsItem[];
};

type NewsTopicBucket = NewsBucket & {
  topic: string;
};

type WatchlistNewsBucket = Omit<NewsBucket, "label"> & {
  symbol: string;
};

type NewsPageData = {
  updatedAt: string;
  summary: {
    articleCount: number;
    averageScore: number;
    stance: string;
    positive: number;
    neutral: number;
    negative: number;
  };
  market: NewsBucket;
  macro: {
    monetary: NewsBucket;
    fiscal: NewsBucket;
    macro: NewsBucket;
  };
  topics: NewsTopicBucket[];
  watchlist: WatchlistNewsBucket[];
};

type SecurityRatings = {
  analyst: AnalystRatings | null;
  institution: InstitutionRating | null;
};

type AnalystRatings = {
  industryName: string | null;
  industryRank: number | null;
  multiLetter: string | null;
  multiScore: string | null;
  multiScoreChange: number | null;
  scaleName: string | null;
  styleName: string | null;
  reportPeriod: string | null;
  ratingsJson: string | null;
};

type RatingEvaluate = {
  buy: number | null;
  hold: number | null;
  sell: number | null;
  over?: number | null;
  under?: number | null;
  noOpinion?: number | null;
  total?: number | null;
  startDate?: string | null;
  endDate?: string | null;
};

type RatingTarget = {
  averageTarget?: string | null;
  highestPrice: string | null;
  lowestPrice: string | null;
  previousClose?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

type InstitutionRating = {
  latest: {
    evaluate: RatingEvaluate | null;
    industryName: string | null;
    industryRank: number | null;
    industryTotal: number | null;
    industryMean: number | null;
    industryMedian: number | null;
    target: RatingTarget | null;
  } | null;
  summary: {
    recommend: string | null;
    change: string | null;
    currencySymbol: string | null;
    updatedAt: string | null;
    evaluate: RatingEvaluate | null;
    target: RatingTarget | null;
  } | null;
};

const TRADINGVIEW_DEFAULT_SYMBOLS = [
  "NASDAQ:AAPL",
  "NASDAQ:ADBE",
  "NASDAQ:NVDA",
  "NASDAQ:TSLA"
];
const TRADINGVIEW_INDEX_SYMBOLS = [
  "AMEX:SPY",
  "NASDAQ:QQQ",
  "AMEX:DIA"
];
const TRADINGVIEW_TIMEFRAMES = [
  { label: "1D", value: "1D" },
  { label: "7D", value: "7D" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "1Y", value: "12M" }
] as const;
type SecurityCalcInfo = {
  symbol: string | null;
  lastDone: string | null;
  changeValue: string | null;
  changeRate: string | null;
  volume: number | null;
  turnover: string | null;
  ytdChangeRate: string | null;
  turnoverRate: string | null;
  totalMarketValue: string | null;
  capitalFlow: string | null;
  amplitude: string | null;
  volumeRatio: string | null;
  peTtmRatio: string | null;
  pbRatio: string | null;
  eps?: string | null;
  dividendRatioTtm: string | null;
  fiveDayChangeRate: string | null;
  tenDayChangeRate: string | null;
  halfYearChangeRate: string | null;
  fiveMinutesChangeRate: string | null;
};

type SecurityStaticInfo = {
  symbol: string | null;
  nameCn: string | null;
  nameEn: string | null;
  nameHk: string | null;
  listingDate?: string | null;
  exchange: string | null;
  currency: string | null;
  lotSize: number | null;
  totalShares: number | null;
  circulatingShares: number | null;
  hkShares?: number | null;
  eps: string | null;
  epsTtm: string | null;
  bps: string | null;
  dividendYield: string | null;
  stockDerivatives?: number[];
  board: string | null;
};

type ViewId = "research" | "news" | "positions" | "options";
type ResearchMode = "overview" | "detail";
type ThemeMode = "light" | "dark";
type TradingViewSymbolLink = {
  tvSymbol: string;
  appSymbol: string;
};

const watchlist = [
  { symbol: "NVDA", label: "NVIDIA", change: "+2.84%", state: "强势突破" },
  { symbol: "MSFT", label: "Microsoft", change: "+0.91%", state: "稳步抬升" },
  { symbol: "TSLA", label: "Tesla", change: "-1.18%", state: "高波动" },
  { symbol: "AMD", label: "AMD", change: "+1.46%", state: "量能恢复" }
];

const browserWatchlistKey = "trade-assistant.watchlist";
const themeStorageKey = "trade-assistant.theme";

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem(themeStorageKey);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function getBrowserWatchlist(): WatchlistItem[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(browserWatchlistKey) || "[]");
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [];
    }

    return parsed
      .map((item) => ({
        symbol: String(item?.symbol || "").trim().toUpperCase(),
        name: String(item?.name || item?.symbol || "").trim()
      }))
      .filter((item) => item.symbol);
  } catch {
    return [];
  }
}

function addBrowserWatchlistItem(item: WatchlistItem) {
  const current = getBrowserWatchlist();
  const symbol = item.symbol.trim().toUpperCase();
  if (!symbol || current.some((entry) => entry.symbol === symbol)) {
    return current;
  }

  const next = [...current, { symbol, name: item.name || symbol }];
  window.localStorage.setItem(browserWatchlistKey, JSON.stringify(next));
  return next;
}

function removeBrowserWatchlistItem(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  const next = getBrowserWatchlist().filter((item) => item.symbol !== normalized);
  window.localStorage.setItem(browserWatchlistKey, JSON.stringify(next));
  return next;
}

const optionFlow = [
  { strike: "Call 140", expiry: "06/21", premium: "$8.4M", bias: "看涨" },
  { strike: "Put 120", expiry: "06/21", premium: "$2.1M", bias: "对冲" },
  { strike: "Call 155", expiry: "07/19", premium: "$5.7M", bias: "追高" }
];

function buildOverviewCard(symbol: string, name: string, kind: MarketCard["kind"], base: number): MarketCard {
  const normalized = symbol.trim().toUpperCase();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  const sparkline = Array.from({ length: 16 }, (_, index) => (
    Number((base + Math.sin((index + normalized.length) / 2) * base * 0.018 + index * base * 0.004).toFixed(2))
  ));
  const last = sparkline[sparkline.length - 1];

  const changeFor = (period: 1 | 5 | 10 | 15): PeriodReturn => {
    const previous = sparkline[Math.max(0, sparkline.length - 1 - period)] ?? last;
    const amount = Number((last - previous).toFixed(2));
    return {
      amount,
      percent: previous === 0 ? 0 : Number(((amount / previous) * 100).toFixed(2))
    };
  };

  return {
    symbol: normalized,
    name,
    kind,
    price: last,
    dayChange: changeFor(1),
    performance: {
      "5d": changeFor(5),
      "10d": changeFor(10),
      "15d": changeFor(15)
    },
    updatedAt: new Date().toISOString(),
    sparkline
  };
}

function buildBrowserFallbackOverview(watchlistItems = getBrowserWatchlist()): MarketOverviewData {
  return {
    updatedAt: new Date().toISOString(),
    indexes: [
      buildOverviewCard("IXIC", "Nasdaq Composite", "index", 18940),
      buildOverviewCard("DJI", "Dow Jones Industrial Average", "index", 42112),
      buildOverviewCard("SPX", "S&P 500", "index", 5824)
    ],
    watchlist: watchlistItems.map((item, index) => (
      buildOverviewCard(item.symbol, item.name, "stock", 120 + index * 43)
    )),
    macro: []
  };
}

function buildBrowserFallback(symbol: string): DashboardData {
  const normalized = symbol.trim().toUpperCase() || "NVDA";
  const start = new Date();
  start.setDate(start.getDate() - 120);
  const prices = Array.from({ length: 121 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date: date.toISOString().slice(0, 10),
      close: Number((180 + index * 0.16 + Math.sin(index / 7) * 7).toFixed(2)),
      volume: 42_000_000 + index * 180_000
    };
  });
  const lastClose = prices[prices.length - 1].close;
  const previousClose = prices[prices.length - 2].close;

  return {
    symbol: normalized,
    calcInfo: null,
    ratings: null,
    staticInfo: {
      symbol: `${normalized}.US`,
      nameCn: null,
      nameEn: `${normalized} Inc.`,
      nameHk: null,
      listingDate: null,
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
      changePercent: 1.26,
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
      { title: `${normalized} 近月营收预期被上调`, source: "Market Wire", time: "2 小时前", sentiment: "positive" }
    ],
    analysis: {
      stance: "观察偏多",
      buyZone: `${(lastClose * 0.96).toFixed(2)} - ${(lastClose * 0.985).toFixed(2)}`,
      sellZone: `${(lastClose * 1.08).toFixed(2)} - ${(lastClose * 1.14).toFixed(2)}`,
      risk: `若跌破 ${(lastClose * 0.93).toFixed(2)}，短线趋势可能转弱。`,
      summary: "浏览器预览占位数据。Electron 桌面模式会通过 IPC 从主进程获取数据。"
    }
  };
}

function makeBrowserNewsBucket(label: string, articles: NewsItem[]): NewsBucket {
  const positive = articles.filter((item) => item.sentiment === "positive").length;
  const negative = articles.filter((item) => item.sentiment === "negative").length;
  const neutral = articles.length - positive - negative;

  return {
    label,
    articleCount: articles.length,
    averageScore: 0,
    stance: positive > negative ? "positive" : negative > positive ? "negative" : "neutral",
    positive,
    neutral,
    negative,
    articles
  };
}

function buildBrowserFallbackNewsPage(watchlistItems = getBrowserWatchlist()): NewsPageData {
  const now = new Date().toISOString();
  const makeArticle = (title: string, source: string, sentiment: string): NewsItem => ({
    title,
    source,
    sentiment,
    time: now,
    summary: "浏览器预览新闻摘要。Electron 桌面模式会通过 Alpha Vantage 获取真实新闻与情绪。",
    url: "",
    sentimentLabel: sentiment
  });
  const market = makeBrowserNewsBucket("市场总览", [
    makeArticle("市场关注利率路径与科技股财报", "Alpha Vantage Preview", "neutral"),
    makeArticle("资金回流成长股，风险偏好温和修复", "Alpha Vantage Preview", "positive")
  ]);
  const monetary = makeBrowserNewsBucket("美联储与货币政策", [
    makeArticle("美联储官员强调通胀仍需观察", "Macro Desk", "neutral")
  ]);
  const fiscal = makeBrowserNewsBucket("财政政策", [
    makeArticle("财政支出前景成为市场关注点", "Macro Desk", "neutral")
  ]);
  const macro = makeBrowserNewsBucket("宏观经济", [
    makeArticle("就业与消费数据支持软着陆叙事", "Macro Desk", "positive")
  ]);
  const topics = ["technology", "earnings", "finance"].map((topic) => ({
    ...makeBrowserNewsBucket(topic, [
      makeArticle(`${topic} 主题新闻占位`, "Topic Wire", "neutral")
    ]),
    topic
  }));
  const watchlist = (watchlistItems.length ? watchlistItems : [{ symbol: "NVDA", name: "NVIDIA" }]).map((item) => ({
    ...makeBrowserNewsBucket(item.symbol, [
      makeArticle(`${item.symbol} 相关新闻占位`, "Watchlist Wire", "positive")
    ]),
    symbol: item.symbol
  }));
  const allArticles = [
    ...market.articles,
    ...monetary.articles,
    ...fiscal.articles,
    ...macro.articles,
    ...topics.flatMap((topic) => topic.articles),
    ...watchlist.flatMap((item) => item.articles)
  ];

  return {
    updatedAt: now,
    summary: makeBrowserNewsBucket("总览", allArticles),
    market,
    macro: { monetary, fiscal, macro },
    topics,
    watchlist
  };
}

function buildBrowserFallbackOptionsHome(watchlistItems = getBrowserWatchlist()): OptionsHomeData {
  const symbols = (watchlistItems.length > 0 ? watchlistItems : [
    { symbol: "NVDA", name: "NVIDIA" },
    { symbol: "AAPL", name: "Apple" },
    { symbol: "TSLA", name: "Tesla" },
    { symbol: "AMD", name: "AMD" }
  ]).slice(0, 8).map((item, index) => {
    const score = Math.max(44, 91 - index * 7);
    const callPremium = 7_800_000 - index * 820_000;
    const putPremium = Math.round(callPremium * (index % 3 === 1 ? 1.2 : 0.46));
    const direction = callPremium > putPremium ? "bullish" : "bearish";
    const totalPremium = callPremium + putPremium;
    const expiration = "2026-06-19";

    return {
      symbol: item.symbol,
      name: item.name || item.symbol,
      score,
      totalPremium,
      callPremium,
      putPremium,
      volumeOpenInterestRatio: Number((4.8 - index * 0.38).toFixed(2)),
      ivChange: Number((0.18 - index * 0.012).toFixed(3)),
      direction,
      activeDays: index < 3 ? 3 : 2,
      topExpiry: expiration,
      eventRisk: index === 0 ? "earnings" : "none",
      price: Number((120 + index * 38.4).toFixed(2)),
      priceChange3d: Number((2.8 - index * 0.7).toFixed(2)),
      relativeVolume: Number((2.6 - index * 0.15).toFixed(2)),
      contracts: [0, 1, 2].map((contractIndex) => ({
        contractSymbol: `O:${item.symbol}260619${contractIndex === 1 && direction === "bearish" ? "P" : "C"}${String((160 + index * 20 + contractIndex * 5) * 1000).padStart(8, "0")}`,
        type: contractIndex === 1 && direction === "bearish" ? "put" : "call",
        strike: 160 + index * 20 + contractIndex * 5,
        expiration,
        premium: Math.round(totalPremium * (0.42 - contractIndex * 0.09)),
        volume: 4200 - index * 260 - contractIndex * 480,
        openInterest: 900 + index * 320 + contractIndex * 540,
        sideEstimate: contractIndex === 0 ? "ask" : "midpoint",
        impliedVolatility: Number((0.54 + contractIndex * 0.04).toFixed(2))
      })),
      timeline: [2, 1, 0].map((daysAgo) => {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return {
          date: date.toISOString().slice(0, 10),
          score: Math.max(20, score - daysAgo * 8 + index),
          premium: Math.round(totalPremium / (3 + daysAgo * 0.3)),
          direction
        };
      })
    } as OptionsActivitySymbol;
  });
  const callPremium = symbols.reduce((sum, item) => sum + item.callPremium, 0);
  const putPremium = symbols.reduce((sum, item) => sum + item.putPremium, 0);

  return {
    updatedAt: new Date().toISOString(),
    window: "T-3",
    poolName: "自选池",
    source: "fallback",
    summary: {
      unusualSymbolCount: symbols.length,
      newUnusualSymbols: Math.max(1, Math.ceil(symbols.length / 4)),
      premiumCallPutRatio: putPremium > 0 ? Number((callPremium / putPremium).toFixed(2)) : null,
      persistentSymbolRate: Number((symbols.filter((item) => item.activeDays >= 2).length / Math.max(1, symbols.length)).toFixed(2)),
      zeroDteShare: null
    },
    symbols
  };
}

function App() {
  const [activeView, setActiveView] = useState<ViewId>("research");
  const [researchMode, setResearchMode] = useState<ResearchMode>("overview");
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [broker, setBroker] = useState<BrokerId>("longbridge");
  const [symbol, setSymbol] = useState("NVDA");
  const [query, setQuery] = useState("NVDA");
  const [data, setData] = useState<DashboardData | null>(null);
  const [overviewData, setOverviewData] = useState<MarketOverviewData | null>(null);
  const [newsPageData, setNewsPageData] = useState<NewsPageData | null>(null);
  const [optionsHomeData, setOptionsHomeData] = useState<OptionsHomeData | null>(null);
  const [positionsData, setPositionsData] = useState<PositionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [newsPageLoading, setNewsPageLoading] = useState(false);
  const [newsPageError, setNewsPageError] = useState<string | null>(null);
  const [optionsHomeLoading, setOptionsHomeLoading] = useState(false);
  const [optionsHomeError, setOptionsHomeError] = useState<string | null>(null);
  const [watchlistVersion, setWatchlistVersion] = useState(0);
  const [usSymbols, setUsSymbols] = useState<SymbolSearchResult[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [clientState, setClientState] = useState<"加载中" | "本地就绪" | "浏览器预览" | "不可用">("加载中");
  const [longbridgeStatus, setLongbridgeStatus] = useState<LongbridgeStatus | null>(null);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [finnhubStatus, setFinnhubStatus] = useState<FinnhubStatus | null>(null);
  const [expandedNewsKey, setExpandedNewsKey] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setExpandedNewsKey(null);

    const hasDesktopBridge = Boolean(window.tradeAssistant);
    const dashboardPromise = hasDesktopBridge
      ? window.tradeAssistant!.getDashboard(symbol)
      : Promise.resolve(buildBrowserFallback(symbol));

    dashboardPromise
      .then((payload: DashboardData) => {
        if (!cancelled) {
          setData(applyOverviewSnapshot(payload, overviewData));
          setClientState(hasDesktopBridge ? "本地就绪" : "浏览器预览");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClientState("不可用");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    let cancelled = false;
    setOverviewLoading(true);

    const hasDesktopBridge = Boolean(window.tradeAssistant);
    const overviewPromise = hasDesktopBridge
      ? window.tradeAssistant!.getMarketOverview()
      : Promise.resolve(buildBrowserFallbackOverview());

    overviewPromise
      .then((payload: MarketOverviewData) => {
        if (!cancelled) {
          setOverviewData(payload);
          setClientState(hasDesktopBridge ? "本地就绪" : "浏览器预览");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOverviewData(buildBrowserFallbackOverview());
          setClientState("不可用");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [watchlistVersion]);

  useEffect(() => {
    let cancelled = false;
    const symbolsPromise = window.tradeAssistant
      ? window.tradeAssistant.getUsSymbols()
      : Promise.resolve([]);

    symbolsPromise
      .then((payload) => {
        if (!cancelled && payload.length > 0) {
          setUsSymbols(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsSymbols([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!window.tradeAssistant) {
      return;
    }

    return window.tradeAssistant.onUsSymbolsUpdated((payload) => {
      if (payload.length > 0) {
        setUsSymbols(payload);
      }
    });
  }, []);

  useEffect(() => {
    if (!window.tradeAssistant) {
      setLongbridgeStatus({
        configured: false,
        authorized: false,
        authorizing: false,
        tokenExists: false,
        callbackPort: 60355,
        tokenPath: null
      });
      return;
    }

    window.tradeAssistant.getLongbridgeStatus()
      .then(setLongbridgeStatus)
      .catch(() => setLongbridgeStatus(null));
  }, []);

  const connectLongbridge = async () => {
    if (!window.tradeAssistant) {
      return;
    }

    setOauthBusy(true);
    setOauthError(null);
    try {
      const status = await window.tradeAssistant?.startLongbridgeOAuth({ force: true });
      if (status) {
        setLongbridgeStatus(status);
      }
    } catch (error) {
      setOauthError(error instanceof Error ? error.message : "长桥授权启动失败");
    } finally {
      setOauthBusy(false);
    }
  };

  const loadPositions = async () => {
    setPositionsLoading(true);
    setPositionsError(null);

    try {
      const payload = await window.tradeAssistant?.getPositions(broker);
      if (payload) {
        setPositionsData(payload);
      } else {
        setPositionsData({
          broker,
          mode: "error",
          positions: [],
          message: "当前浏览器预览无法访问 Electron 持仓接口。"
        });
      }
    } catch (error) {
      setPositionsError(error instanceof Error ? error.message : "持仓加载失败");
    } finally {
      setPositionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === "positions") {
      void loadPositions();
    }
  }, [activeView, broker]);

  useEffect(() => {
    if (activeView !== "news") {
      return;
    }

    let cancelled = false;
    setNewsPageLoading(true);
    setNewsPageError(null);

    const hasDesktopBridge = Boolean(window.tradeAssistant);
    const newsPromise = hasDesktopBridge
      ? window.tradeAssistant!.getNewsPage()
      : Promise.resolve(buildBrowserFallbackNewsPage());

    newsPromise
      .then((payload) => {
        if (!cancelled) {
          setNewsPageData(payload);
          setClientState(hasDesktopBridge ? "本地就绪" : "浏览器预览");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setNewsPageData(buildBrowserFallbackNewsPage());
          setNewsPageError(error instanceof Error ? error.message : "新闻加载失败");
          setClientState("不可用");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setNewsPageLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeView, watchlistVersion]);

  useEffect(() => {
    if (activeView !== "options") {
      return;
    }

    let cancelled = false;
    setOptionsHomeLoading(true);
    setOptionsHomeError(null);

    const hasDesktopBridge = Boolean(window.tradeAssistant);
    const optionsPromise = hasDesktopBridge
      ? window.tradeAssistant!.getOptionsHome()
      : Promise.resolve(buildBrowserFallbackOptionsHome());

    optionsPromise
      .then((payload) => {
        if (!cancelled) {
          setOptionsHomeData(payload);
          setClientState(hasDesktopBridge ? "本地就绪" : "浏览器预览");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setOptionsHomeData(buildBrowserFallbackOptionsHome());
          setOptionsHomeError(error instanceof Error ? error.message : "期权异动加载失败");
          setClientState("不可用");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOptionsHomeLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeView, watchlistVersion]);

  useEffect(() => {
    if (!window.tradeAssistant) {
      return;
    }

    const removeStatusListener = window.tradeAssistant.onFinnhubStatus(setFinnhubStatus);
    const removeTradeListener = window.tradeAssistant.onFinnhubTrade((trade) => {
      setData((current) => mergeRealtimeTrade(current, trade));
      setOverviewData((current) => mergeOverviewTrade(current, trade));
    });

    return () => {
      removeStatusListener();
      removeTradeListener();
    };
  }, []);

  useEffect(() => {
    if (!window.tradeAssistant || activeView !== "research" || researchMode !== "detail") {
      return;
    }

    void window.tradeAssistant.subscribeFinnhub(symbol);
  }, [activeView, researchMode, symbol]);

	  const chartOption = useMemo(() => {
	    const prices = data?.prices ?? [];
      const isLight = theme === "light";
	    return {
	      grid: { top: 24, left: 48, right: 24, bottom: 38 },
	      tooltip: {
	        trigger: "axis",
	        backgroundColor: isLight ? "#ffffff" : "#101820",
	        borderColor: isLight ? "#d8e0ea" : "#2a3948",
	        textStyle: { color: isLight ? "#111827" : "#f4f7fb" }
	      },
	      xAxis: {
	        type: "category",
	        data: prices.map((point) => point.date.slice(5)),
	        axisLine: { lineStyle: { color: isLight ? "#d8e0ea" : "#354454" } },
	        axisLabel: { color: isLight ? "#667085" : "#91a1b3" }
	      },
	      yAxis: {
	        type: "value",
	        scale: true,
	        splitLine: { lineStyle: { color: isLight ? "#eef2f7" : "#1d2a36" } },
	        axisLabel: { color: isLight ? "#667085" : "#91a1b3" }
	      },
      series: [
        {
          name: "Close",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: prices.map((point) => point.close),
          lineStyle: { width: 3, color: "#3ddc97" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(61, 220, 151, 0.24)" },
                { offset: 1, color: "rgba(61, 220, 151, 0.02)" }
              ]
            }
          }
        }
      ]
    };
	  }, [data, theme]);
  const staticInfo = data?.staticInfo;
  const calcInfo = data?.calcInfo;
  const headlineMetrics = getHeadlineKeyMetrics(calcInfo);
  const tradingActivityMetrics = getTradingActivityMetrics(calcInfo);
  const financialReportMetrics = getFinancialReportMetrics(staticInfo, calcInfo);

  const submitSymbol = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = query.trim().toUpperCase();
    if (normalized) {
      setSymbol(normalized);
      setResearchMode("detail");
    }
  };

  const openResearchDetail = (nextSymbol: string) => {
    setQuery(nextSymbol);
    setSymbol(nextSymbol);
    setResearchMode("detail");
  };

  const addToWatchlist = async (item: WatchlistItem) => {
    if (window.tradeAssistant) {
      await window.tradeAssistant.addWatchlistItem(item);
    } else {
      addBrowserWatchlistItem(item);
    }

    setWatchlistVersion((version) => version + 1);
  };

  const removeFromWatchlist = async (symbolToRemove: string) => {
    const normalized = symbolToRemove.trim().toUpperCase();
    if (!normalized) {
      return;
    }

    if (window.tradeAssistant) {
      await window.tradeAssistant.removeWatchlistItem(normalized);
    } else {
      removeBrowserWatchlistItem(normalized);
    }

    setOverviewData((current) => current
      ? {
        ...current,
        watchlist: current.watchlist.filter((card) => card.symbol !== normalized)
      }
      : current);
    setWatchlistVersion((version) => version + 1);
  };

  return (
    <main className="app-shell" data-theme={theme}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <CandlestickChart size={22} />
          </div>
          <div>
            <strong>Trade Assistant</strong>
            <span>US Equity Research</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          <button className={`nav-item ${activeView === "research" ? "active" : ""}`} onClick={() => setActiveView("research")}>
            <LineChart size={18} /> 市场研究
          </button>
          <button className={`nav-item ${activeView === "positions" ? "active" : ""}`} onClick={() => setActiveView("positions")}>
            <WalletCards size={18} /> 我的持仓
          </button>
          <button className={`nav-item ${activeView === "news" ? "active" : ""}`} onClick={() => setActiveView("news")}>
            <Newspaper size={18} /> 新闻情绪
          </button>
          <button className={`nav-item ${activeView === "options" ? "active" : ""}`} onClick={() => setActiveView("options")}>
            <Activity size={18} /> 期权异动
          </button>
          <button className="nav-item"><BrainCircuit size={18} /> AI 策略</button>
          <button className="nav-item"><Database size={18} /> 数据源</button>
        </nav>

        <button
          className="theme-toggle"
          type="button"
          onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? "切换到白天模式" : "切换到夜间模式"}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          {theme === "dark" ? "白天模式" : "夜间模式"}
        </button>

        <section className="source-panel">
          <div className="panel-title">
            <Zap size={16} />
            长桥 OpenAPI
          </div>
          <p>行情、新闻、期权链与逐笔异动接口预留中。</p>
          <div className={`status-pill ${clientState === "本地就绪" ? "online" : ""}`}>
            <span />
            Electron IPC {clientState}
          </div>
          <button className="connect-button" onClick={connectLongbridge} disabled={oauthBusy}>
            {oauthBusy ? "等待授权" : longbridgeStatus?.tokenExists ? "重新授权长桥" : "连接长桥"}
          </button>
          {oauthError ? <small className="source-error">{oauthError}</small> : null}
          <small>
            {longbridgeStatus?.tokenExists
              ? "已发现本地 Token"
              : longbridgeStatus?.configured
                ? "已读取 client id"
                : "请先配置 .env"}
          </small>
        </section>
      </aside>

      <section className="workspace">
        {activeView === "research" ? (
          <>
            <header className="topbar">
              <form className="searchbar" onSubmit={submitSymbol}>
                <Search size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="输入美股代码，例如 AAPL / NVDA"
                  aria-label="股票代码"
                />
                <button type="submit">分析</button>
              </form>

              <div className="top-actions">
                <button className="icon-button" aria-label="通知"><Bell size={18} /></button>
                <button className="icon-button" aria-label="设置"><Settings2 size={18} /></button>
              </div>
            </header>

            {researchMode === "overview" ? (
	              <MarketOverview
	                data={overviewData}
	                loading={overviewLoading}
                  theme={theme}
	                onOpenDetail={openResearchDetail}
                onAddWatchlist={addToWatchlist}
                symbols={usSymbols}
              />
            ) : (
              <>
                <button className="back-button" onClick={() => setResearchMode("overview")}>
                  <ChevronLeft size={16} /> 返回市场总览
                </button>

                <section className="tradingview-detail-grid">
                  <div className="tradingview-detail-stack">
                    <TradingViewWidget
                      kind="symbol-info"
                      symbol={symbol}
                      theme={theme}
                      className="tradingview-symbol-info"
                    />
                    <div className="tradingview-local-summary">
                      <div>
                        <span>本地快照</span>
                        <strong>{data?.symbol ?? symbol}</strong>
                      </div>
                      <div className="tradingview-local-grid">
                        {headlineMetrics.slice(0, 4).map((metric) => (
                          <div key={metric.label}>
                            <span>{metric.label}</span>
                            <strong>{loading ? "--" : metric.value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <TradingViewWidget
                    kind="symbol-profile"
                    symbol={symbol}
                    theme={theme}
                    className="tradingview-symbol-profile"
                  />
                </section>

                <section className="tradingview-chart-panel">
                  <TradingViewWidget
                    kind="advanced-chart"
                    symbol={symbol}
                    theme={theme}
                    className="tradingview-advanced-chart"
                  />
                </section>

                <section className="tradingview-news-row">
                  <TradingViewWidget
                    kind="timeline"
                    symbol={symbol}
                    theme={theme}
                    className="tradingview-news-timeline"
                    loadStrategy="visible"
                  />
                </section>

                <section className="tradingview-financials-row">
                  <TradingViewWidget
                    kind="financials"
                    symbol={symbol}
                    theme={theme}
                    className="tradingview-financials"
                    loadStrategy="visible"
                  />
                </section>

                <section className="hero-band">
          <div>
            <div className="key-metrics-heading">
              <div>
                <h1>{data?.symbol ?? symbol} 关键指标</h1>
                <p>价格表现、成交活跃度与实时状态</p>
              </div>
            </div>
            <div className="key-index-grid">
              {headlineMetrics.map((metric) => (
                <div className="key-index-item" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{loading ? "--" : metric.value}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-side">
            <div className="hero-metrics">
              <Metric icon={<CircleDollarSign size={18} />} label="最新价" value={loading ? "--" : `$${data?.quote.price.toFixed(2)}`} />
              <Metric icon={<TrendingUp size={18} />} label="日内变化" value={loading ? "--" : `${formatSigned(data?.quote.changeAmount ?? 0)} / ${formatSignedPercent(data?.quote.changePercent ?? 0)}`} />
              <Metric icon={<Gauge size={18} />} label="实时连接" value={getRealtimeLabel(finnhubStatus)} />
            </div>
            <div className="performance-strip">
              {tradingActivityMetrics.map((metric) => (
                <div className="performance-item" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{loading ? "--" : metric.value}</strong>
                </div>
              ))}
            </div>
          </div>
                </section>

                <section className="content-grid">
          <div className="chart-column">
            <div className="chart-panel">
              <div className="section-heading">
                <div>
                  <span>Price Trend</span>
                  <h2>近四个月价格走势</h2>
                </div>
                <button className="ghost-button">1D <ChevronDown size={16} /></button>
              </div>
              <ReactECharts option={chartOption} className="price-chart" notMerge lazyUpdate />
            </div>

            <section className="financial-report-panel">
              <div className="section-heading compact">
                <div>
                  <span>Financial Report</span>
                  <h2>财务报告</h2>
                </div>
                <Database size={20} />
              </div>
              <div className="financial-report-grid">
                {financialReportMetrics.map((metric) => (
                  <div className="financial-report-item" key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>{loading ? "--" : metric.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="insight-column">
            <aside className="insight-panel">
              <div className="section-heading compact">
                <div>
                  <span>AI Analysis</span>
                  <h2>模型研判占位</h2>
                </div>
                <Bot size={20} />
              </div>
              <div className="analysis-callout">
                <Sparkles size={20} />
                <p>{data?.analysis.summary ?? "等待后端返回分析摘要。"}</p>
              </div>
              <div className="zones">
                <div>
                  <span>计划买入区</span>
                  <strong>{data?.analysis.buyZone ?? "--"}</strong>
                </div>
                <div>
                  <span>计划卖出区</span>
                  <strong>{data?.analysis.sellZone ?? "--"}</strong>
                </div>
              </div>
              <div className="risk-note">
                <ShieldAlert size={18} />
                {data?.analysis.risk ?? "接入真实数据后展示风险位。"}
              </div>
            </aside>
            <RatingsPanel ratings={data?.ratings ?? null} loading={loading} />
          </div>
                </section>

                <section className="lower-grid">
          <Panel title="信号雷达" subtitle="Signal Radar" icon={<Activity size={18} />}>
            <div className="signal-list">
              {(data?.signals ?? []).map((signal) => (
                <div className="signal-row" key={signal.label}>
                  <div>
                    <strong>{signal.label}</strong>
                    <span>{signal.value}</span>
                  </div>
                  <div className="meter"><span style={{ width: `${signal.score}%` }} /></div>
                  <b>{signal.score}</b>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="新闻与情绪" subtitle="News Feed" icon={<Newspaper size={18} />}>
            <div className="news-list">
              {(data?.news ?? []).map((item) => (
                <article className="news-item" key={getNewsKey(item)}>
                  <div className={`sentiment ${item.sentiment}`} aria-hidden="true" />
                  <div className="news-content">
                    <button
                      className="news-toggle"
                      type="button"
                      onClick={() => {
                        const key = getNewsKey(item);
                        setExpandedNewsKey((current) => current === key ? null : key);
                      }}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.source} · {formatTime(item.time)}</span>
                    </button>
                    {expandedNewsKey === getNewsKey(item) ? (
                      <div className="news-detail">
                        <p>{item.summary || "暂无摘要。"}</p>
                        <div className="news-tags">
                          <span>{item.tickerSentimentLabel ?? item.sentimentLabel ?? "Neutral"}</span>
                          {item.tickerSentimentScore !== undefined && item.tickerSentimentScore !== null ? (
                            <span>情绪 {item.tickerSentimentScore.toFixed(2)}</span>
                          ) : null}
                          {item.relevanceScore !== undefined && item.relevanceScore !== null ? (
                            <span>相关度 {item.relevanceScore.toFixed(2)}</span>
                          ) : null}
                        </div>
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noreferrer">打开新闻源</a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="期权异动" subtitle="Options Flow" icon={<WalletCards size={18} />}>
            <div className="option-table">
              {optionFlow.map((flow) => (
                <div className="option-row" key={`${flow.strike}-${flow.expiry}`}>
                  <span>{flow.strike}</span>
                  <span>{flow.expiry}</span>
                  <strong>{flow.premium}</strong>
                  <em>{flow.bias}</em>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="推荐观察" subtitle="Watchlist" icon={<TrendingUp size={18} />}>
            <div className="watch-list">
              {watchlist.map((item) => (
                <button className="watch-item" key={item.symbol} onClick={() => {
                  openResearchDetail(item.symbol);
                }}>
                  <div>
                    <strong>{item.symbol}</strong>
                    <span>{item.label}</span>
                  </div>
                  <div>
                    <b>{item.change}</b>
                    <span>{item.state}</span>
                  </div>
                </button>
              ))}
            </div>
          </Panel>
                </section>
              </>
            )}
          </>
        ) : activeView === "news" ? (
          <NewsSentimentView
            data={newsPageData}
            loading={newsPageLoading}
            error={newsPageError}
            onOpenDetail={(nextSymbol) => {
              setActiveView("research");
              openResearchDetail(nextSymbol);
            }}
          />
        ) : activeView === "options" ? (
          <OptionsActivityHome
            data={optionsHomeData}
            loading={optionsHomeLoading}
            error={optionsHomeError}
            onOpenDetail={(nextSymbol) => {
              setActiveView("research");
              openResearchDetail(nextSymbol);
            }}
          />
        ) : (
          <PositionsView
            broker={broker}
            data={positionsData}
            error={positionsError}
            loading={positionsLoading}
            onBrokerChange={setBroker}
            onRefresh={loadPositions}
          />
        )}
      </section>
    </main>
  );
}

function TradingViewWidget({
  kind,
  symbol,
  theme,
  className = "",
  loadStrategy = "immediate"
}: {
  kind: TradingViewWidgetKind;
  symbol: string;
  theme: ThemeMode;
  className?: string;
  loadStrategy?: "immediate" | "visible";
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(loadStrategy === "immediate");
  const config = useMemo(
    () => buildTradingViewWidgetConfig(kind, symbol, theme),
    [kind, symbol, theme]
  );

  useEffect(() => {
    if (loadStrategy === "immediate") {
      setShouldLoad(true);
      return;
    }

    setShouldLoad(false);
  }, [kind, loadStrategy, symbol, theme]);

  useEffect(() => {
    if (loadStrategy === "immediate" || shouldLoad) {
      return;
    }

    const shell = shellRef.current;

    if (!shell || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "360px 0px" }
    );

    observer.observe(shell);
    return () => observer.disconnect();
  }, [loadStrategy, shouldLoad]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    container.innerHTML = "";
    if (!shouldLoad) {
      return;
    }

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    container.appendChild(widget);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = getTradingViewScriptSource(kind);
    script.text = JSON.stringify(config, null, 2);
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [config, kind, shouldLoad]);

  const copyrightLabel = kind === "advanced-chart"
    ? `${symbol.toUpperCase()} stock chart`
    : "Track all markets on TradingView";
  const href = getTradingViewSymbolUrl(
    symbol,
    kind === "financials" ? "financials-overview/" : kind === "timeline" ? "news/" : ""
  );

  return (
    <div className={`tradingview-widget-shell ${className}`} ref={shellRef}>
      <div className="tradingview-widget-container" ref={containerRef} />
      <div className="tradingview-widget-copyright">
        <a href={href} rel="noopener nofollow" target="_blank">
          <span className="blue-text">{copyrightLabel}</span>
        </a>
        {kind === "advanced-chart" ? <span className="trademark"> by TradingView</span> : null}
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  icon,
  children
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="section-heading compact">
        <div>
          <span>{subtitle}</span>
          <h2>{title}</h2>
        </div>
        {icon}
      </div>
      {children}
    </section>
  );
}

function RatingsPanel({ ratings, loading }: { ratings?: SecurityRatings | null; loading: boolean }) {
  const analyst = ratings?.analyst ?? null;
  const institution = ratings?.institution ?? null;
  const summary = institution?.summary ?? null;
  const latest = institution?.latest ?? null;
  const evaluate = summary?.evaluate ?? latest?.evaluate ?? null;
  const total = evaluate?.total ?? sumRatingCounts(evaluate);
  const summaryTarget = summary?.target ?? null;
  const latestTarget = latest?.target ?? null;
  const averageTarget = summaryTarget?.averageTarget ?? latestTarget?.averageTarget ?? null;
  const highestTarget = summaryTarget?.highestPrice ?? latestTarget?.highestPrice ?? null;
  const lowestTarget = summaryTarget?.lowestPrice ?? latestTarget?.lowestPrice ?? null;
  const currency = summary?.currencySymbol ?? "";

  return (
    <aside className="ratings-panel">
      <div className="section-heading compact">
        <div>
          <span>Ratings</span>
          <h2>分析师与机构评级</h2>
        </div>
        <Gauge size={20} />
      </div>
      <div className="ratings-grid">
        <div className="rating-card">
          <span>分析师评级</span>
          <strong>{loading ? "--" : analyst?.multiLetter ?? "--"}</strong>
          <div className="rating-meta">
            <span>综合分 {loading ? "--" : formatMetricText(analyst?.multiScore)}</span>
            <span>变化 {loading ? "--" : formatSigned(analyst?.multiScoreChange ?? 0)}</span>
          </div>
          <small>{loading ? "--" : analyst?.reportPeriod ?? analyst?.industryName ?? "--"}</small>
        </div>
        <div className="rating-card">
          <span>机构共识</span>
          <strong>{loading ? "--" : summary?.recommend ?? "--"}</strong>
          <div className="rating-meta">
            <span>目标均价 {loading ? "--" : formatCurrencyValue(averageTarget, currency)}</span>
            <span>最高目标 {loading ? "--" : formatCurrencyValue(highestTarget, currency)}</span>
            <span>最低目标 {loading ? "--" : formatCurrencyValue(lowestTarget, currency)}</span>
            <span>更新 {loading ? "--" : formatTimestampDate(summary?.updatedAt)}</span>
          </div>
          <small>
            {loading
              ? "--"
              : latest?.industryName
                ? `${latest.industryName}${latest.industryRank ? ` #${latest.industryRank}` : ""}`
                : "--"}
          </small>
        </div>
      </div>
      <div className="rating-bars">
        {[
          { label: "买入", value: evaluate?.buy ?? 0, className: "buy" },
          { label: "持有", value: evaluate?.hold ?? 0, className: "hold" },
          { label: "卖出", value: evaluate?.sell ?? 0, className: "sell" }
        ].map((item) => (
          <div className="rating-bar-row" key={item.label}>
            <span>{item.label}</span>
            <div className="rating-bar"><b className={item.className} style={{ width: `${ratingPercent(item.value, total)}%` }} /></div>
            <strong>{loading ? "--" : item.value}</strong>
          </div>
        ))}
      </div>
      <div className="target-range">
        <span>目标价区间</span>
        <strong>
          {loading
            ? "--"
            : `${formatCurrencyValue(lowestTarget, currency)} - ${formatCurrencyValue(highestTarget, currency)}`}
        </strong>
      </div>
    </aside>
  );
}

function mergeRealtimeTrade(current: DashboardData | null, trade: FinnhubTrade): DashboardData | null {
  if (!current || current.symbol !== trade.symbol || !Number.isFinite(trade.price)) {
    return current;
  }

  const previousClose = current.quote.previousClose || current.quote.price;
  const changeAmount = Number((trade.price - previousClose).toFixed(2));
  const changePercent = previousClose === 0 ? 0 : Number(((changeAmount / previousClose) * 100).toFixed(2));
  const tradeDate = new Date(trade.timestamp || Date.now()).toISOString().slice(0, 10);
  const lastPoint = current.prices[current.prices.length - 1];
  const prices = [...current.prices];

  if (lastPoint?.date === tradeDate) {
    prices[prices.length - 1] = {
      ...lastPoint,
      close: Number(trade.price.toFixed(2)),
      volume: trade.volume || lastPoint.volume
    };
  } else {
    prices.push({
      date: tradeDate,
      close: Number(trade.price.toFixed(2)),
      volume: trade.volume
    });
  }

  return {
    ...current,
    quote: {
      ...current.quote,
      price: Number(trade.price.toFixed(2)),
      changeAmount,
      changePercent,
      updatedAt: new Date(trade.timestamp || Date.now()).toISOString()
    },
    prices
  };
}

function applyOverviewSnapshot(dashboard: DashboardData, overview: MarketOverviewData | null): DashboardData {
  const card = overview?.watchlist.find((item) => item.symbol === dashboard.symbol);
  if (!card) {
    return dashboard;
  }

  const previousClose = card.price - card.dayChange.amount || dashboard.quote.previousClose;
  const prices = dashboard.prices.length
    ? [
      ...dashboard.prices.slice(0, -1),
      {
        ...dashboard.prices[dashboard.prices.length - 1],
        close: card.price
      }
    ]
    : dashboard.prices;

  return {
    ...dashboard,
    quote: {
      ...dashboard.quote,
      name: card.name,
      price: card.price,
      changeAmount: card.dayChange.amount,
      changePercent: card.dayChange.percent,
      previousClose,
      updatedAt: card.updatedAt
    },
    prices
  };
}

function mergeOverviewTrade(current: MarketOverviewData | null, trade: FinnhubTrade): MarketOverviewData | null {
  if (!current || !Number.isFinite(trade.price)) {
    return current;
  }

  const updateCard = (card: MarketCard): MarketCard => {
    if (card.symbol !== trade.symbol) {
      return card;
    }

    const previousClose = card.price - card.dayChange.amount || card.price;
    const changeAmount = Number((trade.price - previousClose).toFixed(2));
    const changePercent = previousClose === 0 ? 0 : Number(((changeAmount / previousClose) * 100).toFixed(2));
    const nextPrice = Number(trade.price.toFixed(2));

    return {
      ...card,
      price: nextPrice,
      dayChange: {
        amount: changeAmount,
        percent: changePercent
      },
      updatedAt: new Date(trade.timestamp || Date.now()).toISOString(),
      sparkline: [...card.sparkline.slice(1), nextPrice]
    };
  };

  return {
    ...current,
    updatedAt: new Date(trade.timestamp || Date.now()).toISOString(),
    watchlist: current.watchlist.map(updateCard)
  };
}

function MarketOverview({
  data,
  loading,
  theme,
  onOpenDetail,
  onAddWatchlist,
  symbols
}: {
  data: MarketOverviewData | null;
  loading: boolean;
  theme: ThemeMode;
  onOpenDetail: (symbol: string) => void;
  onAddWatchlist: (item: WatchlistItem) => Promise<void>;
  symbols: SymbolSearchResult[];
}) {
  const watchCards = data?.watchlist ?? [];
  const [timeFrame, setTimeFrame] = useState<(typeof TRADINGVIEW_TIMEFRAMES)[number]["value"]>("1D");
  const watchSymbols = useMemo(() => new Set(watchCards.map((card) => card.symbol)), [watchCards]);
  const tradingViewSymbolLinks = useMemo(() => (
    watchCards
      .map((card) => ({
        tvSymbol: toTradingViewSymbol(card.symbol),
        appSymbol: card.symbol
      }))
      .filter((item) => item.tvSymbol)
  ), [watchCards]);
  const tradingViewSymbols = useMemo(() => (
    tradingViewSymbolLinks.map((item) => item.tvSymbol)
  ), [tradingViewSymbolLinks]);

  return (
    <>
      <section className="overview-hero">
        <div>
          <span className="eyebrow">Market Overview</span>
          <h1>市场研究总览</h1>
        </div>
        <div className="overview-status">
          <RefreshCw size={18} />
          <span>{loading ? "行情加载中" : `更新 ${formatTime(data?.updatedAt)}`}</span>
        </div>
      </section>

      <section className="overview-section watchlist-surface">
        <TradingViewIndexStrip theme={theme} />
        <div className="section-heading">
          <div>
            <span>Watchlist</span>
            <h2>我的关注</h2>
          </div>
          <WatchlistSearch
            watchSymbols={watchSymbols}
            onAdd={onAddWatchlist}
            symbols={symbols}
          />
        </div>
        <TradingViewMarketSummary
          symbols={tradingViewSymbols}
          loading={loading}
          theme={theme}
          timeFrame={timeFrame}
          onTimeFrameChange={setTimeFrame}
          onOpenDetail={onOpenDetail}
          symbolLinks={tradingViewSymbolLinks}
        />
      </section>
    </>
  );
}

function TradingViewIndexStrip({ theme }: { theme: ThemeMode }) {
  const symbolSectors = JSON.stringify([
    {
      sectionName: "Indices",
      symbols: TRADINGVIEW_INDEX_SYMBOLS
    }
  ]);

  return (
    <section className="tradingview-index-strip" aria-label="三大指数">
      {createElement("tv-market-summary", {
        "symbol-sectors": symbolSectors,
        "show-time-range": "",
        direction: "horizontal",
        "item-size": "compact",
        theme,
        mode: "custom"
      })}
    </section>
  );
}

function TradingViewMarketSummary({
  symbols,
  loading,
  theme,
  timeFrame,
  onTimeFrameChange,
  onOpenDetail,
  symbolLinks
}: {
  symbols: string[];
  loading: boolean;
  theme: ThemeMode;
  timeFrame: (typeof TRADINGVIEW_TIMEFRAMES)[number]["value"];
  onTimeFrameChange: (value: (typeof TRADINGVIEW_TIMEFRAMES)[number]["value"]) => void;
  onOpenDetail: (symbol: string) => void;
  symbolLinks: TradingViewSymbolLink[];
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const marketSymbols = symbols.length > 0 ? symbols : TRADINGVIEW_DEFAULT_SYMBOLS;
  const widgetContentHeight = Math.max(360, 180 + marketSymbols.length * 72);
  const widgetViewportHeight = Math.min(widgetContentHeight, 720);
  const symbolSectors = JSON.stringify([
    {
      sectionName: "Watchlist",
      symbols: marketSymbols
    }
  ]);
  const symbolLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    const add = (key: string, value: string) => {
      const normalized = key.trim().toUpperCase();
      if (normalized) {
        lookup.set(normalized, value);
      }
    };

    for (const item of symbolLinks) {
      add(item.tvSymbol, item.appSymbol);
      const [, ticker] = item.tvSymbol.split(":");
      if (ticker) {
        add(ticker, item.appSymbol);
      }
    }

    return lookup;
  }, [symbolLinks]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const handleLinkOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ context?: { symbol?: string } }>).detail;
      const tvSymbol = detail?.context?.symbol?.trim().toUpperCase();
      if (!tvSymbol) {
        return;
      }

      event.preventDefault();
      const [, ticker] = tvSymbol.split(":");
      onOpenDetail(symbolLookup.get(tvSymbol) ?? (ticker || tvSymbol));
    };

    frame.addEventListener("tv-link-open", handleLinkOpen);
    return () => frame.removeEventListener("tv-link-open", handleLinkOpen);
  }, [onOpenDetail, symbolLookup]);

  return (
    <section
      className="tradingview-watchlist-panel"
      aria-busy={loading}
      style={{
        "--tv-watchlist-height": `${widgetViewportHeight}px`,
        "--tv-watchlist-content-height": `${widgetContentHeight}px`
      } as React.CSSProperties}
    >
      <div className="watchlist-panel-head">
        <div>
          <span>TradingView</span>
          <h3>行情概览</h3>
        </div>
        <div className="timeframe-control" aria-label="切换行情周期">
          {TRADINGVIEW_TIMEFRAMES.map((item) => (
            <button
              className={timeFrame === item.value ? "active" : ""}
              type="button"
              key={item.value}
              onClick={() => onTimeFrameChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="tradingview-widget-frame" ref={frameRef}>
        {createElement("tv-market-summary", {
          key: `${theme}:${timeFrame}:${symbolSectors}`,
          "symbol-sectors": symbolSectors,
          "time-frame": timeFrame,
          "show-time-range": "",
          "layout-mode": "grid",
          theme,
          mode: "custom"
        })}
      </div>
    </section>
  );
}

function WatchlistSearch({
  watchSymbols,
  onAdd,
  symbols
}: {
  watchSymbols: Set<string>;
  onAdd: (item: WatchlistItem) => Promise<void>;
  symbols: SymbolSearchResult[];
}) {
  const [query, setQuery] = useState("");
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const trimmedQuery = query.trim();
  const results = useMemo(() => {
    const normalized = trimmedQuery.toUpperCase();
    if (!normalized) {
      return [];
    }

    return symbols
      .filter((item) => (
        item.symbol.includes(normalized) ||
        item.name.toUpperCase().includes(normalized)
      ))
      .sort((left, right) => {
        const rank = (item: SymbolSearchResult) => {
          const symbol = item.symbol.toUpperCase();
          const name = item.name.toUpperCase();

          if (symbol === normalized) return 0;
          if (symbol.startsWith(normalized)) return 1;
          if (symbol.includes(normalized)) return 2;
          if (name.startsWith(normalized)) return 3;
          if (name.includes(normalized)) return 4;
          return 5;
        };

        return rank(left) - rank(right) || left.symbol.localeCompare(right.symbol);
      })
      .slice(0, 10);
  }, [symbols, trimmedQuery]);

  const addResult = async (result: SymbolSearchResult) => {
    setAddingSymbol(result.symbol);
    try {
      await onAdd({ symbol: result.symbol, name: result.name || result.symbol });
      setQuery("");
      setOpen(false);
    } finally {
      setAddingSymbol(null);
    }
  };

  return (
    <div
      className="watchlist-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <Search size={16} />
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        placeholder="搜索代码或名称"
        aria-label="搜索关注股票"
      />
      {open && trimmedQuery ? (
        <div className="symbol-results">
          {results.length === 0 ? <div className="symbol-result empty">无匹配结果</div> : null}
          {results.map((result) => {
            const added = watchSymbols.has(result.symbol);
            return (
              <div className="symbol-result" key={result.symbol}>
                <div>
                  <strong>{result.symbol}</strong>
                  <span>{result.name}</span>
                </div>
                <button
                  className="add-symbol-button"
                  type="button"
                  onClick={() => addResult(result)}
                  disabled={added || addingSymbol === result.symbol}
                  aria-label={`添加 ${result.symbol} 到我的关注`}
                >
                  <Plus size={16} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function toTradingViewSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    return "";
  }

  if (normalized.includes(":")) {
    return normalized;
  }

  const suffixMap: Record<string, string> = {
    AS: "EURONEXT",
    AT: "ATHEX",
    AX: "ASX",
    BA: "BCBA",
    BK: "SET",
    BO: "BSE",
    BR: "EURONEXT",
    CO: "OMXCOP",
    DE: "XETR",
    F: "FWB",
    HE: "OMXHEX",
    HK: "HKEX",
    IL: "LSE",
    IS: "BIST",
    JK: "IDX",
    JO: "JSE",
    KL: "MYX",
    KQ: "KRX",
    KS: "KRX",
    L: "LSE",
    LS: "EURONEXT",
    MC: "BME",
    MI: "MIL",
    MX: "BMV",
    NS: "NSE",
    NZ: "NZX",
    OL: "OSL",
    PA: "EURONEXT",
    PR: "PSE",
    SA: "BMFBOVESPA",
    SI: "SGX",
    SS: "SSE",
    ST: "OMXSTO",
    SW: "SIX",
    SZ: "SZSE",
    T: "TSE",
    TA: "TASE",
    TO: "TSX",
    TW: "TWSE",
    TWO: "TPEX",
    V: "TSXV",
    VI: "VIE",
    WA: "GPW"
  };
  const suffixes = Object.keys(suffixMap).sort((left, right) => right.length - left.length);
  for (const suffix of suffixes) {
    const token = `.${suffix}`;
    if (normalized.endsWith(token)) {
      return `${suffixMap[suffix]}:${normalized.slice(0, -token.length)}`;
    }
  }

  return normalized;
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatMoney(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) {
    return "--";
  }

  const number = Number(value);
  if (Math.abs(number) >= 1_000_000) {
    return `$${(number / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(number) >= 1_000) {
    return `$${(number / 1_000).toFixed(1)}K`;
  }
  return `$${number.toFixed(0)}`;
}

function formatNullableRatio(value?: number | null) {
  return Number.isFinite(value ?? NaN) ? `${Number(value).toFixed(2)}x` : "--";
}

function formatNullablePercent(value?: number | null) {
  return Number.isFinite(value ?? NaN) ? `${(Number(value) * 100).toFixed(0)}%` : "--";
}

function formatDirection(value: OptionsActivitySymbol["direction"]) {
  const labels = {
    bullish: "偏多",
    bearish: "偏空",
    volatility: "波动率",
    hedge: "对冲",
    mixed: "混合"
  };
  return labels[value] ?? "混合";
}

function formatEventRisk(value: OptionsActivitySymbol["eventRisk"]) {
  const labels = {
    earnings: "财报风险",
    macro: "宏观事件",
    product: "产品事件",
    legal: "法务风险",
    none: "无明显事件"
  };
  return labels[value] ?? "无明显事件";
}

function buildOptionsPlainReadout(item: OptionsActivitySymbol) {
  const directionText = formatDirection(item.direction);
  const continuity = item.activeDays >= 2 ? `连续 ${item.activeDays} 天出现` : "主要是单日放量";
  const volOi = item.volumeOpenInterestRatio
    ? `Vol/OI ${item.volumeOpenInterestRatio.toFixed(2)}x`
    : "Vol/OI 暂无";
  return `${item.symbol} 近三日期权异动${directionText}，${continuity}，估算资金 ${formatMoney(item.totalPremium)}，${volOi}。`;
}

function buildOptionsNextStep(item: OptionsActivitySymbol) {
  if (item.direction === "mixed") {
    return "方向不干净，先看合约是否分散，再查是否有财报、新闻或大盘事件。";
  }
  if (item.direction === "volatility") {
    return "更像押波动，不一定押涨跌；优先检查财报日、IV变化和跨式/宽跨式痕迹。";
  }
  if (item.direction === "hedge") {
    return "可能是保护性仓位，不要直接当看空；需要结合正股持仓和成交价靠近 bid/ask 判断。";
  }
  if ((item.volumeOpenInterestRatio ?? 0) >= 2 && item.activeDays >= 2) {
    return "信号质量较好：资金、放量和连续性同时出现，适合进入股票详情做二次确认。";
  }
  return "信号还需要确认：优先看是否只有一张合约贡献大部分资金。";
}

function formatContractMeaning(contract: OptionsRepresentativeContract) {
  const typeText = contract.type === "call" ? "看涨" : "看跌";
  const sideText = contract.sideEstimate === "ask"
    ? "更像主动买入"
    : contract.sideEstimate === "bid"
      ? "更像主动卖出"
      : "成交方向不明";
  return `${typeText} · ${sideText}`;
}

function formatMetricText(value?: string | number | null) {
  if (value === undefined || value === null || value === "") {
    return "--";
  }

  return String(value);
}

function formatMetricPercent(value?: string | null) {
  if (!value) {
    return "--";
  }

  return value.endsWith("%") ? value : `${value}%`;
}

function formatMetricCompact(value?: string | number | null) {
  if (value === undefined || value === null || value === "") {
    return "--";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return String(value);
  }

  return Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(number);
}

function formatCurrencyValue(value?: string | null, currency = "") {
  if (!value) {
    return "--";
  }

  return `${currency}${value}`;
}

function formatTimestampDate(value?: string | null) {
  if (!value || value === "0") {
    return "--";
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return value;
  }

  return new Date(number > 1_000_000_000_000 ? number : number * 1000).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  });
}

function sumRatingCounts(evaluate?: RatingEvaluate | null) {
  if (!evaluate) {
    return 0;
  }

  return (evaluate.buy ?? 0) + (evaluate.hold ?? 0) + (evaluate.sell ?? 0);
}

function ratingPercent(value: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (value / total) * 100));
}

function getHeadlineKeyMetrics(calcInfo?: SecurityCalcInfo | null) {
  return [
    { label: "年初至今", value: formatMetricPercent(calcInfo?.ytdChangeRate) },
    { label: "半年", value: formatMetricPercent(calcInfo?.halfYearChangeRate) },
    { label: "10日", value: formatMetricPercent(calcInfo?.tenDayChangeRate) },
    { label: "5日", value: formatMetricPercent(calcInfo?.fiveDayChangeRate) },
    { label: "5分钟", value: formatMetricPercent(calcInfo?.fiveMinutesChangeRate) },
    { label: "振幅", value: formatMetricPercent(calcInfo?.amplitude) }
  ];
}

function getTradingActivityMetrics(calcInfo?: SecurityCalcInfo | null) {
  return [
    { label: "成交量", value: formatMetricCompact(calcInfo?.volume) },
    { label: "成交额", value: formatMetricCompact(calcInfo?.turnover) },
    { label: "换手率", value: formatMetricPercent(calcInfo?.turnoverRate) },
    { label: "资金流", value: formatMetricCompact(calcInfo?.capitalFlow) }
  ];
}

function getFinancialReportMetrics(staticInfo?: SecurityStaticInfo | null, calcInfo?: SecurityCalcInfo | null) {
  return [
    { label: "PE TTM", value: formatMetricText(calcInfo?.peTtmRatio) },
    { label: "PB", value: formatMetricText(calcInfo?.pbRatio) },
    { label: "EPS", value: formatMetricText(calcInfo?.eps ?? staticInfo?.epsTtm ?? staticInfo?.eps) },
    { label: "BPS", value: formatMetricText(staticInfo?.bps) },
    { label: "股息 TTM", value: formatMetricPercent(calcInfo?.dividendRatioTtm ?? staticInfo?.dividendYield) },
    { label: "总股本", value: formatMetricCompact(staticInfo?.totalShares) },
    { label: "流通股本", value: formatMetricCompact(staticInfo?.circulatingShares) },
    { label: "货币", value: formatMetricText(staticInfo?.currency) }
  ];
}

function formatTime(value?: string) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getNewsKey(item: NewsItem) {
  return item.url || `${item.title}:${item.time}`;
}

function OptionsActivityHome({
  data,
  loading,
  error,
  onOpenDetail
}: {
  data: OptionsHomeData | null;
  loading: boolean;
  error: string | null;
  onOpenDetail: (symbol: string) => void;
}) {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const symbols = data?.symbols ?? [];
  const selected = symbols.find((item) => item.symbol === selectedSymbol) ?? symbols[0] ?? null;

  useEffect(() => {
    if (!selectedSymbol && symbols.length > 0) {
      setSelectedSymbol(symbols[0].symbol);
    }
  }, [selectedSymbol, symbols]);

  const metrics = [
    { label: "异动标的", value: loading ? "--" : String(data?.summary.unusualSymbolCount ?? 0), hint: "近3日有明显期权放量的股票数", guide: "先从这里判断自选池今天热不热。" },
    { label: "新增异动", value: loading ? "--" : String(data?.summary.newUnusualSymbols ?? 0), hint: "这次才进入异动榜的股票", guide: "新增多，说明资金兴趣正在切换。" },
    { label: "Call/Put 溢价", value: loading ? "--" : formatNullableRatio(data?.summary.premiumCallPutRatio), hint: "Call成交金额 / Put成交金额", guide: "大于1偏看涨，小于1偏防守或看跌。" },
    { label: "持续异动", value: loading ? "--" : formatNullablePercent(data?.summary.persistentSymbolRate), hint: "连续2天以上异动占比", guide: "越高越像持续布局，越低越像单日噪音。" }
  ];

  return (
    <section className="options-home">
      <header className="options-topbar">
        <div>
          <span className="eyebrow">Options Review</span>
          <h1>期权异动复盘</h1>
          <p>{data?.poolName ?? "自选池"} · {data?.window ?? "T-3"} · {formatTime(data?.updatedAt)}</p>
          <small>先看异动强度，再看方向是否干净，最后确认是否连续。这里不是买卖建议，只是帮你缩小复盘范围。</small>
        </div>
        <div className="options-controls">
          <div className="segmented-control" aria-label="时间窗口">
            <button className="active">T-3</button>
            <button>T-1</button>
            <button>T-5</button>
          </div>
          <button className="icon-button" aria-label="刷新期权异动">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {error ? <p className="view-error">{error}</p> : null}

      <div className="options-kpi-strip">
        {metrics.map((metric) => (
          <div className="options-kpi" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em>{metric.hint}</em>
            <p>{metric.guide}</p>
          </div>
        ))}
      </div>

      <div className="options-main-grid">
        <section className="options-ranking">
          <div className="section-heading compact">
            <div>
              <span>Ranking</span>
              <h2>标的异动排名</h2>
            </div>
            <strong className={`data-source ${data?.source === "massive" ? "live" : ""}`}>
              {data?.source === "massive" ? "Massive" : "Preview"}
            </strong>
          </div>

          <div className="options-table">
            <div className="options-table-head">
              <span>股票</span>
              <span title="异动强度分，越高越值得复盘。">强度</span>
              <span title="期权成交金额估算，约等于价格 * 成交量 * 100。">资金</span>
              <span>Vol/OI</span>
              <span title="偏多/偏空/波动率/对冲/混合。">方向</span>
              <span title="近3天里出现异动的天数。">连续</span>
            </div>
            {loading ? (
              Array.from({ length: 5 }, (_, index) => <div className="options-row skeleton" key={index} />)
            ) : symbols.length === 0 ? (
              <p className="empty-state">暂无期权异动数据。</p>
            ) : symbols.map((item) => (
              <button
                className={`options-row ${selected?.symbol === item.symbol ? "selected" : ""}`}
                key={item.symbol}
                onClick={() => setSelectedSymbol(item.symbol)}
              >
                <span>
                  <strong>{item.symbol}</strong>
                  <small>{item.name}</small>
                </span>
                <b>{item.score}</b>
                <span>{formatMoney(item.totalPremium)}</span>
                <span>{formatNullableRatio(item.volumeOpenInterestRatio)}</span>
                <em className={`direction-chip ${item.direction}`}>{formatDirection(item.direction)}</em>
                <span>{item.activeDays}/3</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="options-insight">
          {selected ? (
            <>
              <div className="plain-readout">
                <strong>{buildOptionsPlainReadout(selected)}</strong>
                <p>{buildOptionsNextStep(selected)}</p>
              </div>

              <div className="insight-symbol-header">
                <div>
                  <span>Selected</span>
                  <h2>{selected.symbol}</h2>
                  <p>{selected.name}</p>
                </div>
                <button className="ghost-button" onClick={() => onOpenDetail(selected.symbol)}>
                  股票详情
                </button>
              </div>

              <div className="options-snapshot-grid">
                <div><span>股价</span><strong>{selected.price ? `$${selected.price.toFixed(2)}` : "--"}</strong></div>
                <div><span>3日涨跌</span><strong>{formatSignedPercent(selected.priceChange3d ?? 0)}</strong></div>
                <div><span>相对量</span><strong>{formatNullableRatio(selected.relativeVolume)}</strong></div>
                <div><span>IV变化</span><strong>{formatSignedPercent((selected.ivChange ?? 0) * 100)}</strong></div>
              </div>

              <div className="interpretation-tags">
                <span>{formatDirection(selected.direction)}</span>
                <span>{selected.eventRisk === "none" ? "无明显事件" : formatEventRisk(selected.eventRisk)}</span>
                <span>{selected.activeDays >= 2 ? "连续异动" : "单日放量"}</span>
              </div>

              <div className="contract-list">
                {selected.contracts.map((contract) => (
                  <div className="contract-card" key={contract.contractSymbol}>
                    <div>
                      <strong>{contract.type.toUpperCase()} {contract.strike}</strong>
                      <span>{contract.expiration} · {formatContractMeaning(contract)}</span>
                    </div>
                    <div>
                      <b>{formatMoney(contract.premium)}</b>
                      <span>成交 {contract.volume.toLocaleString()} · 未平仓 {contract.openInterest?.toLocaleString() ?? "--"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-state">选择一个标的查看合约解释。</p>
          )}
        </aside>
      </div>

      <section className="options-timeline">
        <div className="section-heading compact">
          <div>
            <span>Persistence</span>
            <h2>三日连续性</h2>
            <p>看资金是不是连续出现：连续高分比单日爆量更值得复盘。</p>
          </div>
        </div>
        <div className="timeline-grid">
          {symbols.slice(0, 8).map((item) => (
            <div className="timeline-row" key={item.symbol}>
              <strong>{item.symbol}</strong>
              {item.timeline.map((day) => (
                <div className={`timeline-cell ${day.direction}`} key={`${item.symbol}-${day.date}`}>
                  <span>{day.date.slice(5)}</span>
                  <b>{day.score}</b>
                  <em>{formatMoney(day.premium)}</em>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function NewsSentimentView({
  data,
  loading,
  error,
  onOpenDetail
}: {
  data: NewsPageData | null;
  loading: boolean;
  error: string | null;
  onOpenDetail: (symbol: string) => void;
}) {
  const summary = data?.summary;

  return (
    <section className="news-page">
      <header className="news-page-hero">
        <div>
          <span>News Sentiment</span>
          <h1>市场新闻情绪</h1>
          <p>从全市场、宏观政策、热点主题到自选股新闻，按相关度与时间整理。</p>
        </div>
        <div className="news-hero-metrics">
          <Metric icon={<Newspaper size={18} />} label="新闻数" value={loading ? "--" : `${summary?.articleCount ?? 0}`} />
          <Metric icon={<Activity size={18} />} label="情绪" value={loading ? "--" : formatStance(summary?.stance)} />
          <Metric icon={<Gauge size={18} />} label="均分" value={loading ? "--" : formatMetricText(summary?.averageScore)} />
        </div>
      </header>

      {error ? <p className="inline-note error">{error}</p> : null}

      <section className="news-page-grid">
        <div className="news-main-column">
          <NewsBucketPanel title="市场总览" bucket={data?.market ?? null} loading={loading} />
          <section className="news-section">
            <div className="section-heading compact">
              <div>
                <span>Macro Policy</span>
                <h2>宏观与政策</h2>
              </div>
              <Database size={20} />
            </div>
            <div className="macro-news-grid">
              <NewsBucketPanel title="美联储与货币政策" bucket={data?.macro.monetary ?? null} loading={loading} compact />
              <NewsBucketPanel title="财政政策" bucket={data?.macro.fiscal ?? null} loading={loading} compact />
              <NewsBucketPanel title="宏观经济" bucket={data?.macro.macro ?? null} loading={loading} compact />
            </div>
          </section>
          <section className="news-section">
            <div className="section-heading compact">
              <div>
                <span>Market Themes</span>
                <h2>市场热点</h2>
              </div>
              <Sparkles size={20} />
            </div>
            <div className="topic-news-grid">
              {(data?.topics ?? []).map((topic) => (
                <NewsTopicCard topic={topic} key={topic.topic} loading={loading} />
              ))}
            </div>
          </section>
        </div>

        <aside className="news-side-column">
          <section className="news-section">
            <div className="section-heading compact">
              <div>
                <span>Watchlist</span>
                <h2>自选股新闻</h2>
              </div>
              <TrendingUp size={20} />
            </div>
            <div className="watchlist-news-stack">
              {(data?.watchlist ?? []).map((bucket) => (
                <div className="watchlist-news-card" key={bucket.symbol}>
                  <button type="button" onClick={() => onOpenDetail(bucket.symbol)}>
                    <strong>{bucket.symbol}</strong>
                    <span>{bucket.articleCount} 条 · {formatStance(bucket.stance)}</span>
                  </button>
                  <NewsArticleList articles={bucket.articles.slice(0, 3)} loading={loading} compact />
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </section>
  );
}

function NewsBucketPanel({
  title,
  bucket,
  loading,
  compact = false
}: {
  title: string;
  bucket: NewsBucket | null;
  loading: boolean;
  compact?: boolean;
}) {
  return (
    <section className={`news-section ${compact ? "compact-news-section" : ""}`}>
      <div className="news-bucket-head">
        <div>
          <h3>{title}</h3>
          <span>{loading ? "--" : `${bucket?.articleCount ?? 0} 条 · ${formatStance(bucket?.stance)}`}</span>
        </div>
        <b>{loading ? "--" : formatMetricText(bucket?.averageScore)}</b>
      </div>
      <NewsArticleList articles={bucket?.articles ?? []} loading={loading} compact={compact} />
    </section>
  );
}

function NewsTopicCard({ topic, loading }: { topic: NewsTopicBucket; loading: boolean }) {
  return (
    <article className="topic-news-card">
      <div className="news-bucket-head">
        <div>
          <h3>{topic.label}</h3>
          <span>{loading ? "--" : `${topic.articleCount} 条 · ${formatStance(topic.stance)}`}</span>
        </div>
        <b>{loading ? "--" : formatMetricText(topic.averageScore)}</b>
      </div>
      <NewsArticleList articles={topic.articles.slice(0, 2)} loading={loading} compact />
    </article>
  );
}

function NewsArticleList({
  articles,
  loading,
  compact = false
}: {
  articles: NewsItem[];
  loading: boolean;
  compact?: boolean;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const visibleArticles = loading ? [] : articles;

  if (loading) {
    return <p className="empty-state">新闻加载中...</p>;
  }

  if (visibleArticles.length === 0) {
    return <p className="empty-state">暂无新闻。</p>;
  }

  return (
    <div className={`news-list ${compact ? "compact" : ""}`}>
      {visibleArticles.map((item) => {
        const key = getNewsKey(item);
        return (
          <article className="news-item" key={key}>
            <div className={`sentiment ${item.sentiment}`} aria-hidden="true" />
            <div className="news-content">
              <button
                className="news-toggle"
                type="button"
                onClick={() => setExpandedKey((current) => current === key ? null : key)}
              >
                <strong>{item.title}</strong>
                <span>{item.source} · {formatTime(item.time)}</span>
              </button>
              {expandedKey === key ? (
                <div className="news-detail">
                  <p>{item.summary || "暂无摘要。"}</p>
                  <div className="news-tags">
                    <span>{item.tickerSentimentLabel ?? item.sentimentLabel ?? "Neutral"}</span>
                    {item.relevanceScore !== undefined && item.relevanceScore !== null ? <span>相关度 {item.relevanceScore.toFixed(2)}</span> : null}
                  </div>
                  {item.url ? <a href={item.url} target="_blank" rel="noreferrer">打开新闻源</a> : null}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function formatStance(value?: string | null) {
  if (value === "positive") {
    return "偏多";
  }
  if (value === "negative") {
    return "偏空";
  }
  return "中性";
}

function getRealtimeLabel(status: FinnhubStatus | null) {
  if (!window.tradeAssistant) {
    return "Mock";
  }

  if (!status) {
    return "连接中";
  }

  return status.connected ? "Finnhub Live" : "无法获取";
}

export default App;

function PositionsView({
  broker,
  data,
  error,
  loading,
  onBrokerChange,
  onRefresh
}: {
  broker: BrokerId;
  data: PositionsResponse | null;
  error: string | null;
  loading: boolean;
  onBrokerChange: (broker: BrokerId) => void;
  onRefresh: () => void;
}) {
  const positions = data?.positions ?? [];
  const totalShares = positions.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const markets = new Set(positions.map((item) => item.market).filter(Boolean)).size;
  const currencies = Array.from(new Set(positions.map((item) => item.currency).filter(Boolean))).join(" / ") || "--";

  return (
    <>
      <header className="positions-topbar">
        <div className="broker-select">
          <span>券商</span>
          <select value={broker} onChange={(event) => onBrokerChange(event.target.value as BrokerId)}>
            <option value="longbridge">长桥证券</option>
          </select>
        </div>

        <div className="top-actions">
          <button className="ghost-button" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={16} /> 刷新持仓
          </button>
          <button className="icon-button" aria-label="通知"><Bell size={18} /></button>
          <button className="icon-button" aria-label="设置"><Settings2 size={18} /></button>
        </div>
      </header>

      <section className="positions-hero">
        <div>
          <span className="eyebrow">Portfolio</span>
          <h1>我的持仓</h1>
          <p>按券商账户聚合股票持仓，后续可扩展盈亏、行情同步和风险暴露分析。</p>
        </div>
        <div className="portfolio-metrics">
          <Metric icon={<WalletCards size={18} />} label="持仓标的" value={`${positions.length}`} />
          <Metric icon={<CircleDollarSign size={18} />} label="持仓股数" value={`${Number.isFinite(totalShares) ? totalShares.toLocaleString() : "--"}`} />
          <Metric icon={<Gauge size={18} />} label="市场 / 币种" value={`${markets || "--"} / ${currencies}`} />
        </div>
      </section>

      {data?.message ? <div className="inline-note">{data.message}</div> : null}
      {error ? <div className="inline-note error">{error}</div> : null}

      <section className="positions-panel">
        <div className="section-heading">
          <div>
            <span>Holdings</span>
            <h2>{broker === "longbridge" ? "长桥股票持仓" : "股票持仓"}</h2>
          </div>
          <strong className={data?.mode === "error" ? "error" : undefined}>
            {data?.mode === "live" ? "Live" : "Error"}
          </strong>
        </div>

        <div className="positions-table">
          <div className="positions-row header">
            <span>标的</span>
            <span>市场</span>
            <span>账户</span>
            <span>持仓</span>
            <span>可用</span>
            <span>成本价</span>
            <span>币种</span>
          </div>

          {positions.map((item) => (
            <div className="positions-row" key={`${item.accountChannel}-${item.symbol}`}>
              <div className="position-symbol">
                <strong>{item.symbol}</strong>
                <span>{item.name || "--"}</span>
              </div>
              <span>{item.market || "--"}</span>
              <span>{item.accountChannel || "--"}</span>
              <strong>{formatNumber(item.quantity)}</strong>
              <span>{formatNumber(item.availableQuantity)}</span>
              <span>{item.costPrice || "--"}</span>
              <span>{item.currency || "--"}</span>
            </div>
          ))}

          {!loading && positions.length === 0 ? (
            <div className="empty-state">暂无持仓数据</div>
          ) : null}

          {loading ? <div className="empty-state">正在加载持仓...</div> : null}
        </div>
      </section>
    </>
  );
}

function formatNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : value || "--";
}
