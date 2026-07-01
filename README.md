# Midnight Ledger

A **local-first personal finance tracker** for net worth, FIRE progress, retirement projections, tax planning, paycheck analysis, mortgage/debt payoff, and stock lot tracking. Built with React + Vite + Zustand, packaged as both a web app and a Windows Electron desktop app. All data persists in browser storage — no server, no account required.

## Quick start

```bash
npm install
npm run dev
```

Open **http://localhost:5173**

## Capabilities

### Core / Shell
- **Multi-scenario workspace** — create, switch, duplicate, and rename scenarios; each has its own accounts, profile, budgets, snapshots, and transactions
- **Onboarding flow** (`/`) on first run before app unlocks
- **Dark/light theme** with live sync
- **Electron desktop build** (portable `.exe`) alongside the web build
- **Hash vs Browser router** auto-swapped when running in Electron
- **Persisted state** via Zustand `persist` with hydration gate
- **Multi-currency display** (USD / CAD / EUR / GBP)

### Dashboard (`/dashboard`)
- Net worth, invested assets, cash, retirement, brokerage, debt at a glance
- Savings rate, FI progress, CoastFI progress
- Asset allocation pie chart (customizable categories)
- Net worth projection chart
- **Contribution-limits YTD panel** — 401(k), IRA, HSA usage vs 2026 IRS limits (with age 50/55 catch-up), with "nearing limit" and "exceeded" warnings

### Net Worth (`/net-worth`)
- Hierarchical line-item tree (sections → groups → accounts) split into assets/liabilities
- Manual snapshot entry with date picker
- Snapshot history with configurable window (6mo / 12mo / YTD / all) and range presets (1M / 3M / 1Y / YTD / all)
- Projection overlay toggle
- **Portfolio breakdown** by tax bucket / tax treatment / account type / ticker / cost basis
- **Holdings setup modal** + "What I Own" panel
- **XLSX import/export** of a full NW tracker workbook
- Cash distribution tracking per snapshot

### Accounts (`/accounts`)
- CRUD for 17 account types: 401(k), Roth 401(k), Traditional/Roth IRA, HSA, brokerage, HYSA, checking, savings, ESPP, pension, real estate, crypto, loan, mortgage, credit card, custom
- Per-account: balance, monthly contribution, expected return, tax treatment, employer match %, contribution auto-increase, allocation category, interest rate, loan term, notes
- Stock holdings inside accounts with **tax lots** (FIFO / LIFO / AVG / HIFO / specific-id cost basis)
- Sync-balance-from-holdings toggle
- Liability flag for debt accounts
- React Hook Form + Zod validation
- CSV import/export

### Projections (`/projections`)
- **Monte Carlo** fan chart (median, best/worst case)
- Nominal and inflation-adjusted views
- Adjustable assumptions: return rate, volatility, inflation, salary growth, contribution growth, portfolio dividend yield

### FIRE & CoastFI (`/fire`)
- FIRE number, progress, gap, years until FI
- Preset + custom withdrawal rates (3% / 3.5% / 4%)
- CoastFI timeline chart
- Success probability estimate
- Contribution impact analysis
- **Target-age back-solver** — enter a desired retirement age, get the monthly savings required to hit FIRE by that age

### Tax Planning (`/tax`)
- Retirement withdrawal tax simulator (traditional / Roth / brokerage buckets)
- Federal brackets (2024) with unit-tested engine
- State tax (CA, TX, NY, FL, WA, IL, PA, NJ, CO, none) using flat-rate estimates
- Long-term capital gains + qualified dividends
- Social Security benefit input
- Filing status: single / MFJ / MFS / HoH
- Tax-bracket chart, income waterfall, Sankey flow

### Paycheck (`/paycheck`)
- Gross-to-net calculator: salary, bonus, 401(k) pretax + Roth, HSA, ESPP, health insurance, other deductions
- Frequencies: weekly / biweekly / semi-monthly / monthly
- **Self-employment mode** with solo 401(k) and SE tax
- Paycheck breakdown chart

### Budget (`/budget`)
- Post-tax expense categories with defaults (housing, food, transport, utilities, entertainment, personal, savings, other)
- Savings-rate snapshots tracked over time

### Transactions (`/transactions`)
- Buy / sell / dividend stock transactions
- CSV import parser
- Applies to cost basis via the lots engine
- **Recurring weekly batches** for DCA / recurring buys (1–52 weeks)

### Cash Flow (`/cash-flow`) *(new)*
- Recurring & one-off income / expense / transfer ledger
- Frequencies: once, weekly, biweekly, monthly, quarterly, yearly
- **This-month summary** (income, expenses, net)
- **Upcoming bills** (next 30 days) with due dates and amounts
- **Last-6-months** monthly cash-flow rollup
- Category tagging (housing, food, utilities, transport, entertainment, personal, salary, other)

### Goals & Sinking Funds (`/goals`) *(new)*
- **Financial goals** with progress gauges (emergency fund, down payment, vacation, car, wedding, other)
- Target amount, current amount, monthly contribution, target date
- Auto-calculated "months to completion" at current pace
- **Emergency fund health check** — coverage in months of last-month expenses
- **Sinking funds** for known future expenses (holiday gifts, annual insurance, subscriptions) with progress bars

### Insurance (`/insurance`) *(new)*
- Policy tracker: life, disability, health, auto, home / renters, umbrella, other
- Premium + frequency (monthly / quarterly / yearly), annualized totals
- Coverage amount, provider, renewal date, beneficiary, policy number
- Rollup: total annual premiums and total coverage

### Credit & Interest (`/credit`) *(new)*
- Credit-score history with inline SVG trend chart (bureau: Equifax / Experian / TransUnion / other)
- Score band (Exceptional / Very Good / Good / Fair / Poor)
- Trend delta from first-logged score
- **Estimated interest paid YTD** across all liability accounts

### Tax-Loss Harvesting (`/tax-loss-harvest`) *(new)*
- Surfaces unrealized-loss **lots** in taxable accounts (brokerage / ESPP / crypto)
- Short-term vs long-term classification (holding period)
- Rollup: total loss, ST loss, LT loss, candidate count
- Wash-sale reminder

### Mortgage (`/mortgage`)
- Amortization analyzer
- Payoff modeling and extra-payment scenarios

### Debt Payoff (`/debt-payoff`)
- Avalanche / snowball payoff strategies via the loans engine

### Analytics (`/analytics`)
- Trend charts, savings-rate history, allocation analytics
- Stress testing (crash, inflation, spending, savings reduction)
- Sequence-of-returns risk
- Fee impact calculator
- Roth vs Traditional analyzer
- RMD estimator
- Roth conversion planner

### Compare Scenarios (`/analytics/compare`)
- Side-by-side comparison across scenarios

### Settings (`/settings`)
- Profile: name, current age, retirement age, life expectancy, salary, filing, state
- Currency and light-mode toggle
- Market-data settings (see below)
- Default cost basis method
- Allocation category customization (labels + colors)

## Market Data / Live Prices
- Optional live price fetching (`livePricesEnabled` toggle)
- **Quote providers**: Yahoo, Stooq, Alpha Vantage, Finnhub (with API key inputs)
- Auto-refresh on load if last fetch is > 12h old
- Price cache persisted in state
- Ticker-level `PriceQuote` records with source + timestamp

## Stress Testing
- Market crash %, return reduction, inflation shock, early retirement years, spending increase, and savings reduction inputs wired into projection stress scenarios

## Data
- Multiple scenarios
- JSON + CSV export/import
- XLSX net-worth workbook import/export
- `localStorage` persistence keyed as `midnight-ledger-v2`

## Architecture

```
src/
  engine/          # Centralized financial calculations (testable)
    tax.ts         # Federal brackets, state tax, RMD, Roth analysis (tested)
    networth.ts    # NW rollup (tested)
    costBasis.ts   # Lot-tracking gains/losses (tested)
    projections.ts # Monte Carlo, deterministic projections
    fire.ts        # FIRE, CoastFI, withdrawal
    paycheck.ts    # Payroll deductions
    budget.ts      # Budget rollups
    loans.ts       # Amortization
    accounts.ts    # Aggregations, allocation, CSV
    transactions.ts# Buy/sell/dividend application
    csvParse.ts    # CSV import
    lotsImport.ts  # Tax-lot import
    networthXlsx.ts# XLSX read/write
    nwSeedLoader.ts# Seed data loader
    analytics.ts   # Stress tests, fee impact, sequence risk
    prices.ts      # Quote fetching
    format.ts      # Currency/number formatting
  store/           # Zustand + persist
  pages/           # Route-level views
  components/      # Layout, charts (Recharts), shared UI
  schemas/         # Zod validation
```

## Tech stack
- Vite + React 18 + TypeScript
- Tailwind CSS
- Zustand (persisted state)
- Recharts
- React Hook Form + Zod
- Framer Motion
- React Router
- Electron (Windows portable build)
- Vitest (unit tests)

## Build

```bash
npm run build
npm run preview
```

### Windows desktop app

Portable `.exe` (single file on Desktop, app data in `%APPDATA%\MidnightLedger`):

```bash
npm run package:desktop
```

Verify onboarding → dashboard headlessly:

```bash
npm run verify:desktop
```

## Testing

```bash
npm test              # Vitest unit tests (tax, networth, costBasis)
npm run test:parser   # CSV/XLSX parser verification
npm run test:e2e      # Electron end-to-end
npm run test:packaged # Packaged-launch smoke test
npm run test:all      # Everything
```

## Notes

Tax and projection calculations are **planning estimates**, not professional tax or investment advice. Federal brackets use 2024 IRS tables; state taxes use simplified flat rates.

## Reset data

Settings → Reset all data, or delete `midnight-ledger-v2` from localStorage.
