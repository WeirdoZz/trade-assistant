const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTradingViewModule() {
  const sourcePath = path.join(__dirname, "../src/tradingView.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const module = { exports: {} };
  const runner = new Function("module", "exports", output);
  runner(module, module.exports);
  return module.exports;
}

test("TradingView helpers normalize app tickers into exchange symbols", () => {
  const { normalizeTradingViewSymbol } = loadTradingViewModule();

  assert.equal(normalizeTradingViewSymbol("nvda"), "NASDAQ:NVDA");
  assert.equal(normalizeTradingViewSymbol(" NYSE:BRK.B "), "NYSE:BRK.B");
});

test("TradingView helpers build symbol-specific widget configs", () => {
  const { buildTradingViewWidgetConfig } = loadTradingViewModule();

  assert.deepEqual(buildTradingViewWidgetConfig("symbol-info", "msft", "dark"), {
    symbol: "NASDAQ:MSFT",
    colorTheme: "dark",
    isTransparent: false,
    locale: "zh_CN",
    width: "100%"
  });

  assert.equal(
    buildTradingViewWidgetConfig("advanced-chart", "tsla", "light").symbol,
    "NASDAQ:TSLA"
  );
  assert.equal(
    buildTradingViewWidgetConfig("advanced-chart", "tsla", "light").locale,
    "zh_CN"
  );
  assert.equal(
    buildTradingViewWidgetConfig("financials", "NYSE:BRK.B", "light").symbol,
    "NYSE:BRK.B"
  );
});
