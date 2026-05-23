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
  Newspaper,
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
  news: Array<{ title: string; source: string; time: string; sentiment: string }>;
  analysis: {
    stance: string;
    buyZone: string;
    sellZone: string;
    risk: string;
    summary: string;
  };
};

type ViewId = "research" | "positions";
type ResearchMode = "overview" | "detail";

const watchlist = [
  { symbol: "NVDA", label: "NVIDIA", change: "+2.84%", state: "强势突破" },
  { symbol: "MSFT", label: "Microsoft", change: "+0.91%", state: "稳步抬升" },
  { symbol: "TSLA", label: "Tesla", change: "-1.18%", state: "高波动" },
  { symbol: "AMD", label: "AMD", change: "+1.46%", state: "量能恢复" }
];

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

function buildBrowserFallbackOverview(): MarketOverviewData {
  return {
    updatedAt: new Date().toISOString(),
    indexes: [
      buildOverviewCard("IXIC", "NASDAQ Composite", "index", 18940),
      buildOverviewCard("SPX", "S&P 500", "index", 5824),
      buildOverviewCard("DJI", "Dow Jones", "index", 42112)
    ],
    watchlist: [
      buildOverviewCard("NVDA", "NVIDIA", "stock", 213),
      buildOverviewCard("MSFT", "Microsoft", "stock", 487),
      buildOverviewCard("TSLA", "Tesla", "stock", 178),
      buildOverviewCard("AMD", "AMD", "stock", 163),
      buildOverviewCard("AAPL", "Apple", "stock", 198),
      buildOverviewCard("META", "Meta Platforms", "stock", 642)
    ],
    macro: [
      buildOverviewCard("XAUUSD", "Gold Spot", "macro", 2375),
      buildOverviewCard("WTI", "WTI Crude Oil", "macro", 78),
      buildOverviewCard("DXY", "US Dollar Index", "macro", 104)
    ]
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
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [clientState, setClientState] = useState<"加载中" | "本地就绪" | "浏览器预览" | "不可用">("加载中");
  const [longbridgeStatus, setLongbridgeStatus] = useState<LongbridgeStatus | null>(null);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [finnhubStatus, setFinnhubStatus] = useState<FinnhubStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const hasDesktopBridge = Boolean(window.tradeAssistant);
    const dashboardPromise = hasDesktopBridge
      ? window.tradeAssistant!.getDashboard(symbol)
      : Promise.resolve(buildBrowserFallback(symbol));

    dashboardPromise
      .then((payload: DashboardData) => {
        if (!cancelled) {
          setData(payload);
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
    });

    return () => {
      removeStatusListener();
      removeTradeListener();
    };
  }, []);

  useEffect(() => {
    if (!window.tradeAssistant || activeView !== "research" || researchMode !== "detail") {
      void window.tradeAssistant?.unsubscribeFinnhub?.();
      setFinnhubStatus(null);
      return;
    }

    void window.tradeAssistant.subscribeFinnhub(symbol);

    return () => {
      void window.tradeAssistant?.unsubscribeFinnhub?.();
    };
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
              />
            ) : (
              <>
                <button className="back-button" onClick={() => setResearchMode("overview")}>
                  <ChevronLeft size={16} /> 返回市场总览
                </button>

                <section className="hero-band">
          <div>
            <span className="eyebrow">Finnhub Live Research Console</span>
            <h1>{data?.symbol ?? symbol} 智能交易研究台</h1>
            <p>先用 Finnhub REST 补齐历史 K 线与当前快照，再用单连接 WebSocket 接力实时成交价。</p>
          </div>
          <div className="hero-metrics">
            <Metric icon={<CircleDollarSign size={18} />} label="最新价" value={loading ? "--" : `$${data?.quote.price.toFixed(2)}`} />
            <Metric icon={<TrendingUp size={18} />} label="日内变化" value={loading ? "--" : `${formatSigned(data?.quote.changeAmount ?? 0)} / ${formatSignedPercent(data?.quote.changePercent ?? 0)}`} />
            <Metric icon={<Gauge size={18} />} label="实时连接" value={getRealtimeLabel(finnhubStatus)} />
          </div>
                </section>

                <section className="content-grid">
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
                <article className="news-item" key={item.title}>
                  <div className={`sentiment ${item.sentiment}`} />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.source} · {item.time}</span>
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

function MarketOverview({
  data,
  loading,
  onOpenDetail
}: {
  data: MarketOverviewData | null;
  loading: boolean;
  onOpenDetail: (symbol: string) => void;
}) {
  const indexes = data?.indexes ?? [];
  const watchCards = data?.watchlist ?? [];
  const macro = data?.macro ?? [];

  return (
    <>
      <section className="overview-hero">
        <div>
          <span className="eyebrow">Market Overview</span>
          <h1>市场研究总览</h1>
          <p>先看三大指数的实时波动，再扫自选关注股票。点击任意股票卡片进入详情研究。</p>
        </div>
        <div className="overview-status">
          <RefreshCw size={18} />
          <span>{loading ? "行情加载中" : `更新 ${formatTime(data?.updatedAt)}`}</span>
        </div>
      </section>

      <section className="overview-section">
        <div className="section-heading">
          <div>
            <span>Major Indexes</span>
            <h2>三大指数</h2>
          </div>
        </div>
        <div className="market-card-grid indexes">
          {indexes.map((card) => (
            <MarketSummaryCard card={card} key={card.symbol} onOpenDetail={onOpenDetail} />
          ))}
        </div>
      </section>

      <section className="overview-section">
        <div className="section-heading">
          <div>
            <span>Watchlist</span>
            <h2>我的关注</h2>
          </div>
          <button className="ghost-button">管理自选</button>
        </div>
        <div className="market-card-grid watch">
          {watchCards.map((card) => (
            <MarketSummaryCard card={card} key={card.symbol} onOpenDetail={onOpenDetail} />
          ))}
        </div>
      </section>

      <section className="macro-dock" aria-label="宏观价格">
        {macro.map((card) => (
          <button className="macro-tile" key={card.symbol} onClick={() => onOpenDetail(card.symbol)}>
            <span>{card.name}</span>
            <strong>{formatPrice(card)}</strong>
            <ChangeText change={card.dayChange} />
          </button>
        ))}
      </section>
    </>
  );
}

function MarketSummaryCard({
  card,
  onOpenDetail
}: {
  card: MarketCard;
  onOpenDetail: (symbol: string) => void;
}) {
  return (
    <button className={`market-summary-card ${card.dayChange.percent >= 0 ? "positive" : "negative"}`} onClick={() => onOpenDetail(card.symbol)}>
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

function formatTime(value?: string) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
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
