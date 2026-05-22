const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const { getDashboard } = require("./services/marketData.cjs");
const {
  getLongbridgeStatus,
  startLongbridgeOAuth
} = require("./services/longbridgeClient.cjs");

const isDev = !app.isPackaged;

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
}

function registerIpcHandlers() {
  ipcMain.handle("dashboard:get", (_event, symbol) => getDashboard(symbol));
  ipcMain.handle("longbridge:status", () => getLongbridgeStatus());
  ipcMain.handle("longbridge:oauth:start", () => startLongbridgeOAuth(shell.openExternal));
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

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
