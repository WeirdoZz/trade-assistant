const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const { FinnhubRealtime } = require("./services/finnhubRealtime.cjs");
const { getDashboard, getMarketOverview, fetchUsSymbols } = require("./services/marketData.cjs");
const { getPositions } = require("./services/positions.cjs");
const { createWatchlistStore } = require("./services/watchlist.cjs");
const { createSymbolStore } = require("./services/symbolStore.cjs");
const { createStartupTasks, createRefreshUsSymbolsTask } = require("./services/startupTasks.cjs");
const {
  getLongbridgeStatus,
  startLongbridgeOAuth
} = require("./services/longbridgeClient.cjs");

const isDev = !app.isPackaged;
const finnhubRealtime = new FinnhubRealtime();
let watchlistStore = null;
let symbolStore = null;
let startupTasks = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1120,
    minHeight: 760,
    title: "Trade Assistant",
    backgroundColor: "#0f1720",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.webContents.once("did-finish-load", () => {
    subscribeWatchlistSymbols(win.webContents);
  });

  return win;
}

function subscribeWatchlistSymbols(sender) {
  const symbols = watchlistStore.readWatchlist().map((item) => item.symbol);
  finnhubRealtime.setSymbols(sender, symbols);
}

function registerIpcHandlers() {
  ipcMain.handle("dashboard:get", (_event, symbol) => getDashboard(symbol));
  ipcMain.handle("market-overview:get", async (event) => {
    const payload = await getMarketOverview(watchlistStore.readWatchlist());
    subscribeWatchlistSymbols(event.sender);
    return payload;
  });
  ipcMain.handle("symbols:list-us", () => symbolStore.readSymbols());
  ipcMain.handle("watchlist:add", (event, item) => {
    const items = watchlistStore.addWatchlistItem(item);
    finnhubRealtime.subscribe(event.sender, item?.symbol);
    return items;
  });
  ipcMain.handle("finnhub:subscribe", (event, symbol) => finnhubRealtime.subscribe(event.sender, symbol));
  ipcMain.handle("finnhub:unsubscribe", () => {
    finnhubRealtime.unsubscribe();
    return { connected: false };
  });
  ipcMain.handle("positions:get", (_event, broker) => getPositions(broker));
  ipcMain.handle("longbridge:status", () => getLongbridgeStatus());
  ipcMain.handle("longbridge:oauth:start", (_event, options) => (
    startLongbridgeOAuth((url) => shell.openExternal(url), options)
  ));
}

function createServices() {
  const userDataPath = app.getPath("userData");
  watchlistStore = createWatchlistStore(userDataPath);
  symbolStore = createSymbolStore(userDataPath, fetchUsSymbols);
  startupTasks = createStartupTasks([
    createRefreshUsSymbolsTask({
      symbolStore,
      notifyUpdated: (symbols) => {
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send("symbols:updated", symbols);
        });
      }
    })
  ]);
}

app.whenReady().then(() => {
  createServices();
  registerIpcHandlers();
  subscribeWatchlistSymbols(null);
  createWindow();
  void startupTasks.run();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  finnhubRealtime.closeSocket();
});
