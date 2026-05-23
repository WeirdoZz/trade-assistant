/// <reference types="vite/client" />

interface Window {
  tradeAssistant?: {
    platform: string;
    getDashboard: (symbol: string) => Promise<DashboardData>;
    getMarketOverview: () => Promise<MarketOverviewData>;
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
  news: Array<{ title: string; source: string; time: string; sentiment: string }>;
  analysis: {
    stance: string;
    buyZone: string;
    sellZone: string;
    risk: string;
    summary: string;
  };
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
