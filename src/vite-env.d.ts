/// <reference types="vite/client" />

interface Window {
  tradeAssistant?: {
    platform: string;
    getDashboard: (symbol: string) => Promise<DashboardData>;
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
    changePercent: number;
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
