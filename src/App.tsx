import { useEffect, useMemo, useState } from "react";
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
  MoreHorizontal,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  WalletCards,
  Zap
} from "lucide-react";

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

type ViewId = "research" | "positions";
type ResearchMode = "overview" | "detail";

const watchlist = [
  { symbol: "NVDA", label: "NVIDIA", change: "+2.84%", state: "强势突破" },
  { symbol: "MSFT", label: "Microsoft", change: "+0.91%", state: "稳步抬升" },
  { symbol: "TSLA", label: "Tesla", change: "-1.18%", state: "高波动" },
  { symbol: "AMD", label: "AMD", change: "+1.46%", state: "量能恢复" }
];

const browserWatchlistKey = "trade-assistant.watchlist";

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

function App() {
  const [activeView, setActiveView] = useState<ViewId>("research");
  const [researchMode, setResearchMode] = useState<ResearchMode>("overview");
  const [broker, setBroker] = useState<BrokerId>("longbridge");
  const [symbol, setSymbol] = useState("NVDA");
  const [query, setQuery] = useState("NVDA");
  const [data, setData] = useState<DashboardData | null>(null);
  const [overviewData, setOverviewData] = useState<MarketOverviewData | null>(null);
  const [positionsData, setPositionsData] = useState<PositionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
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
    return {
      grid: { top: 24, left: 48, right: 24, bottom: 38 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#101820",
        borderColor: "#2a3948",
        textStyle: { color: "#f4f7fb" }
      },
      xAxis: {
        type: "category",
        data: prices.map((point) => point.date.slice(5)),
        axisLine: { lineStyle: { color: "#354454" } },
        axisLabel: { color: "#91a1b3" }
      },
      yAxis: {
        type: "value",
        scale: true,
        splitLine: { lineStyle: { color: "#1d2a36" } },
        axisLabel: { color: "#91a1b3" }
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
  }, [data]);
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
    <main className="app-shell">
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
          <button className="nav-item"><Newspaper size={18} /> 新闻情绪</button>
          <button className="nav-item"><Activity size={18} /> 期权异动</button>
          <button className="nav-item"><BrainCircuit size={18} /> AI 策略</button>
          <button className="nav-item"><Database size={18} /> 数据源</button>
        </nav>

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
                onOpenDetail={openResearchDetail}
                onAddWatchlist={addToWatchlist}
                onRemoveWatchlist={removeFromWatchlist}
                symbols={usSymbols}
              />
            ) : (
              <>
                <button className="back-button" onClick={() => setResearchMode("overview")}>
                  <ChevronLeft size={16} /> 返回市场总览
                </button>

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
  onOpenDetail,
  onAddWatchlist,
  onRemoveWatchlist,
  symbols
}: {
  data: MarketOverviewData | null;
  loading: boolean;
  onOpenDetail: (symbol: string) => void;
  onAddWatchlist: (item: WatchlistItem) => Promise<void>;
  onRemoveWatchlist: (symbol: string) => Promise<void>;
  symbols: SymbolSearchResult[];
}) {
  const watchCards = data?.watchlist ?? [];
  const watchSymbols = useMemo(() => new Set(watchCards.map((card) => card.symbol)), [watchCards]);

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

      <section className="overview-section">
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
        <div className="market-card-grid watch">
          {watchCards.map((card) => (
            <MarketSummaryCard
              card={card}
              key={card.symbol}
              onOpenDetail={onOpenDetail}
              onRemove={onRemoveWatchlist}
            />
          ))}
        </div>
      </section>
    </>
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

function MarketSummaryCard({
  card,
  onOpenDetail,
  onRemove
}: {
  card: MarketCard;
  onOpenDetail: (symbol: string) => void;
  onRemove: (symbol: string) => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const removeCard = async () => {
    setRemoving(true);
    try {
      await onRemove(card.symbol);
      setMenuOpen(false);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <article
      className={`market-summary-card ${card.dayChange.percent >= 0 ? "positive" : "negative"}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setMenuOpen(false);
        }
      }}
    >
      <button className="market-card-action" type="button" onClick={() => onOpenDetail(card.symbol)}>
        <div className="market-card-head">
          <div>
            <strong>{card.symbol}</strong>
            <span>{card.name}</span>
          </div>
          <ChangeText change={card.dayChange} />
        </div>
        <div className="market-price-row">
          <b>{formatPrice(card)}</b>
          <span>今日 {formatSigned(card.dayChange.amount)} / {formatSignedPercent(card.dayChange.percent)}</span>
        </div>
        <Sparkline values={card.sparkline} positive={card.dayChange.percent >= 0} />
        <div className="period-grid">
          <PeriodCell label="5日" value={card.performance["5d"]} />
          <PeriodCell label="10日" value={card.performance["10d"]} />
          <PeriodCell label="15日" value={card.performance["15d"]} />
        </div>
      </button>
      <button
        className="market-card-menu-button"
        type="button"
        aria-label={`${card.symbol} 更多操作`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <MoreHorizontal size={18} />
      </button>
      {menuOpen ? (
        <div className="market-card-menu" role="menu">
          <button type="button" role="menuitem" onClick={removeCard} disabled={removing}>
            Remove
          </button>
        </div>
      ) : null}
    </article>
  );
}

function PeriodCell({ label, value }: { label: string; value: PeriodReturn }) {
  return (
    <div className={value.percent >= 0 ? "period-cell positive" : "period-cell negative"}>
      <span>{label}</span>
      <strong>{formatSigned(value.amount)}</strong>
      <b>{formatSignedPercent(value.percent)}</b>
    </div>
  );
}

function ChangeText({ change }: { change: PeriodReturn }) {
  return (
    <span className={`change-text ${change.percent >= 0 ? "positive" : "negative"}`}>
      {formatSigned(change.amount)} / {formatSignedPercent(change.percent)}
    </span>
  );
}

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) {
    return <div className="sparkline" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 42 - ((value - min) / range) * 34;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  return (
    <svg className="sparkline" viewBox="0 0 100 48" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={positive ? "#3ddc97" : "#ff8b7f"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatPrice(card: MarketCard) {
  if (card.kind === "index") {
    return card.price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  return `$${card.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
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
