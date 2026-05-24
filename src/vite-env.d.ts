/// <reference types="vite/client" />

interface Window {
  tradeAssistant?: {
    platform: string;
    getDashboard: (symbol: string) => Promise<DashboardData>;
    getMarketOverview: () => Promise<MarketOverviewData>;
    getNewsPage: () => Promise<NewsPageData>;
    getOptionsHome: () => Promise<OptionsHomeData>;
    getUsSymbols: () => Promise<SymbolSearchResult[]>;
    addWatchlistItem: (item: WatchlistItem) => Promise<WatchlistItem[]>;
    removeWatchlistItem: (symbol: string) => Promise<WatchlistItem[]>;
    subscribeFinnhub: (symbol: string) => Promise<FinnhubStatus>;
    unsubscribeFinnhub: () => Promise<FinnhubStatus>;
    onFinnhubStatus: (handler: (status: FinnhubStatus) => void) => () => void;
    onFinnhubTrade: (handler: (trade: FinnhubTrade) => void) => () => void;
    onUsSymbolsUpdated: (handler: (symbols: SymbolSearchResult[]) => void) => () => void;
    getPositions: (broker: BrokerId) => Promise<PositionsResponse>;
    getLongbridgeStatus: () => Promise<LongbridgeStatus>;
    startLongbridgeOAuth: (options?: { force?: boolean }) => Promise<LongbridgeStatus>;
  };
}

type BrokerId = "longbridge";

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
  prices: Array<{
    date: string;
    close: number;
    volume: number;
  }>;
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

type OptionsHomeData = {
  updatedAt: string;
  window: "T-1" | "T-3" | "T-5";
  poolName: string;
  source: "massive" | "fallback";
  summary: OptionsHomeSummary;
  symbols: OptionsActivitySymbol[];
};

type OptionsHomeSummary = {
  unusualSymbolCount: number;
  newUnusualSymbols: number;
  premiumCallPutRatio: number | null;
  persistentSymbolRate: number | null;
  zeroDteShare: number | null;
};

type OptionsActivitySymbol = {
  symbol: string;
  name: string;
  score: number;
  totalPremium: number;
  callPremium: number;
  putPremium: number;
  volumeOpenInterestRatio: number | null;
  ivChange: number | null;
  direction: "bullish" | "bearish" | "volatility" | "hedge" | "mixed";
  activeDays: number;
  topExpiry: string | null;
  eventRisk: "earnings" | "macro" | "product" | "legal" | "none";
  price: number | null;
  priceChange3d: number | null;
  relativeVolume: number | null;
  contracts: OptionsRepresentativeContract[];
  timeline: OptionsActivityDay[];
};

type OptionsRepresentativeContract = {
  contractSymbol: string;
  type: "call" | "put";
  strike: number;
  expiration: string;
  premium: number;
  volume: number;
  openInterest: number | null;
  sideEstimate: "ask" | "bid" | "midpoint" | "unknown";
  impliedVolatility: number | null;
};

type OptionsActivityDay = {
  date: string;
  score: number;
  premium: number;
  direction: "bullish" | "bearish" | "volatility" | "hedge" | "mixed";
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

type FinnhubStatus = {
  connected: boolean;
  symbol?: string;
  symbols?: string[];
  message: string;
};

type FinnhubTrade = {
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
};

type PeriodReturn = {
  amount: number;
  percent: number;
};

type MarketCard = {
  symbol: string;
  name: string;
  kind: "index" | "stock" | "macro";
  price: number;
  dayChange: PeriodReturn;
  performance: {
    "5d": PeriodReturn;
    "10d": PeriodReturn;
    "15d": PeriodReturn;
  };
  updatedAt: string;
  sparkline: number[];
};

type MarketOverviewData = {
  updatedAt: string;
  indexes: MarketCard[];
  watchlist: MarketCard[];
  macro: MarketCard[];
};

type WatchlistItem = {
  symbol: string;
  name: string;
};

type SymbolSearchResult = {
  symbol: string;
  name: string;
  type?: string;
};

type LongbridgeStatus = {
  configured: boolean;
  authorized: boolean;
  authorizing: boolean;
  tokenExists: boolean;
  callbackPort: number;
  tokenPath: string | null;
};

type PositionItem = {
  broker: BrokerId;
  accountChannel: string;
  isPaper: boolean;
  symbol: string;
  name: string;
  market: string;
  currency: string;
  quantity: string;
  availableQuantity: string;
  costPrice: string;
  initQuantity: string;
};

type PositionsResponse = {
  broker: BrokerId;
  mode: "live" | "error";
  positions: PositionItem[];
  message: string | null;
};
