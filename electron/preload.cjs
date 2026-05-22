const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tradeAssistant", {
  platform: process.platform,
  getDashboard: (symbol) => ipcRenderer.invoke("dashboard:get", symbol),
  getLongbridgeStatus: () => ipcRenderer.invoke("longbridge:status"),
  startLongbridgeOAuth: () => ipcRenderer.invoke("longbridge:oauth:start")
});
