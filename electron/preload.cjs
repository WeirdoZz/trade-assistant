const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tradeAssistant", {
  platform: process.platform,
  getDashboard: (symbol) => ipcRenderer.invoke("dashboard:get", symbol),
  getMarketOverview: () => ipcRenderer.invoke("market-overview:get"),
  subscribeFinnhub: (symbol) => ipcRenderer.invoke("finnhub:subscribe", symbol),
  unsubscribeFinnhub: () => ipcRenderer.invoke("finnhub:unsubscribe"),
  onFinnhubStatus: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("finnhub:status", listener);
    return () => ipcRenderer.removeListener("finnhub:status", listener);
  },
  onFinnhubTrade: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("finnhub:trade", listener);
    return () => ipcRenderer.removeListener("finnhub:trade", listener);
  },
  getPositions: (broker) => ipcRenderer.invoke("positions:get", broker),
  getLongbridgeStatus: () => ipcRenderer.invoke("longbridge:status"),
  startLongbridgeOAuth: (options) => ipcRenderer.invoke("longbridge:oauth:start", options)
});
