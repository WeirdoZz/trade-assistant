const os = require("node:os");
const path = require("node:path");
const { Config, OAuth } = require("longbridge");
const { loadDotEnv } = require("./env.cjs");

loadDotEnv(path.join(__dirname, "../.."));

let configPromise;

function getClientId() {
  return (process.env.LONGBRIDGE_CLIENT_ID ?? "").trim();
}

function getTokenPath() {
  const clientId = getClientId();
  return clientId ? path.join(os.homedir(), ".longbridge/openapi/tokens", clientId) : null;
}

function getLongbridgeStatus() {
  const clientId = getClientId();

  return {
    configured: Boolean(clientId),
    connected: Boolean(configPromise),
    tokenPath: getTokenPath()
  };
}

async function startLongbridgeOAuth(openExternal) {
  const clientId = getClientId();

  if (!clientId) {
    throw new Error("Missing LONGBRIDGE_CLIENT_ID. Copy .env.example to .env and fill it.");
  }

  configPromise = OAuth.build(clientId, (_state, url) => {
    console.log("请访问此 URL 进行授权：" + url);
    openExternal(url);
  }).then((oauth) => Config.fromOAuth(oauth));

  await configPromise;

  return getLongbridgeStatus();
}

function getLongbridgeConfig() {
  if (!configPromise) {
    throw new Error("Longbridge OAuth has not been completed.");
  }

  return configPromise;
}

module.exports = {
  getLongbridgeConfig,
  getLongbridgeStatus,
  startLongbridgeOAuth
};
