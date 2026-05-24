# Options Activity Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a working options unusual activity homepage backed by Massive REST snapshots, with browser fallback data.

**Architecture:** Add a focused Electron service for options activity aggregation from Massive option chain snapshots. Expose it through IPC/preload and render a new `options` view in the existing React single-file app shell.

**Tech Stack:** Electron IPC, CommonJS services, React 18, TypeScript, CSS, Node test runner, Massive REST API.

---

## File Structure

- Create: `electron/services/optionsData.cjs` for Massive API key lookup, option chain snapshot fetching, scoring, fallback data, and `getOptionsHome()`.
- Create: `tests/optionsData.test.cjs` for scoring, fallback, key lookup, and API normalization tests.
- Modify: `electron/main.cjs` to register `options-home:get`.
- Modify: `electron/preload.cjs` to expose `getOptionsHome()`.
- Modify: `src/vite-env.d.ts` to add renderer-visible options types and preload method.
- Modify: `src/App.tsx` to add `options` navigation, fallback builder, state loading, and `OptionsActivityHome`.
- Modify: `src/styles.css` to style the options dashboard.

### Task 1: Options Data Service

**Files:**
- Create: `electron/services/optionsData.cjs`
- Test: `tests/optionsData.test.cjs`

- [x] **Step 1: Write service tests**

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildFallbackOptionsHome,
  buildOptionsHomeFromSnapshots,
  getMassiveApiKey,
  getOptionsHome
} = require("../electron/services/optionsData.cjs");

test("massive api key accepts MASSIVE_API_KEY and POLYGON_API_KEY", () => {
  const originalMassive = process.env.MASSIVE_API_KEY;
  const originalPolygon = process.env.POLYGON_API_KEY;
  process.env.MASSIVE_API_KEY = " massive ";
  process.env.POLYGON_API_KEY = "polygon";
  assert.equal(getMassiveApiKey(), "massive");
  delete process.env.MASSIVE_API_KEY;
  process.env.POLYGON_API_KEY = " polygon ";
  assert.equal(getMassiveApiKey(), "polygon");
  if (originalMassive === undefined) delete process.env.MASSIVE_API_KEY;
  else process.env.MASSIVE_API_KEY = originalMassive;
  if (originalPolygon === undefined) delete process.env.POLYGON_API_KEY;
  else process.env.POLYGON_API_KEY = originalPolygon;
});

test("fallback options home ranks watchlist symbols by score", () => {
  const page = buildFallbackOptionsHome([{ symbol: "NVDA", name: "NVIDIA" }, { symbol: "AAPL", name: "Apple" }]);
  assert.equal(page.window, "T-3");
  assert.equal(page.poolName, "自选池");
  assert.deepEqual(page.symbols.map((item) => item.symbol), ["NVDA", "AAPL"]);
  assert.ok(page.symbols[0].score >= page.symbols[1].score);
  assert.equal(page.summary.unusualSymbolCount, 2);
});

test("snapshot builder normalizes Massive option chain fields", () => {
  const page = buildOptionsHomeFromSnapshots([
    {
      symbol: "TSLA",
      name: "Tesla",
      snapshot: {
        results: [
          {
            day: { volume: 1200, close: 2.4, previous_close: 1.7 },
            details: { contract_type: "call", expiration_date: "2026-06-19", strike_price: 250, ticker: "O:TSLA260619C00250000" },
            implied_volatility: 0.62,
            last_quote: { ask: 2.5, bid: 2.35, midpoint: 2.425 },
            last_trade: { price: 2.48, size: 80 },
            open_interest: 300,
            underlying_asset: { price: 242, ticker: "TSLA" }
          },
          {
            day: { volume: 500, close: 3.1, previous_close: 3.4 },
            details: { contract_type: "put", expiration_date: "2026-06-19", strike_price: 220, ticker: "O:TSLA260619P00220000" },
            implied_volatility: 0.51,
            last_trade: { price: 3, size: 20 },
            open_interest: 1000,
            underlying_asset: { price: 242, ticker: "TSLA" }
          }
        ]
      }
    }
  ]);
  assert.equal(page.symbols[0].symbol, "TSLA");
  assert.equal(page.symbols[0].direction, "bullish");
  assert.equal(page.symbols[0].contracts[0].contractSymbol, "O:TSLA260619C00250000");
  assert.ok(page.symbols[0].totalPremium > 0);
  assert.ok(page.symbols[0].score > 0);
});

test("getOptionsHome falls back when Massive key is missing", async () => {
  const originalMassive = process.env.MASSIVE_API_KEY;
  const originalPolygon = process.env.POLYGON_API_KEY;
  delete process.env.MASSIVE_API_KEY;
  delete process.env.POLYGON_API_KEY;
  const page = await getOptionsHome([{ symbol: "AMD", name: "AMD" }]);
  assert.equal(page.symbols[0].symbol, "AMD");
  assert.equal(page.source, "fallback");
  if (originalMassive === undefined) delete process.env.MASSIVE_API_KEY;
  else process.env.MASSIVE_API_KEY = originalMassive;
  if (originalPolygon === undefined) delete process.env.POLYGON_API_KEY;
  else process.env.POLYGON_API_KEY = originalPolygon;
});
```

- [x] **Step 2: Implement service**

Implement `getMassiveApiKey()`, `requestMassive()`, `fetchOptionChainSnapshot()`, `buildOptionsHomeFromSnapshots()`, `buildFallbackOptionsHome()`, and `getOptionsHome()`.

- [x] **Step 3: Run tests**

Run: `node --test tests/optionsData.test.cjs`

Expected: all tests pass.

### Task 2: IPC Bridge

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/vite-env.d.ts`

- [x] **Step 1: Add IPC handler**

Register `options-home:get` with `getOptionsHome(watchlistStore.readWatchlist())`.

- [x] **Step 2: Expose preload method**

Expose `getOptionsHome: () => ipcRenderer.invoke("options-home:get")`.

- [x] **Step 3: Add renderer types**

Add `getOptionsHome(): Promise<OptionsHomeData>` and the options data types.

### Task 3: React Options Home

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [x] **Step 1: Add `options` view state and loader**

Extend `ViewId`, add `optionsData`, `optionsLoading`, `optionsError`, and load through bridge or browser fallback when active.

- [x] **Step 2: Build `OptionsActivityHome`**

Render top controls, KPI strip, ranking table, selected symbol insight panel, and three-day timeline.

- [x] **Step 3: Style dashboard**

Add compact dark dashboard CSS matching existing app style and preventing desktop overlap.

### Task 4: Verification

**Files:**
- None

- [x] **Step 1: Run tests**

Run: `npm run lint && node --test tests/optionsData.test.cjs`

- [x] **Step 2: Build**

Run: `npm run build`

Expected: TypeScript and Vite build complete.
