# Midnight Ledger — Improvement Plan (for Cursor)

Goal: simplify the Net Worth tab, add a portfolio-breakdown view (by ticker / by tax bucket / pretax vs post-tax / by account type), and fix a handful of cross-cutting issues found during a code audit.

Work top-to-bottom. Each section lists: **what**, **why**, **where**, and **acceptance criteria**. File paths are relative to repo root.

---

## 1. Net Worth tab — collapsible groups + only-recent-rows by default

### Problem
`src/pages/NetWorthPage.tsx` renders every imported month back to the start of the Excel sheet (`effectiveSnapshots.map(...)` in the table head and every row body). With a multi-year XLSX import this is dozens of editable columns the user can't hide. Old months don't need to be edited.

### Changes

1. **Default the table to the last N snapshots** (e.g. last 6). Add a chip row above the snapshot grid:
   `Show: [6 most recent] [12 months] [This year] [All]` — purely a view filter, not a data filter.
   - Pull this state into a new `tableSnapshotWindow` `useState`.
   - Filter `effectiveSnapshots` for rendering only; keep `historySeries` / metrics computed on the full set.

2. **Collapsible groups** in the snapshot grid.
   - `displayItems` already filters to `account | group`. Make each `group` row a clickable header that toggles expansion for its children. Children = accounts whose `parentId === group.id`.
   - Track expansion in `useState<Record<string, boolean>>` keyed by group id. Default: **all collapsed**.
   - Persist the expansion state to the store under `scenario.uiState.netWorthExpandedGroups` (new field — see §5) so it survives reload.
   - Group rows still show their roll-up balance (which is what the user usually wants); the per-account detail is opt-in.

3. **Sticky column headers** when scrolling vertically (`position: sticky; top: 0`) on `<thead>`. The first column is already sticky horizontally.

4. **Collapse-all / expand-all** buttons in the SectionCard title row.

### Acceptance
- Open Net Worth with a fresh import → only ~6 month columns visible, groups collapsed, totals correct.
- Expanding "Tax-advantaged accounts" reveals child accounts; collapsing hides them.
- "Show: All" + "Expand all" reproduces today's behavior.
- Expansion state persists after a page reload.

### Files
- `src/pages/NetWorthPage.tsx` (primary)
- `src/store/useFinanceStore.ts` (add `uiState` slice on scenario; see §5)
- `src/types/index.ts` (add `uiState?: ScenarioUiState` to `Scenario`)

---

## 2. New: Portfolio breakdown panel on Net Worth page

User wants Net Worth broken down by the stocks they own and by pretax / post-tax / taxable / etc.

### Data sources already available
- `Account.holdings: StockHolding[]` (ticker, shares, pricePerShare) — `src/types/index.ts`
- `Account.taxTreatment` (`pretax | roth | taxable | none`)
- `Account.allocationCategory` (`pretax | posttax | taxable_brokerage | cash_hysa | other`)
- `Account.accountType` (`401k | roth_ira | hsa | brokerage | ...`)
- `getHoldingsValue` and `getAllocationBreakdown` already exist in `src/engine/accounts.ts`.

### Build a new component `src/components/networth/PortfolioBreakdown.tsx`

Tabbed (or segmented-control) view with four breakdowns. Each tab renders a donut/pie + a sortable table.

1. **By tax bucket** (`pretax | roth (post-tax) | taxable | cash | other`)
   - Map from `allocationCategory` already — call out top-level subtotals + % of portfolio.
2. **Pretax vs Post-tax** (simplified 3-slice view: Pretax / Post-tax / Taxable, ignoring cash)
   - Aggregated from `taxTreatment`.
3. **By account type** (401k, Roth IRA, HSA, Brokerage, …) — sum balances grouped by `accountType` label from `ACCOUNT_TYPES`.
4. **By ticker** — flatten `accounts.flatMap(a => a.holdings.map(h => ({...h, accountName: a.name, taxTreatment: a.taxTreatment})))` then group by ticker. Show:
   - ticker, total shares, avg price, market value, % of holdings total,
   - sub-row: which accounts hold it (expandable).
   - Add an "Uncategorized cash/funds" line equal to `account.balance - getHoldingsValue(account.holdings)` for holdings-tracked accounts where the gap is positive — so the donut sums to net assets, not just tracked tickers.

### Source of truth
Use **current account balances** (`resolveAccountBalance`) for the live breakdown, NOT historical snapshots — snapshots don't have per-ticker resolution. Add a small disclaimer: *"Based on current account balances and holdings, not historical snapshots."*

### Placement
Insert as a new `SectionCard` in `NetWorthPage.tsx` between the metric grid and the two charts (or as its own `<details>` block above the snapshot grid). Title: **"Portfolio breakdown"**.

### Acceptance
- Tabs switch instantly; numbers reconcile with Dashboard's allocation pie.
- "By ticker" tab is empty-stated cleanly when no `holdings` are configured.
- Sum of each tab's slices equals total invested + cash (or clearly labeled subtotal).

### Files
- `src/components/networth/PortfolioBreakdown.tsx` (new)
- `src/engine/networth.ts` — add `getPortfolioBreakdown(accounts, allocationCategories)` returning `{ byTaxBucket, byTreatment, byAccountType, byTicker }`. Unit-test it.
- `src/engine/networth.test.ts` — extend with portfolio-breakdown cases.
- `src/pages/NetWorthPage.tsx` — render the new card.

---

## 3. Bug fixes & polish found during the audit

### 3a. Dashboard "Net Worth" vs Net-Worth-page "Net Worth" disagree
`DashboardPage` calls `computeDashboardMetrics(scenario, ...)` which derives net worth from `accounts[]`. The Net Worth page uses `getLatestSnapshotTotals(scenario)` which derives it from `netWorthSnapshots`. If the user imported a stale XLSX, the two headline numbers can differ by tens of thousands.

**Fix:** Make Dashboard prefer the latest snapshot when one exists, falling back to account-derived. Add a "Source: snapshot YYYY-MM-DD" subtitle on the Dashboard Net Worth card.

- Touch `src/pages/DashboardPage.tsx`: import `getLatestSnapshotTotals`; if it returns non-null and its date is newer than today minus 45 days, use it.
- Add a `sub={...}` to the existing `<MetricCard label="Net Worth" ... />`.

### 3b. Snapshot grid input is uncontrolled-flicker on empty values
In `NetWorthPage.tsx` line ~360 and ~390:
```tsx
value={snapshot.balances[item.id] ?? ''}
```
Typing a number then deleting it dispatches `null`, which removes the key; the input then becomes `''` again — fine. But typing `-` mid-edit (negative balance) momentarily fails `Number('-')`, calling `updateNetWorthBalance(..., NaN)`. Guard:
```ts
const num = Number(raw)
updateNetWorthBalance(snapshot.id, item.id, Number.isFinite(num) ? num : null)
```

### 3c. `isInvestmentLineItem` precedence bug
`src/engine/networth.ts` line ~171:
```ts
if (lower.includes('checking') || lower.includes('savings') && !lower.includes('equity')) return false
```
Operator precedence makes this `checking || (savings && !equity)` — readable, but probably not what was intended for "Savings (Equity)". Wrap explicitly:
```ts
if (lower.includes('checking') || (lower.includes('savings') && !lower.includes('equity'))) return false
```
Add a unit test that "Savings (Equity)" is treated as an investment line item.

### 3d. NW import: section header for "Total Assets" / "Total Liabilities" rows
The `SKIP_LABELS` set on line ~18 skips total rows, but the workbook from the user has "Total Cash/Savings/Equity" — already there. Good. But verify "total tax-advantaged accounts" / "total taxable accounts" group totals don't get parsed as accounts. If they do, add them to `SKIP_LABELS` or treat them as group roll-up sources (then drop double-counting).

### 3e. Manual snapshot date can be in the future
`NetWorthPage.tsx` line ~178 lets `manualDate` be any date. The recent commit `4ba6a47` already fixed display, but the input still accepts future dates. Add `max={todayISO()}` to the date input.

### 3f. `getEffectiveSnapshots` allocates on every render
The page calls it 4× per render (once directly, plus inside `buildNetWorthHistorySeries`, `computePeriodMetrics`, `getDataThroughDate`). Memoize once at the top of `NetWorthPage.tsx` (already done for some), and refactor `computePeriodMetrics` + history builder to accept a pre-sorted list to avoid re-sorting. Minor — only worth doing if profiling shows it.

### 3g. CSV export omits the date the file was generated
Trivial: prepend `# Exported YYYY-MM-DD HH:MM` as the first line. Helpful for the user when they have multiple files.

---

## 4. Performance / UX touches

- **Virtualize the snapshot grid** if "Show: All" is selected and >24 columns. Use `react-window` (already a small dep choice) or roll a simple windowing for the columns.
- **Currency formatting in inputs**: the snapshot grid inputs are `type="number"` which strips commas. Consider a controlled text input with `Intl.NumberFormat` on blur, raw number on focus.
- **Keyboard nav**: Tab from one cell should move to the next snapshot column for the same account (down-then-right pattern is more common in spreadsheets). Low priority.

---

## 5. Store: per-scenario UI state

Add a small UI-state slice that persists alongside the scenario, so things like "which groups are collapsed", "preferred snapshot window", "portfolio-breakdown active tab" survive reloads without polluting `profile` / `assumptions`.

```ts
// src/types/index.ts
export interface ScenarioUiState {
  netWorthExpandedGroups: Record<string, boolean>
  netWorthSnapshotWindow: 6 | 12 | 'ytd' | 'all'
  portfolioBreakdownTab: 'taxBucket' | 'treatment' | 'accountType' | 'ticker'
}

export interface Scenario {
  // ...existing
  uiState?: ScenarioUiState
}
```

- `src/store/useFinanceStore.ts`: add `updateUiState(partial: Partial<ScenarioUiState>)` action that merges into the active scenario.
- Default initializer in the scenario factory.
- Migrate existing persisted scenarios: a missing `uiState` should just be filled in on first read (zustand-persist migrate hook).

---

## 6. Tests to add

Already have `src/engine/networth.test.ts` (vitest). Add:

1. `getPortfolioBreakdown` — given accounts with holdings, returns expected ticker totals, account-type subtotals, tax-bucket subtotals.
2. `isInvestmentLineItem` — "Savings (Equity)" → true; "Chase Checking" → false; "Roth IRA – Fidelity" → true.
3. Net worth page integration: snapshot window filter doesn't change `historySeries` length.
4. `updateNetWorthBalance` ignores `NaN` input.

Run with `npm test`.

---

## 7. Suggested commit slicing (so the PR isn't a monster)

1. `refactor(networth): memoize and harden updateNetWorthBalance against NaN`
2. `fix(networth): isInvestmentLineItem precedence for "Savings (Equity)"`
3. `feat(store): add per-scenario uiState slice with persist migration`
4. `feat(networth): collapsible groups + recent-window filter on snapshot grid`
5. `feat(networth): portfolio breakdown panel (tax bucket / treatment / account type / ticker)`
6. `fix(dashboard): prefer latest snapshot for headline net worth`
7. `chore(networth): csv export header timestamp, future-date max on manual input`

---

## 8. Live ticker prices

Adds an online dependency the app didn't have before — gate behind a Settings toggle (`scenario.profile.livePricesEnabled`, default off) so the app still works fully offline.

### Provider choice
Default to **Yahoo Finance's unofficial public quote endpoint** (`https://query1.finance.yahoo.com/v7/finance/quote?symbols=AAPL,MSFT`). No API key, returns JSON, used by countless OSS finance trackers. Fall back to **Stooq** (`https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcv&h&e=csv`) if Yahoo 429s. Make the provider pluggable so the user can paste an Alpha Vantage / Finnhub key later.

```ts
// src/engine/prices.ts (new)
export interface QuoteProvider {
  id: 'yahoo' | 'stooq' | 'alphavantage' | 'finnhub'
  fetchQuotes(tickers: string[]): Promise<Record<string, Quote>>
}
export interface Quote {
  ticker: string
  price: number
  currency: string
  asOf: string  // ISO timestamp from provider
  source: QuoteProvider['id']
}
```

### CORS / Electron
- Yahoo and Stooq both block browser CORS. In the **Vite dev server** add a proxy in `vite.config.ts` (`/api/quote/*` → upstream). In **production web build** the proxy is gone, so:
  - **Electron build**: fetch from the main process via IPC (`electron/main.cjs` exposes `ipcMain.handle('quotes:fetch', ...)`, renderer calls `window.electronAPI.fetchQuotes`). Electron isn't subject to CORS — clean path.
  - **Plain web build (if anyone uses it)**: fall back to a "Refresh prices" button that prompts the user to paste an Alpha Vantage / Finnhub key, which the providers do allow CORS for.
- Add a tiny `src/lib/quoteClient.ts` that picks the right transport (Electron IPC vs direct fetch vs proxy) at runtime — gate on `isElectronFile` from `src/lib/isElectron.ts`.

### Caching & throttle
- Cache the last fetched `Record<ticker, Quote>` in zustand-persist under `state.priceCache`. Cache TTL: 15 min during market hours, 12h after-hours.
- Manual refresh button on the Portfolio breakdown card and Accounts page. Auto-refresh once on app launch if cache stale and live prices enabled.
- Batch one request for all unique tickers across all holdings — don't fan-out per ticker.

### Holding price reconciliation
When live prices are on:
- `StockHolding.pricePerShare` becomes the **manual/override** price; if a live quote exists for the ticker, surface it as the active price and grey-out the manual field with a "Using live $XYZ — click to override" affordance.
- Show `asOf` timestamp + source ("Yahoo, 2 min ago") on each holding row and at the top of the breakdown card.
- Stale-price badge if `asOf` is >24h old.

### Settings UI
In `SettingsPage.tsx` add a "Market data" section:
- Toggle: "Fetch live stock prices"
- Provider dropdown (Yahoo / Stooq / Alpha Vantage + key field / Finnhub + key field)
- "Last refresh" timestamp + manual refresh button
- "Clear price cache"

### Acceptance
- With the toggle off, app behaves exactly as today, no network requests.
- With it on, opening Portfolio breakdown triggers one batched quote fetch; tickers show live prices with source + timestamp.
- Electron build works without CORS workarounds.
- Plain web build cleanly explains the key requirement.
- Failures (network down, 429, bad ticker) degrade silently to manual prices with a non-intrusive warning chip.

### Files
- `src/engine/prices.ts` (new — provider interfaces + Yahoo, Stooq, Alpha Vantage, Finnhub impls)
- `src/lib/quoteClient.ts` (new — transport picker)
- `vite.config.ts` (dev proxy)
- `electron/main.cjs` + `electron/preload.cjs` (IPC handler)
- `src/store/useFinanceStore.ts` (priceCache slice, fetch action, settings fields)
- `src/types/index.ts` (extend `UserProfile` or new `MarketDataSettings`)
- `src/pages/SettingsPage.tsx` (UI)
- `src/components/networth/PortfolioBreakdown.tsx` (consume live prices)
- `src/pages/AccountsPage.tsx` (show live price in `StockHoldingsEditor`)

---

## 9. Cost basis & tax-lot tracking

Lets the user see unrealized gain/loss per holding, short-term vs long-term, and feeds future tax-loss-harvesting / Roth-conversion sims.

### Data model
Extend `StockHolding` with lots (a holding without explicit lots is treated as a single lot at the entered `pricePerShare`, acquired at `acquiredDate` if present, otherwise unknown).

```ts
// src/types/index.ts
export type LotMethod = 'fifo' | 'lifo' | 'avg' | 'specific_id' | 'hifo'

export interface TaxLot {
  id: string
  shares: number
  costPerShare: number
  acquiredDate: string  // ISO YYYY-MM-DD
  notes?: string
}

export interface StockHolding {
  id: string
  ticker: string
  shares: number           // derived from sum(lots[].shares) when lots present; else manual
  pricePerShare: number    // current price (manual or overridden by live quote)
  lots?: TaxLot[]          // optional — absence = single implicit lot
  costBasisMethod?: LotMethod  // default 'fifo'
}
```

Add a per-account or per-scenario default lot method (`scenario.profile.defaultLotMethod`).

### Engine
New `src/engine/costBasis.ts`:
```ts
export interface HoldingGainLoss {
  ticker: string
  marketValue: number
  totalCost: number
  unrealizedGain: number
  unrealizedGainPct: number
  shortTermShares: number    // held <= 365 days
  longTermShares: number
  shortTermGain: number
  longTermGain: number
  avgCostPerShare: number
}
export function computeHoldingGainLoss(holding: StockHolding, asOfDate?: string): HoldingGainLoss
export function aggregateGainLoss(accounts: Account[], asOfDate?: string): {
  perTicker: HoldingGainLoss[]
  perAccount: Array<{ accountId: string; gainLoss: HoldingGainLoss[] }>
  totals: { marketValue: number; totalCost: number; unrealizedGain: number; shortTerm: number; longTerm: number }
}
```

Short-term threshold: 365 days from `acquiredDate` to `asOfDate`. Lots without `acquiredDate` count as "unknown term" — bucket separately, don't double-count into ST/LT.

### Realized gains (future-proofing — out of scope for v1, document the shape)
Sketch a `TaxLotSale` interface (`{ lotId, shares, salePrice, saleDate }`) so a later release can plug in realized-gain history. Not built now — just leave the type alongside so the model is forward-compatible.

### UI

1. **Holdings editor** (`AccountsPage.tsx`):
   - Add a "Lots" disclosure under each holding row: a small table of `{shares, cost/share, acquired date}`. Add/remove lots. "Cost basis method" dropdown per holding (defaults to scenario default).
   - When lots exist, the top-level `shares` field becomes read-only (computed from lots sum). A "Convert to single lot" button collapses lots back to one row.

2. **Portfolio breakdown — new "Cost basis" tab** (5th tab):
   - Table: ticker | shares | avg cost | current price | market value | unrealized $ | unrealized % | ST gain | LT gain
   - Filter chips: All / Gains / Losses
   - Sort by unrealized %, market value, etc.

3. **Per-holding row in editor** shows live unrealized gain badge.

### Excel/CSV import
Most brokerages export lot CSVs (Schwab, Fidelity, Vanguard each have slightly different column names). Add an "Import lots from CSV" button on the holdings editor:
- Wizard: paste CSV → auto-detect columns (ticker, quantity, cost basis, date acquired) → map → preview → import.
- Use the same `xlsx` lib for parsing.
- Store the importer in `src/engine/lotsImport.ts`.

### Migration
Existing `StockHolding` records have no `lots`. The engine treats them as a single implicit lot at `pricePerShare` with `acquiredDate: null` (counted as "unknown term"). No destructive migration — `lots` is purely additive.

### Acceptance
- Adding two lots to AAPL (10 sh @ $150 acquired 2023-01-01, 5 sh @ $180 acquired 2025-03-01) with current price $200 shows:
  - Total cost $2400, market value $3000, unrealized +$600 (+25%).
  - Short-term shares: 5 (the 2025 lot if "today" < 2026-03-01) → $100 ST gain.
  - Long-term shares: 10 → $500 LT gain.
- FIFO vs LIFO vs HIFO methods only matter once realized sales exist — verify the method dropdown persists, even though it's a no-op until v2.
- Removing all lots reverts to single-lot legacy behavior.
- Unit tests cover ST/LT split, lots-without-date bucketing, and the live-price interaction.

### Files
- `src/types/index.ts` (TaxLot, LotMethod, extend StockHolding)
- `src/engine/costBasis.ts` (new)
- `src/engine/costBasis.test.ts` (new)
- `src/engine/lotsImport.ts` (new)
- `src/components/networth/PortfolioBreakdown.tsx` (new Cost-basis tab)
- `src/pages/AccountsPage.tsx` (Lots editor)
- `src/schemas/forms.ts` (zod for TaxLot)

---

## Out of scope (worth raising later)
- Realized gains / sale history (model sketched in §9, not implemented).
- Multi-currency holdings (would force a currency field on `TaxLot` + FX layer).
- Historical per-ticker reconstruction from snapshots (data isn't there).
- Options / crypto staking yields / dividends reinvested as new lots.
