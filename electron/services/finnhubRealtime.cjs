const { loadDotEnv } = require("./env.cjs");
const path = require("node:path");
const WebSocket = require("ws");

loadDotEnv(path.join(__dirname, "../.."));

function getApiKey() {
  return ((process.env.FINNHUB_API_KEY || process.env.FINNHU_API_KEY || "").trim());
}

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

class FinnhubRealtime {
  constructor({ reconnectDelay = 2000, WebSocketClass = WebSocket, logger = console } = {}) {
    this.WebSocketClass = WebSocketClass;
    this.logger = logger;
    this.socket = null;
    this.senders = new Set();
    this.symbols = new Set();
    this.connected = false;
    this.reconnectDelay = reconnectDelay;
    this.reconnectTimer = null;
    this.shouldReconnect = true;
  }

  subscribe(sender, symbol) {
    return this.addSymbols(sender, [symbol]);
  }

  addSymbols(sender, symbols) {
    this.addSender(sender);

    const normalizedSymbols = symbols
      .map(normalizeSymbol)
      .filter(Boolean);

    if (normalizedSymbols.length === 0) {
      this.broadcastStatus({
        connected: this.connected,
        message: "Missing symbol"
      });
      return { connected: this.connected, symbols: [...this.symbols] };
    }

    for (const symbol of normalizedSymbols) {
      if (!this.symbols.has(symbol)) {
        this.symbols.add(symbol);
        this.sendSubscription("subscribe", symbol);
      }
    }

    this.ensureSocket();
    return { connected: this.connected, symbols: [...this.symbols] };
  }

  setSymbols(sender, symbols) {
    this.addSender(sender);

    const nextSymbols = new Set(
      symbols
        .map(normalizeSymbol)
        .filter(Boolean)
    );

    for (const symbol of [...this.symbols]) {
      if (!nextSymbols.has(symbol)) {
        this.symbols.delete(symbol);
        this.sendSubscription("unsubscribe", symbol);
      }
    }

    for (const symbol of nextSymbols) {
      if (!this.symbols.has(symbol)) {
        this.symbols.add(symbol);
        this.sendSubscription("subscribe", symbol);
      }
    }

    if (this.symbols.size === 0) {
      this.closeSocket();
      return { connected: false, symbols: [] };
    }

    this.ensureSocket();
    return { connected: this.connected, symbols: [...this.symbols] };
  }

  addSender(sender) {
    if (!sender || sender.isDestroyed?.()) {
      return;
    }

    if (this.senders.has(sender)) {
      return;
    }

    this.senders.add(sender);
    sender.once("destroyed", () => {
      this.senders.delete(sender);
    });
  }

  ensureSocket() {
    const apiKey = getApiKey();
    if (!apiKey || this.symbols.size === 0) {
      this.broadcastStatus({
        connected: false,
        message: apiKey ? "Missing symbol" : "Missing FINNHUB_API_KEY"
      });
      return;
    }

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.shouldReconnect = true;
    const socket = new this.WebSocketClass(`wss://ws.finnhub.io?token=${encodeURIComponent(apiKey)}`);
    this.socket = socket;
    this.logger.info?.(`[finnhub:ws] connecting symbols=${[...this.symbols].join(",")}`);

    socket.on("open", () => {
      this.connected = true;
      for (const symbol of this.symbols) {
        this.sendSubscription("subscribe", symbol);
      }
      this.logger.info?.(`[finnhub:ws] connected symbols=${[...this.symbols].join(",")}`);
      this.broadcastStatus({
        connected: true,
        symbols: [...this.symbols],
        message: "connected"
      });
    });

    socket.on("message", (data) => {
      this.handleMessage(data);
    });

    socket.on("error", (error) => {
      this.logger.warn?.(`[finnhub:ws] error ${error?.message || "unknown"}`);
      this.broadcastStatus({
        connected: false,
        symbols: [...this.symbols],
        message: "websocket error"
      });
    });

    socket.on("close", (code, reason) => {
      this.connected = false;
      if (this.socket === socket) {
        this.socket = null;
      }
      const reasonText = reason ? String(reason) : "";
      this.logger.info?.(`[finnhub:ws] closed code=${code ?? "unknown"} reason=${reasonText || "none"} symbols=${[...this.symbols].join(",")}`);
      this.broadcastStatus({
        connected: false,
        symbols: [...this.symbols],
        message: "closed"
      });
      this.scheduleReconnect();
    });
  }

  scheduleReconnect() {
    if (!this.shouldReconnect || this.symbols.size === 0 || this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureSocket();
    }, this.reconnectDelay);
  }

  sendSubscription(type, symbol) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.logger.info?.(`[finnhub:ws] ${type} ${symbol}`);
    this.socket.send(JSON.stringify({ type, symbol }));
  }

  handleMessage(rawData) {
    let payload;

    try {
      payload = JSON.parse(String(rawData));
    } catch {
      return;
    }

    if (payload.type !== "trade" || !Array.isArray(payload.data)) {
      return;
    }

    for (const item of payload.data) {
      const symbol = normalizeSymbol(item.s);
      if (!this.symbols.has(symbol)) {
        continue;
      }

      this.broadcast("finnhub:trade", {
        symbol,
        price: Number(item.p),
        timestamp: Number(item.t),
        volume: Number(item.v ?? 0)
      });
    }
  }

  broadcastStatus(payload) {
    this.broadcast("finnhub:status", payload);
  }

  broadcast(channel, payload) {
    for (const sender of [...this.senders]) {
      if (!this.safeSend(sender, channel, payload)) {
        this.senders.delete(sender);
      }
    }
  }

  safeSend(sender, channel, payload) {
    if (!sender || sender.isDestroyed?.()) {
      return false;
    }

    sender.send(channel, payload);
    return true;
  }

  unsubscribe(symbol) {
    const normalized = normalizeSymbol(symbol);
    if (normalized) {
      this.symbols.delete(normalized);
      this.sendSubscription("unsubscribe", normalized);
      return { connected: this.connected, symbols: [...this.symbols] };
    }

    this.symbols.clear();
    this.closeSocket();
    return { connected: false, symbols: [] };
  }

  closeSocket() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
    }

    this.socket = null;
    this.connected = false;
  }
}

module.exports = { FinnhubRealtime, getApiKey };
