import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import {
  Activity,
  Bell,
  Bot,
  BrainCircuit,
  CandlestickChart,
  ChevronDown,
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
    changePercent: number;
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

  return {
    symbol: normalized,
    quote: {
      name: `${normalized} Inc.`,
      price: lastClose,
      changePercent: 1.26,
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
  const [broker, setBroker] = useState<BrokerId>("longbridge");
  const [symbol, setSymbol] = useState("NVDA");
  const [query, setQuery] = useState("NVDA");
  const [data, setData] = useState<DashboardData | null>(null);
  const [positionsData, setPositionsData] = useState<PositionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [clientState, setClientState] = useState<"加载中" | "本地就绪" | "不可用">("加载中");
  const [longbridgeStatus, setLongbridgeStatus] = useState<LongbridgeStatus | null>(null);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const dashboardPromise = window.tradeAssistant?.getDashboard(symbol) ?? Promise.resolve(buildBrowserFallback(symbol));

    dashboardPromise
      .then((payload: DashboardData) => {
        if (!cancelled) {
          setData(payload);
          setClientState("本地就绪");
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
    }
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

            <section className="hero-band">
          <div>
            <span className="eyebrow">Longbridge-ready Research Console</span>
            <h1>{data?.symbol ?? symbol} 智能交易研究台</h1>
            <p>桌面端本地聚合近月趋势、新闻情绪、期权流、技术信号与大模型分析，下一步会由 Electron 主进程直连长桥 API。</p>
          </div>
          <div className="hero-metrics">
            <Metric icon={<CircleDollarSign size={18} />} label="最新价" value={loading ? "--" : `$${data?.quote.price}`} />
            <Metric icon={<TrendingUp size={18} />} label="日内变化" value={loading ? "--" : `${data?.quote.changePercent}%`} />
            <Metric icon={<Gauge size={18} />} label="策略倾向" value={data?.analysis.stance ?? "--"} />
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
                  setQuery(item.symbol);
                  setSymbol(item.symbol);
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
