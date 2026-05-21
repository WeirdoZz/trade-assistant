const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");

const isDev = !app.isPackaged;

let apiProcess;

function startApiServer() {
  if (isDev) {
    return;
  }

  const pythonPath = process.env.TRADE_ASSISTANT_PYTHON ?? "python3";
  const apiModule = path.join(process.resourcesPath, "backend", "app", "main.py");

  apiProcess = spawn(pythonPath, [apiModule], {
    stdio: "ignore",
    env: {
      ...process.env,
      TRADE_ASSISTANT_PORT: "8765"
    }
  });
}

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

app.whenReady().then(() => {
  startApiServer();
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

app.on("before-quit", () => {
  if (apiProcess) {
    apiProcess.kill();
  }
});
