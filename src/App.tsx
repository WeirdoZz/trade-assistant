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

const fallbackApi = "http://127.0.0.1:8765";
const apiBaseUrl = window.tradeAssistant?.apiBaseUrl ?? fallbackApi;

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

function App() {
  const [symbol, setSymbol] = useState("NVDA");
  const [query, setQuery] = useState("NVDA");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiState, setApiState] = useState<"连接中" | "已连接" | "离线">("连接中");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`${apiBaseUrl}/api/dashboard?symbol=${encodeURIComponent(symbol)}`)
      .then((response) => response.json())
      .then((payload: DashboardData) => {
        if (!cancelled) {
          setData(payload);
          setApiState("已连接");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiState("离线");
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
          <button className="nav-item active"><LineChart size={18} /> 市场研究</button>
          <button className="nav-item"><Newspaper size={18} /> 新闻情绪</button>
          <button className="nav-item"><WalletCards size={18} /> 期权异动</button>
          <button className="nav-item"><BrainCircuit size={18} /> AI 策略</button>
          <button className="nav-item"><Database size={18} /> 数据源</button>
        </nav>

        <section className="source-panel">
          <div className="panel-title">
            <Zap size={16} />
            长桥 OpenAPI
          </div>
          <p>行情、新闻、期权链与逐笔异动接口预留中。</p>
          <div className={`status-pill ${apiState === "已连接" ? "online" : ""}`}>
            <span />
            Python API {apiState}
          </div>
        </section>
      </aside>

      <section className="workspace">
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
            <p>聚合近月趋势、新闻情绪、期权流、技术信号与大模型分析，先从占位数据开始，下一步接入真实长桥数据。</p>
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
