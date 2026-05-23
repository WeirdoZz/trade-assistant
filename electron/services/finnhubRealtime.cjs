const { loadDotEnv } = require("./env.cjs");
const path = require("node:path");
const WebSocket = require("ws");

loadDotEnv(path.join(__dirname, "../.."));

function getApiKey() {
  return ((process.env.FINNHUB_API_KEY || process.env.FINNHU_API_KEY || "").trim());
}

class FinnhubRealtime {
  constructor() {
    this.socket = null;
    this.sender = null;
    this.symbol = null;
    this.subscriptionId = 0;
  }

  subscribe(sender, symbol) {
    const apiKey = getApiKey();
    const normalized = String(symbol || "").trim().toUpperCase();
    const subscriptionId = this.subscriptionId + 1;

    this.unsubscribe();
    this.subscriptionId = subscriptionId;

    if (!apiKey || !normalized) {
      this.safeSend(sender, "finnhub:status", {
        connected: false,
        symbol: normalized,
        message: apiKey ? "Missing symbol" : "Missing FINNHUB_API_KEY"
      });
      return { connected: false };
    }

    this.sender = sender;
    this.symbol = normalized;
    this.socket = new WebSocket(`wss://ws.finnhub.io?token=${encodeURIComponent(apiKey)}`);

    this.socket.on("open", () => {
      if (this.subscriptionId !== subscriptionId) {
        return;
      }

      this.socket?.send(JSON.stringify({ type: "subscribe", symbol: normalized }));
      this.safeSend(sender, "finnhub:status", {
        connected: true,
        symbol: normalized,
        message: "connected"
      });
    });

    this.socket.on("message", (data) => {
      if (this.subscriptionId !== subscriptionId) {
        return;
      }

      this.handleMessage(data);
    });

    this.socket.on("error", () => {
      if (this.subscriptionId !== subscriptionId) {
        return;
      }

      this.safeSend(sender, "finnhub:status", {
        connected: false,
        symbol: normalized,
        message: "websocket error"
      });
    });

    this.socket.on("close", () => {
      if (this.subscriptionId !== subscriptionId) {
        return;
      }

      this.safeSend(sender, "finnhub:status", {
        connected: false,
        symbol: normalized,
        message: "closed"
      });
    });

    sender.once("destroyed", () => {
      if (this.sender === sender) {
        this.unsubscribe();
      }
    });

    return { connected: true, symbol: normalized };
  }

  handleMessage(rawData) {
    let payload;

    try {
      payload = JSON.parse(String(rawData));
    } catch {
      return;
    }

    if (payload.type !== "trade" || !Array.isArray(payload.data) || !this.sender) {
      return;
    }

    for (const item of payload.data) {
      if (String(item.s || "").toUpperCase() !== this.symbol) {
        continue;
      }

      this.safeSend(this.sender, "finnhub:trade", {
        symbol: this.symbol,
        price: Number(item.p),
        timestamp: Number(item.t),
        volume: Number(item.v ?? 0)
      });
    }
  }

  safeSend(sender, channel, payload) {
    if (!sender || sender.isDestroyed()) {
      return false;
    }

    sender.send(channel, payload);
    return true;
  }

  unsubscribe() {
    if (this.socket && this.symbol && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "unsubscribe", symbol: this.symbol }));
    }

    if (this.socket) {
      this.socket.close();
    }

    this.socket = null;
    this.sender = null;
    this.symbol = null;
  }
}

module.exports = { FinnhubRealtime, getApiKey };
