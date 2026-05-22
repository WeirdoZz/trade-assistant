/// <reference types="vite/client" />

interface Window {
  tradeAssistant?: {
    platform: string;
    getDashboard: (symbol: string) => Promise<DashboardData>;
    getLongbridgeStatus: () => Promise<LongbridgeStatus>;
    startLongbridgeOAuth: () => Promise<LongbridgeStatus>;
  };
}

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
  connected: boolean;
  tokenPath: string | null;
};
