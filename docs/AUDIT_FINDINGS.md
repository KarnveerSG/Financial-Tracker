# Midnight Ledger — Fresh Audit Findings

Status check: every item from `IMPROVEMENT_PLAN.md` §1–§9 appears to be implemented and shipping (uiState slice, collapsible NW groups, snapshot window filter, Portfolio Breakdown component, cost basis engine, Electron IPC quote fetch, Settings UI). Tests pass (15/15), `npm run build` is clean.

This file lists **real defects and gaps** I found while re-reading the code afterward. Severity tags: 🔴 bug, 🟡 quality / correctness smell, 🟢 missing feature.

---

## 🔴 Bugs (incorrect output today)

### 1. `analyzeRothVsTraditional` is a no-op — Roth always "wins" by tax%
[src/engine/tax.ts:201-221](src/engine/tax.ts)
```ts
const rothFuture = annualContribution * ((Math.pow(1 + r, years) - 1) / r) * (1 + r)
const traditionalFuture = annualContribution * ((Math.pow(1 + r, years) - 1) / r) * (1 + r)
```
Both branches compute the same future value, then traditional is taxed and Roth isn't. The whole point of the comparison is that the traditional account contributes the *pre-tax* dollar amount and the Roth contributes a *post-tax* amount (i.e. less principal). The current code makes Roth a strict win, hiding the breakeven case. The "Roth vs Traditional Analyzer" on the Analytics page produces misleading guidance.

Also: `_currentTaxRate` is prefixed `_` and unused — that's the correct knob to apply to Roth contributions (`annualContribution * (1 - currentTaxRate)`), or to scale up traditional principal.

**Fix:** model the standard equivalence — `roth = post_tax_contribution * (1+r)^n`, `trad = pre_tax_contribution * (1+r)^n * (1 - future_tax_rate)`, and only when `current_tax_rate == future_tax_rate` are they equal.

### 2. `rothConversionAnalysis` breakeven is fake
[src/engine/tax.ts:232-244](src/engine/tax.ts)
```ts
const breakevenYears = currentTaxRate > futureTaxRate ? yearsToGrow * 0.6 : yearsToGrow * 1.2
```
Hard-coded heuristic — not actually solving a breakeven equation. Should compute the year at which `(conversionAmount - taxNow) * (1+r)^y == conversionAmount * (1+r)^y * (1 - futureTaxRate)` — i.e. when paying tax now beats deferring it. The card on the Analytics page advertises this number as planning advice.

### 3. `estimateRMD` has wrong table + typo'd param name
[src/engine/tax.ts:223-230](src/engine/tax.ts)
```ts
export function estimateRMD(TraditionalBalance: number, age: number): number {
  const factors: Record<number, number> = {
    73: 26.5, 74: 25.5, 75: 24.6, 80: 20.2, 85: 16.0, 90: 12.2, 95: 8.9,
  }
  const factor = factors[age] ?? factors[95] ?? 10
```
The IRS Uniform Lifetime Table is a contiguous series from age 73 → 120. This sparse lookup means anyone aged 76, 77, 78, 79, 81–84, 86–89, etc. silently falls through to the `?? 10` default and gets an inflated RMD. Param is `TraditionalBalance` (PascalCase) — minor lint smell. Replace with the full table or a piecewise-linear interpolation.

### 4. `estimateSocialSecurityBenefit` materially wrong
[src/engine/tax.ts:191-199](src/engine/tax.ts)
```ts
const aime = Math.min(annualSalary, 168600) / 12
const pia = aime * 0.4 * 12
```
- `168600` is the 2024 SSA *wage base for FICA*, not the AIME cap. AIME comes from the highest 35 years of indexed earnings, capped per year.
- PIA is a three-bracket bend-point formula (90% / 32% / 15%), not a flat 40%.
- Early-retirement reduction is non-linear (5/9% per month for first 36 months, 5/12% thereafter, FRA is 66–67 by birth year).

The current implementation is roughly off by 30–50% depending on income. Either replace with the actual SSA bend-point formula or label the UI as "very rough estimate".

### 5. Paycheck page builds a nonsense effective-tax-rate string
[src/pages/PaycheckPage.tsx:30-37](src/pages/PaycheckPage.tsx)
```ts
const effectiveTaxRate =
  paycheck.annualGross > 0
    ? ((paycheck.federalTax * PERIODS[paycheckInputs.frequency] * (paycheckInputs.frequency === 'monthly' ? 1 : 1) + ...
```
The `(paycheckInputs.frequency === 'monthly' ? 1 : 1)` ternary is the same on both branches — that's a placeholder someone forgot to finish. The whole expression multiplies per-period dollars by `PERIODS[frequency]` to annualize, which is fine, but the ternary suggests there *was* meant to be a different scaling factor. Either delete the dead ternary or fix the intended logic.

### 6. `getAnnualCashFlowSummary` math is wrong
[src/engine/paycheck.ts:122-129](src/engine/paycheck.ts)
```ts
{ category: 'Taxes & FICA', amount: breakdown.federalTax * PERIODS.monthly * 12 / 12 + ... },
{ category: 'Retirement', amount: (breakdown.pretax401k + breakdown.roth401k) * PERIODS.monthly * 12 },
```
`PERIODS.monthly = 12`. `12 * 12 / 12 = 12` — correct for monthly only. But the inputs are *per-period* amounts using the user's chosen frequency, not monthly. So if the user is biweekly, this multiplies a biweekly dollar by 12 to "annualize", producing roughly half the real number. The function is exported but doesn't appear used in the UI — either fix it or delete it.

### 7. `tradBalance` for RMD ignores Roth 401(k) handling
[src/pages/AnalyticsPage.tsx:45](src/pages/AnalyticsPage.tsx)
```ts
const tradBalance = accounts.filter((a) => a.taxTreatment === 'pretax').reduce(...)
```
Pretax balance is right, but RMDs don't apply to Roth IRAs *or* Roth 401(k)s (post-SECURE 2.0, 2024). And the user can have `accountType: 'roth_401k'` with `taxTreatment: 'roth'` — that's correctly excluded. But this also excludes HSA which is non-RMD — also correct. Mostly fine, just worth a comment saying SECURE 2.0 dropped Roth 401(k) RMDs.

### 8. `calculateMedicareTax` uses wages including pretax 401(k)
[src/engine/tax.ts:126-135](src/engine/tax.ts) + [paycheck.ts:55](src/engine/paycheck.ts)
```ts
const medicareAnnual = calculateMedicareTax(annualGross, filingStatus)
```
Medicare *does* tax 401(k) pretax contributions (FICA-taxed), so that's correct. But the `0.009` additional-Medicare-tax thresholds use `wages` (gross), which for joint filers should be `$250k`, not the un-implemented joint case. The function takes `FilingStatus` but only treats `married_separate` as the joint special case — `single` and `married_joint` and `head_of_household` all share the `200000` floor. For `married_joint` the IRS threshold is actually `$250,000`.

### 9. `computeDashboardMetrics` doesn't use snapshot data
[src/engine/accounts.ts:70-120](src/engine/accounts.ts) and the original plan §3a flagged this. Verified it was NOT fixed — Dashboard still derives net worth purely from `accounts[]` while the Net Worth page uses snapshots. Two headline numbers can disagree if the user imported a stale XLSX or hasn't updated account balances after a snapshot. **Action**: keep the fix from `IMPROVEMENT_PLAN.md` §3a in the backlog.

### 10. Stress test calls `estimateFireProbability` four times
[src/engine/analytics.ts:64-79](src/engine/analytics.ts) — once for baseline, once for stressed, then twice more inside the same return object. Each call is 200 simulations × 60 years of math. Cache the two results:
```ts
const baseSuccess = estimateFireProbability(scenario, 200)
const stressSuccess = estimateFireProbability(stressedScenario, 200)
```

### 11. `inferAccountType` precedence bug in original engine
[src/engine/networth.ts](src/engine/networth.ts) — `isInvestmentLineItem`:
```ts
if (lower.includes('checking') || lower.includes('savings') && !lower.includes('equity')) return false
```
This was flagged in the original plan §3c and **was not fixed in code**. JS operator precedence makes this `checking OR (savings AND NOT equity)`, which happens to match the intended behavior for "Chase Checking", "Savings", and "Savings (Equity)" — so the visible behavior is correct. But it's a code-review trap and should be parenthesized.

---

## 🟡 Quality / correctness smells

### 12. `unknownTermShares` and `unknownTermGain` aren't surfaced anywhere
`costBasis.ts` computes `unknownTermShares` for lots with no `acquiredDate` (and the implicit single-lot case always has `acquiredDate: null` → counts as unknown). The cost-basis tab on the Portfolio Breakdown only shows `shortTermGain` / `longTermGain`. If a user adds a holding without lots, their gains are not classified at all. Either:
- Surface a third column "Unknown term" and a per-row badge, or
- Default the implicit lot to today's date so it's classified as ST until a year passes.

### 13. Live-price refresh fires on every render where dependencies "change"
[src/components/networth/PortfolioBreakdown.tsx:56-64](src/components/networth/PortfolioBreakdown.tsx)
```ts
useEffect(() => {
  if (!profile.marketData.livePricesEnabled) return
  if (!hasHoldings) return
  void refreshPrices().catch(...)
}, [profile.marketData.livePricesEnabled, accounts, refreshPrices])
```
`accounts` is a new array reference on every store update. Any time the user types in the snapshot grid the store updates → this effect re-runs → it fires another `refreshPrices()` call. Add a TTL check (`getQuoteCacheTtlMs()` from `prices.ts` is already written but unused here) before invoking:
```ts
const last = profile.marketData.lastPriceRefresh
if (last && Date.now() - new Date(last).getTime() < getQuoteCacheTtlMs()) return
```

### 14. `priceCache` only grows
`clearPriceCache` exists but `refreshPrices` does `{ ...priceCache, ...quotes }` — tickers removed from the portfolio never leave the cache. Garbage-collect on each refresh: only keep keys that are still in the holdings set.

### 15. `mapAccountsToSnapshotBalances` causes double-matches
[src/engine/networth.ts:840-844](src/engine/networth.ts)
```ts
accounts.find((a) => a.name.toLowerCase() === item.name.toLowerCase()) ??
accounts.find((a) => item.name.toLowerCase().includes(a.name.toLowerCase())) ??
accounts.find((a) => a.name.toLowerCase().includes(item.name.toLowerCase()))
```
If the user has accounts "Roth" and "Roth 401k", an imported line item "Roth 401k" matches both — the first-substring branches return whichever is sorted first. Result: snapshot balances get assigned to the wrong line item. Score matches and pick the best (longest exact prefix, then longest substring) or require exact match and prompt the user when ambiguous.

### 16. Snapshot recording overwrites group balances with account balances
[src/store/useFinanceStore.ts:578-588](src/store/useFinanceStore.ts) + `mapAccountsToSnapshotBalances`. The imported XLSX has both group-level totals ("Tax-advantaged accounts") AND child accounts. Recording a snapshot from accounts only writes account-level balances; group balances stay from the prior snapshot. Then `computeSnapshotTotals` sees both → if `hasGroupBalances`, it favors the group balance, which is stale. Either: (a) recompute group balances as sum of children on record, or (b) strip group balances when recording from accounts so we only use account-level rollups.

### 17. CSV "accounts" import doesn't sanitize `holdings` JSON
[src/engine/accounts.ts:184](src/engine/accounts.ts)
```ts
holdings: row.holdings ? JSON.parse(row.holdings) : [],
```
If the exported CSV contains `holdings` as a JSON-encoded string with commas, `parseAccountsCsv` does a naive `line.split(',')` — the commas inside the JSON value break the row apart. The export at `accountsToCsv` line 153 wraps strings with commas in quotes, but the parser strips quotes with `replace(/^"|"$/g, '')` *without* re-handling embedded commas. End-to-end CSV round-trip for any account with multiple holdings is broken. Use a proper CSV parser or escape commas in holdings before writing.

### 18. `getDateRangePresets` for `1Y` is calendar months, not 12 months of data
[src/engine/networth.ts:384-397](src/engine/networth.ts)
```ts
const offset = (months: number) => {
  const d = new Date(endDate)
  d.setMonth(d.getMonth() - months)
  ...
}
```
If end is `2026-03-15`, offset(12) → `2025-03-15`. Correct mathematically. But the chart range filter only walks the sorted snapshot array — if you only have monthly snapshots, the chip "1Y" sometimes shows 12 datapoints, sometimes 13, depending on day-of-month. Not a bug, but worth a snap-to-month-start to make the labels predictable.

### 19. Lots-import CSV: no preview/confirm step
The plan called for a wizard ("preview → import"). `parseLotsCsv` returns a `preview` array, but `AccountsPage` calls `handleLotsCsv` which immediately overwrites lots without showing the user what they're getting. Bad if the column detection went wrong (Schwab's "Cost Basis Per Share" vs "Total Cost"). Add a modal that shows the detected columns + first 5 rows.

### 20. `chartData = historySeries` ignores projection toggle in second chart
[src/pages/NetWorthPage.tsx:374-385](src/pages/NetWorthPage.tsx) — the "Assets vs liabilities" chart always plots `historySeries`, never the projection. That's fine, but the layout side-by-side with the projection-toggled "Net worth history" chart is confusing. Consider hiding the assets/liabilities chart when projection is on, or extend the projection to both.

### 21. `mapAccountsToSnapshotBalances` mutates its input
[src/engine/networth.ts:849-862](src/engine/networth.ts) — `lineItems.push(newItem)` mutates the array the caller passed in. The store call in `recordNetWorthFromAccounts` builds a fresh copy first (`[...scenario.netWorthLineItems]`), so it works by luck, but if a future caller passes the persisted reference directly, zustand will think nothing changed and skip the re-render. Return a new array instead.

### 22. `migrateScenario` runs on every rehydrate AND defaults overwrite real user data
[src/store/useFinanceStore.ts:139](src/store/useFinanceStore.ts):
```ts
uiState: { ...defaultUiState(), ...scenario.uiState },
profile: { ...defaultProfile(), ...scenario.profile, ... },
```
`...defaultProfile()` first means a user who set `currentAge: 0` (deliberately) gets re-defaulted to 32. Spread order means user data wins, so that's actually fine. But the migration runs on every load — once `scenarios` have been touched once, you don't need to re-merge defaults. Add a `schemaVersion` field and short-circuit.

---

## 🟢 Missing features (worth doing if you ever do another pass)

### 23. No "current value" in the holdings list outside the form
The Accounts page list view shows balance and contribution, but not the live unrealized-gain summary. Add a chip when `holdings.length > 0`: "+ $1,240 (3.2%)".

### 24. No dividend / distribution tracking
Doesn't matter for net worth but matters for "real" portfolio return calculation in `computePeriodMetrics`. Right now the Modified Dietz calc treats contributions as the only adjustment.

### 25. No income tracking for "self-employed / side income"
`PaycheckInputs` is W2-only. No 1099 / SE-tax pathway, no QBI deduction. A Toggle "I have self-employed income" → add SE-tax & solo-401k fields. Probably out of scope for personal-use, but flagging.

### 26. No "Compare scenarios side-by-side" view
Settings has scenario management, but the only way to compare Base vs Aggressive vs Frugal is to flip the active scenario. Add an `/analytics/compare` route that renders FIRE/CoastFI metrics in a column for each scenario.

### 27. No "What if I retire at age X?" slider
The Projections page has a static `profile.retirementAge` input. Add a slider with live recomputation of FIRE probability, similar to the contribution-impact card on the FIRE page.

### 28. Net Worth page still uses local React state for `rangePreset`, `showProjection`, `manualDate`
These get reset on every navigation away. Either accept that (current behavior) or move them into `uiState` alongside `netWorthSnapshotWindow` / `netWorthExpandedGroups`.

### 29. No keyboard navigation in snapshot grid
Tab moves to the next field — fine. But Enter doesn't submit-and-move-down, Esc doesn't revert. Spreadsheet users expect arrow keys to move between cells. Low priority.

### 30. Bundle is 1.29 MB (387 KB gzip)
[build output](#) — `recharts` + `xlsx` + `framer-motion` are all heavy. Code-split the routes that aren't on the critical path:
```ts
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const ProjectionsPage = lazy(() => import('./pages/ProjectionsPage'))
```
Will drop initial load by ~250 KB gz. Even more if `xlsx` only loads when the user clicks "Import .xlsx".

### 31. Electron quotes-fetch leaks API keys to the log on failure
[electron/main.cjs:139](electron/main.cjs):
```ts
writeLog("ERROR", `quotes:fetch failed: ${err?.stack || err}`);
```
If `fetchQuotesFromProvider` throws with the URL in the message, the URL contains `?apikey=...` for Alpha Vantage. Sanitize before logging.

---

## Suggested next session (concrete order)

1. Fix the 4 Tax/Analytics math bugs (#1–#4) — these silently mislead. ~1hr.
2. Fix #13 (refreshPrices hammer) — easy and avoids a real rate-limit. ~10min.
3. Fix #15/#16 (snapshot matching) — affects "Record snapshot today" correctness. ~1hr.
4. Lazy-load Analytics/Projections to cut bundle (#30). ~30min.
5. Add `unknownTermShares` column / fix implicit-lot acquired date (#12). ~30min.
6. Apply original plan §3a (Dashboard NW vs snapshot NW) — never landed. ~20min.

Total: ~3.5 hours for a noticeable correctness + perf bump.
