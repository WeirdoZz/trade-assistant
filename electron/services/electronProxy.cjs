const { loadDotEnv } = require("./env.cjs");

function configureElectronProxy({ rootDir, env = process.env, appendSwitch }) {
  loadDotEnv(rootDir, env);

  const proxyServer = (env.TRADE_ASSISTANT_PROXY_SERVER || "").trim();
  if (proxyServer) {
    appendSwitch("proxy-server", proxyServer);
  }
}

module.exports = { configureElectronProxy };
