# Options Unusual Activity Home Design

## Goal

Build an options review home page for the watchlist. The page focuses on the previous three trading sessions (`T-3`) and helps the user answer four questions quickly:

- Which watchlist symbols had the strongest unusual options activity?
- Was the activity directional, hedging-driven, volatility-driven, or mixed?
- Did the activity persist across multiple days or appear as a one-day spike?
- Which representative contracts explain the signal?

This is a review and ranking page, not a real-time trading tape.

## Product Choices

- Primary view: symbol-level unusual activity ranking.
- Default window: previous three trading sessions.
- Market universe: user watchlist or selected theme/watchlist pool.
- Refresh model: daily batch after market close, with optional manual refresh later.
- First implementation scope: UI and local data model can use mock/fallback data until an options data service is connected.

## Recommended Layout

The page should be added as a real `options` view in `src/App.tsx`, replacing the current inactive "期权异动" nav button. It should reuse the existing app shell, sidebar, topbar density, dark visual system, 8px radii, lucide icons, and ECharts dependency.

### Top Control Bar

Purpose: show analysis context and allow lightweight filtering.

Fields:

- `window`: default `T-3`, options `T-1`, `T-3`, `T-5`.
- `pool`: default watchlist pool.
- `lastBatchAt`: timestamp for completed analysis.
- `refreshStatus`: idle, running, failed, stale.
- `filters`: continuous activity only, high premium only, high IV move only.

Controls:

- Segmented control for time window.
- Select/menu for pool.
- Icon refresh button with status.
- Compact search for ticker filter.

### KPI Strip

Purpose: summarize whether unusual activity is broad, directional, or concentrated.

Cards:

- `unusualSymbolCount`: symbols with score above threshold.
- `newUnusualSymbols`: symbols newly unusual versus prior comparable window.
- `premiumCallPutRatio`: call premium divided by put premium.
- `persistentSymbolRate`: share of unusual symbols active on at least two of three days.
- `zeroDteShare`: optional, if data source includes same-day expirations.

### Main Ranking Table

Purpose: make the first decision obvious: which symbols deserve review.

Columns:

- `symbol`
- `name`
- `score` from 0 to 100
- `totalPremium`
- `volumeOpenInterestRatio`
- `ivChange`
- `direction`: bullish, bearish, volatility, hedge, mixed
- `activeDays`
- `topExpiry`
- `eventRisk`: earnings, macro, product, legal, none

Default sort:

- `score` descending.

Primary row action:

- Selecting a row updates the right insight panel.

### Right Insight Panel

Purpose: explain the selected symbol without forcing a detail page.

Sections:

- Stock snapshot: price, 3-day change, relative volume.
- Interpretation tags: directional buy, protection hedge, volatility bet, spread/roll, ambiguous.
- Representative contracts: top three contracts by premium or score contribution.
- Risk notes: earnings date, high spread, low open interest, single-print warning.

Contract fields:

- `contractSymbol`
- `type`: call or put
- `strike`
- `expiration`
- `premium`
- `volume`
- `openInterest`
- `sideEstimate`: ask-side, bid-side, midpoint, unknown
- `impliedVolatility`

### Three-Day Timeline

Purpose: distinguish persistent accumulation from single-session noise.

Display:

- Each ranked symbol has three compact day cells.
- Day cells show score intensity, dominant direction, and premium.
- Clicking a day can later drill into the contracts that drove that day.

MVP can render this as a compact grid below the table and insight panel.

## Data Model

Use a page-level response shaped around symbol summaries, not raw contracts first.

```ts
type OptionsHomeData = {
  updatedAt: string;
  window: "T-1" | "T-3" | "T-5";
  poolName: string;
  summary: OptionsHomeSummary;
  symbols: OptionsActivitySymbol[];
};

type OptionsHomeSummary = {
  unusualSymbolCount: number;
  newUnusualSymbols: number;
  premiumCallPutRatio: number | null;
  persistentSymbolRate: number | null;
  zeroDteShare: number | null;
};

type OptionsActivitySymbol = {
  symbol: string;
  name: string;
  score: number;
  totalPremium: number;
  callPremium: number;
  putPremium: number;
  volumeOpenInterestRatio: number | null;
  ivChange: number | null;
  direction: "bullish" | "bearish" | "volatility" | "hedge" | "mixed";
  activeDays: number;
  topExpiry: string | null;
  eventRisk: "earnings" | "macro" | "product" | "legal" | "none";
  price: number | null;
  priceChange3d: number | null;
  relativeVolume: number | null;
  contracts: OptionsRepresentativeContract[];
  timeline: OptionsActivityDay[];
};

type OptionsRepresentativeContract = {
  contractSymbol: string;
  type: "call" | "put";
  strike: number;
  expiration: string;
  premium: number;
  volume: number;
  openInterest: number | null;
  sideEstimate: "ask" | "bid" | "midpoint" | "unknown";
  impliedVolatility: number | null;
};

type OptionsActivityDay = {
  date: string;
  score: number;
  premium: number;
  direction: "bullish" | "bearish" | "volatility" | "hedge" | "mixed";
};
```

## Scoring

Use a transparent weighted score first:

```text
score = 35% premiumZ + 25% volumeOpenInterestZ + 20% ivChangeZ + 20% persistence
```

Definitions:

- `premiumZ`: premium anomaly versus the symbol's recent baseline.
- `volumeOpenInterestZ`: contract volume versus open interest anomaly.
- `ivChangeZ`: implied volatility change anomaly.
- `persistence`: activity appears across multiple days and keeps a consistent direction.

Clamp final score to `0..100`. Show score as a ranking aid, not as a trade recommendation.

## Empty, Loading, And Error States

- Loading: skeleton KPI cards and table rows.
- Empty watchlist: prompt user to add watchlist symbols from the existing research flow.
- No unusual activity: show a quiet empty state with current filters and batch time.
- Stale batch: show warning in top bar, keep last successful data visible.
- Provider failure: show source error, keep mock/fallback data only in browser development mode.

## Implementation Path

1. Extend `ViewId` with `"options"` and wire the sidebar "期权异动" button.
2. Add `OptionsActivityHome` component in `src/App.tsx` for the first pass, matching the current single-file app pattern.
3. Add static fallback builder `buildBrowserFallbackOptionsHome()` beside existing fallback data builders.
4. Add CSS sections for options topbar, KPI strip, ranking grid, insight panel, and timeline, reusing existing colors and 8px panel style.
5. Later, add Electron bridge method `getOptionsHome()` and a service module once a data provider is selected.

## Acceptance Criteria

- Sidebar "期权异动" opens a working options home page.
- Page defaults to `T-3` and watchlist pool.
- Ranking table sorts by score descending.
- Selecting a symbol updates the insight panel.
- KPI strip, table, insight panel, and timeline render on desktop without overlap.
- Browser fallback works without external API credentials.
- `npm run lint` passes after implementation.

## Out Of Scope

- Real-time options tape.
- Brokerage order entry.
- Backtesting strategy returns.
- News sentiment fusion.
- Machine learning classification.
- Paid provider integration.
