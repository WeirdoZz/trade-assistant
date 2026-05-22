const { getLongbridgeTradeContext, getLongbridgeStatus } = require("./longbridgeClient.cjs");

function valueToString(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value.toString === "function") {
    return value.toString();
  }

  return String(value);
}

function marketToString(value) {
  const marketMap = {
    1: "US",
    2: "HK",
    3: "CN",
    4: "SG",
    5: "Crypto"
  };
  return marketMap[value] ?? valueToString(value);
}

function normalizePosition(accountChannel, item) {
  const normalizedAccountChannel = valueToString(accountChannel);

  return {
    broker: "longbridge",
    accountChannel: normalizedAccountChannel,
    isPaper: normalizedAccountChannel.toLowerCase().includes("paper"),
    symbol: valueToString(item.symbol),
    name: valueToString(item.symbolName),
    market: marketToString(item.market),
    currency: valueToString(item.currency),
    quantity: valueToString(item.quantity, "0"),
    availableQuantity: valueToString(item.availableQuantity, "0"),
    costPrice: valueToString(item.costPrice),
    initQuantity: valueToString(item.initQuantity)
  };
}

function flattenStockPositions(response) {
  const channels = response?.channels ?? response?.toJSON?.()?.channels ?? [];
  return channels.flatMap((account) => {
    const accountChannel = valueToString(account.accountChannel);
    const stocks = account.positions ?? account.stockInfo ?? account.stock_info ?? [];
    return stocks.map((item) => normalizePosition(accountChannel, item));
  });
}

async function getLongbridgePositions() {
  const status = getLongbridgeStatus();

  if (!status.authorized && !status.tokenExists) {
    return {
      broker: "longbridge",
      mode: "error",
      positions: [],
      message: "长桥尚未授权。请先点击左侧“连接长桥”完成 OAuth。"
    };
  }

  try {
    const tradeContext = await getLongbridgeTradeContext();
    const response = await tradeContext.stockPositions();
    const allPositions = flattenStockPositions(response);
    const livePositions = allPositions.filter((position) => !position.isPaper);
    const paperCount = allPositions.length - livePositions.length;

    return {
      broker: "longbridge",
      mode: "live",
      positions: livePositions,
      message: paperCount > 0 && livePositions.length === 0
        ? `长桥只返回了 ${paperCount} 条模拟账户持仓（lb_papertrading），未返回真实账户持仓。请确认 OAuth 授权账号和真实交易账户权限。`
        : null
    };
  } catch (error) {
    return {
      broker: "longbridge",
      mode: "error",
      positions: [],
      message: error instanceof Error ? error.message : "长桥持仓接口调用失败。"
    };
  }
}

async function getPositions(broker = "longbridge") {
  if (broker !== "longbridge") {
    throw new Error(`Unsupported broker: ${broker}`);
  }

  return getLongbridgePositions();
}

module.exports = { getPositions };
