const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tradeAssistant", {
  platform: process.platform,
  getDashboard: (symbol) => ipcRenderer.invoke("dashboard:get", symbol),
  getPositions: (broker) => ipcRenderer.invoke("positions:get", broker),
  getLongbridgeStatus: () => ipcRenderer.invoke("longbridge:status"),
  startLongbridgeOAuth: (options) => ipcRenderer.invoke("longbridge:oauth:start", options)
});
