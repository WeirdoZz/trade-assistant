const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { loadDotEnv } = require("./env.cjs");

loadDotEnv(path.join(__dirname, "../.."));

const { Config, OAuth, TradeContext } = require("longbridge");

let configPromise;
let configReady = false;

function getClientId() {
  return (process.env.LONGBRIDGE_CLIENT_ID ?? "").trim();
}

function getTokenPath() {
  const clientId = getClientId();
  return clientId ? path.join(os.homedir(), ".longbridge/openapi/tokens", clientId) : null;
}

function hasStoredToken() {
  const tokenPath = getTokenPath();
  return Boolean(tokenPath && fs.existsSync(tokenPath));
}

function removeStoredToken() {
  const tokenPath = getTokenPath();
  if (tokenPath && fs.existsSync(tokenPath)) {
    fs.rmSync(tokenPath);
  }
}

function getCallbackPort() {
  const value = Number(process.env.LONGBRIDGE_CALLBACK_PORT);
  return Number.isInteger(value) && value > 0 ? value : 60355;
}

function getRegionConfig() {
  if ((process.env.LONGBRIDGE_REGION ?? "").trim().toLowerCase() !== "cn") {
    return {};
  }

  return {
    httpUrl: "https://openapi.longbridge.cn",
    quoteWsUrl: "wss://openapi-quote.longbridge.cn",
    tradeWsUrl: "wss://openapi-trade.longbridge.cn"
  };
}

function getLongbridgeStatus() {
  const tokenExists = hasStoredToken();

  return {
    configured: Boolean(getClientId()),
    authorized: configReady,
    authorizing: Boolean(configPromise && !configReady),
    tokenExists,
    callbackPort: getCallbackPort(),
    tokenPath: getTokenPath()
  };
}

function getLongbridgeConfig(openExternal = null, options = {}) {
  const clientId = getClientId();

  if (!clientId) {
    throw new Error("Missing LONGBRIDGE_CLIENT_ID. Copy .env.example to .env and fill it.");
  }

  if (options.force) {
    configPromise = undefined;
    configReady = false;
    removeStoredToken();
  }

  if (!configPromise) {
    const callbackPort = getCallbackPort();
    console.log(`Starting Longbridge OAuth callback server on port ${callbackPort}`);

    configPromise = OAuth.build(clientId, (error, url) => {
      if (error) {
        console.error("Longbridge OAuth URL callback failed:", error);
        return;
      }

      console.log("请访问此 URL 进行授权：" + url);
      if (openExternal) {
        openExternal(url).catch((openError) => {
          console.error("Failed to open Longbridge OAuth URL:", openError);
        });
      }
    }, callbackPort).then((oauth) => {
      console.log("Longbridge OAuth completed. Creating Config from OAuth token.");
      const config = Config.fromOAuth(oauth, getRegionConfig());
      configReady = true;
      console.log("Longbridge OAuth config is ready.", getLongbridgeStatus());
      return config;
    }).catch((error) => {
      configPromise = undefined;
      configReady = false;
      throw error;
    });
  }

  return configPromise;
}

async function startLongbridgeOAuth(openExternal, options = {}) {
  await getLongbridgeConfig(openExternal, options);

  return getLongbridgeStatus();
}

async function getLongbridgeTradeContext() {
  const config = await getLongbridgeConfig();
  return TradeContext.new(config);
}

module.exports = {
  getLongbridgeConfig,
  getLongbridgeTradeContext,
  getLongbridgeStatus,
  startLongbridgeOAuth
};
