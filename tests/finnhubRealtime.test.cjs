const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");

const { FinnhubRealtime } = require("../electron/services/finnhubRealtime.cjs");

class FakeWebSocket extends EventEmitter {
  static instances = [];

  constructor(url) {
    super();
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.closeCount = 0;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }

  send(payload) {
    this.sent.push(payload);
  }

  close() {
    this.closeCount += 1;
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close", 1000, Buffer.from("client close"));
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open");
  }
}

FakeWebSocket.CONNECTING = 0;
FakeWebSocket.OPEN = 1;
FakeWebSocket.CLOSED = 3;

function createSender() {
  const sender = new EventEmitter();
  sender.isDestroyed = () => false;
  sender.send = () => {};
  return sender;
}

async function withFinnhubKey(run) {
  const originalCanonical = process.env.FINNHUB_API_KEY;
  const originalLegacy = process.env.FINNHU_API_KEY;
  process.env.FINNHUB_API_KEY = "test-key";
  delete process.env.FINNHU_API_KEY;
  FakeWebSocket.instances = [];

  try {
    return await run();
  } finally {
    if (originalCanonical === undefined) {
      delete process.env.FINNHUB_API_KEY;
    } else {
      process.env.FINNHUB_API_KEY = originalCanonical;
    }

    if (originalLegacy === undefined) {
      delete process.env.FINNHU_API_KEY;
    } else {
      process.env.FINNHU_API_KEY = originalLegacy;
    }
  }
}

test("finnhub socket outlives renderer sender destruction", async () => {
  await withFinnhubKey(() => {
    const realtime = new FinnhubRealtime({
      WebSocketClass: FakeWebSocket,
      logger: { info() {}, warn() {} }
    });
    const sender = createSender();

    realtime.setSymbols(sender, ["NVDA"]);
    const socket = FakeWebSocket.instances[0];
    socket.open();
    sender.emit("destroyed");

    assert.equal(socket.closeCount, 0);
    assert.equal(realtime.connected, true);
  });
});

test("finnhub socket reconnects even before a renderer sender exists", async () => {
  await withFinnhubKey(async () => {
    const realtime = new FinnhubRealtime({
      reconnectDelay: 1,
      WebSocketClass: FakeWebSocket,
      logger: { info() {}, warn() {} }
    });

    realtime.setSymbols(null, ["NVDA"]);
    FakeWebSocket.instances[0].emit("close", 1006, Buffer.from("network"));
    await new Promise((resolve) => setTimeout(resolve, 5));

    assert.equal(FakeWebSocket.instances.length, 2);
  });
});
