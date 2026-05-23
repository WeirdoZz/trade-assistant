/// <reference types="vite/client" />

interface Window {
  tradeAssistant?: {
    platform: string;
    getDashboard: (symbol: string) => Promise<DashboardData>;
    getMarketOverview: () => Promise<MarketOverviewData>;
    getUsSymbols: () => Promise<SymbolSearchResult[]>;
    addWatchlistItem: (item: WatchlistItem) => Promise<WatchlistItem[]>;
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
