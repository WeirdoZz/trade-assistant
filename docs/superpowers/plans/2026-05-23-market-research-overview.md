# Market Research Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn market research from a single-symbol detail entry into an overview dashboard with clickable index and watchlist cards.

**Architecture:** Add `getMarketOverview()` beside existing `getDashboard(symbol)`. Renderer fetches overview for the research landing page, then opens existing detail page when a card is clicked.

**Tech Stack:** Electron IPC, React, TypeScript, CSS, Node built-in test runner for CommonJS service tests.

---

### Task 1: Overview Data Contract

**Files:**
- Create: `tests/marketData.test.cjs`
- Modify: `electron/services/marketData.cjs`

- [ ] Write failing tests for overview structure and card performance fields.
- [ ] Implement `getMarketOverview()` with indexes, watchlist, and macro assets.
- [ ] Export `getMarketOverview()` without changing `getDashboard()`.

### Task 2: IPC And Types

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/vite-env.d.ts`

- [ ] Register `market-overview:get`.
- [ ] Expose `getMarketOverview()` in preload.
- [ ] Add `MarketOverviewData`, `MarketCard`, and `PeriodReturn` types.

### Task 3: Research Overview UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] Add overview state and fallback data.
- [ ] Render layout A: index cards, watchlist cards, macro bottom bar.
- [ ] Keep existing detail UI reachable by clicking cards and by search.
- [ ] Show day change amount + percent and 5/10/15 day amount + percent on cards.

### Task 4: Verify

**Commands:**
- `node --test tests/marketData.test.cjs`
- `npm run lint`
- `npm run build`
