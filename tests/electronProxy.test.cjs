const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { configureElectronProxy } = require("../electron/services/electronProxy.cjs");

function withTempProject(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "trade-assistant-proxy-"));
  try {
    return run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("electron proxy setup loads TRADE_ASSISTANT_PROXY_SERVER from dotenv before app switches", () => {
  withTempProject((directory) => {
    fs.writeFileSync(
      path.join(directory, ".env"),
      "TRADE_ASSISTANT_PROXY_SERVER=http://127.0.0.1:7890\n"
    );

    const switches = [];
    configureElectronProxy({
      rootDir: directory,
      env: {},
      appendSwitch: (name, value) => switches.push([name, value])
    });

    assert.deepEqual(switches, [["proxy-server", "http://127.0.0.1:7890"]]);
  });
});

test("electron proxy setup preserves shell env over dotenv", () => {
  withTempProject((directory) => {
    fs.writeFileSync(
      path.join(directory, ".env"),
      "TRADE_ASSISTANT_PROXY_SERVER=http://127.0.0.1:7890\n"
    );

    const switches = [];
    configureElectronProxy({
      rootDir: directory,
      env: { TRADE_ASSISTANT_PROXY_SERVER: "socks5://127.0.0.1:7891" },
      appendSwitch: (name, value) => switches.push([name, value])
    });

    assert.deepEqual(switches, [["proxy-server", "socks5://127.0.0.1:7891"]]);
  });
});
