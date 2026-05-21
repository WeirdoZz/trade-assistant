const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("tradeAssistant", {
  platform: process.platform,
  apiBaseUrl: "http://127.0.0.1:8765"
});
