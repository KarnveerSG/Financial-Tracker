import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Account,
  AllocationCategoryDef,
  AppState,
  BudgetInputs,
  CashFlowEntry,
  CreditScoreEntry,
  FinancialGoal,
  InsurancePolicy,
  NetWorthLineItem,
  NetWorthSnapshot,
  PaycheckInputs,
  ProjectionAssumptions,
  FireSettings,
  Scenario,
  ScenarioUiState,
  SinkingFund,
  StockHolding,
  StockTransaction,
  StressScenarioInputs,
  TaxSimulatorInputs,
  UserProfile,
} from '../types'
import { DEFAULT_ALLOCATION_CATEGORIES, DEFAULT_BUDGET_CATEGORIES } from '../types'
import { createDefaultAccount } from '../engine/accounts'
import { createId } from '../engine/format'
import type { NavItemId } from '../config/navigation'

if (
  typeof localStorage !== 'undefined' &&
  !localStorage.getItem('midnight-ledger-v3') &&
  localStorage.getItem('midnight-ledger-v2')
) {
  localStorage.setItem('midnight-ledger-v3', localStorage.getItem('midnight-ledger-v2')!)
}
import {
  buildLineItemsFromAccounts,
  mapAccountsToSnapshotBalances,
} from '../engine/networth'
import { fetchQuotes } from '../lib/quoteClient'
import { buildNwTrackerSeed } from '../engine/nwSeedLoader'
import { applyTransactionToAccounts } from '../engine/transactions'

const SCHEMA_VERSION = 4

function defaultMarketData(): UserProfile['marketData'] {
  return {
    livePricesEnabled: false,
    quoteProvider: 'yahoo',
    alphaVantageKey: '',
    finnhubKey: '',
    lastPriceRefresh: null,
  }
}

function defaultUiState(): ScenarioUiState {
  return {
    netWorthExpandedGroups: {},
    netWorthSnapshotWindow: 6,
    portfolioBreakdownTab: 'taxBucket',
    netWorthRangePreset: 'all',
    netWorthShowProjection: true,
    netWorthManualDate: new Date().toISOString().slice(0, 10),
  }
}

function defaultProfile(): UserProfile {
  return {
    name: '',
    currency: 'USD',
    currentAge: 32,
    retirementAge: 65,
    lifeExpectancy: 95,
    annualSalary: 95000,
    filingStatus: 'single',
    state: 'CA',
    lightMode: false,
    marketData: defaultMarketData(),
    defaultLotMethod: 'fifo',
  }
}

function defaultAssumptions(): ProjectionAssumptions {
  return {
    inflationRate: 3,
    annualReturnRate: 7,
    returnStdDev: 15,
    salaryGrowthRate: 3,
    contributionGrowthRate: 3,
    portfolioDividendYield: 0,
  }
}

function defaultFireSettings(): FireSettings {
  return {
    annualSpending: 60000,
    withdrawalRate: 0.04,
    desiredRetirementAge: 55,
  }
}

function defaultTaxInputs(): TaxSimulatorInputs {
  return {
    traditionalWithdrawal: 40000,
    rothWithdrawal: 15000,
    brokerageWithdrawal: 10000,
    longTermGains: 5000,
    qualifiedDividends: 2000,
    socialSecurityBenefit: 24000,
  }
}

function defaultPaycheckInputs(): PaycheckInputs {
  return {
    salary: 95000,
    bonus: 5000,
    pretax401k: 12000,
    roth401k: 0,
    hsa: 4150,
    espp: 0,
    healthInsurance: 3600,
    otherDeductions: 0,
    frequency: 'biweekly',
    selfEmployedEnabled: false,
    selfEmployedNetIncome: 0,
    solo401k: 0,
  }
}

function migratePaycheckInputs(inputs?: PaycheckInputs): PaycheckInputs {
  return {
    ...defaultPaycheckInputs(),
    ...inputs,
    selfEmployedEnabled: inputs?.selfEmployedEnabled ?? false,
    selfEmployedNetIncome: inputs?.selfEmployedNetIncome ?? 0,
    solo401k: inputs?.solo401k ?? 0,
  }
}

function defaultBudgetInputs(): BudgetInputs {
  return {
    postTaxCategories: DEFAULT_BUDGET_CATEGORIES.map((c) => ({ ...c })),
  }
}

function migrateAccount(account: Account): Account {
  return {
    ...account,
    holdings: account.holdings ?? [],
    interestRate: account.interestRate ?? 0,
    loanTermMonths: account.loanTermMonths ?? 0,
    syncBalanceFromHoldings: account.syncBalanceFromHoldings ?? false,
  }
}

function migrateScenario(scenario?: Scenario): Scenario {
  if (!scenario) return createScenario()
  const version = scenario.schemaVersion ?? 0
  if (version >= SCHEMA_VERSION) {
    return {
      ...scenario,
      accounts: (scenario.accounts ?? []).map(migrateAccount),
      paycheckInputs: migratePaycheckInputs(scenario.paycheckInputs),
      assumptions: { ...defaultAssumptions(), ...scenario.assumptions },
      uiState: { ...defaultUiState(), ...scenario.uiState },
    }
  }
  return {
    ...scenario,
    schemaVersion: SCHEMA_VERSION,
    accounts: (scenario.accounts ?? []).map(migrateAccount),
    budgetInputs: scenario.budgetInputs ?? defaultBudgetInputs(),
    netWorthLineItems: scenario.netWorthLineItems ?? [],
    netWorthSnapshots: scenario.netWorthSnapshots ?? [],
    paycheckInputs: migratePaycheckInputs(scenario.paycheckInputs),
    uiState: { ...defaultUiState(), ...scenario.uiState },
    assumptions: { ...defaultAssumptions(), ...scenario.assumptions },
    profile: {
      ...defaultProfile(),
      ...scenario.profile,
      marketData: { ...defaultMarketData(), ...scenario.profile?.marketData },
      defaultLotMethod: scenario.profile?.defaultLotMethod ?? 'fifo',
    },
  }
}

function defaultStressInputs(): StressScenarioInputs {
  return {
    marketCrashPercent: 30,
    returnReduction: 2,
    inflationIncrease: 2,
    earlyRetirementYears: 0,
    spendingIncreasePercent: 20,
    savingsReductionPercent: 25,
  }
}

export function createScenario(name = 'Base Case'): Scenario {
  return {
    id: createId(),
    name,
    schemaVersion: SCHEMA_VERSION,
    accounts: [],
    profile: defaultProfile(),
    assumptions: defaultAssumptions(),
    fireSettings: defaultFireSettings(),
    taxInputs: defaultTaxInputs(),
    paycheckInputs: defaultPaycheckInputs(),
    stressInputs: defaultStressInputs(),
    allocationCategories: [...DEFAULT_ALLOCATION_CATEGORIES],
    savingsHistory: [],
    budgetInputs: defaultBudgetInputs(),
    netWorthLineItems: [],
    netWorthSnapshots: [],
    uiState: defaultUiState(),
  }
}

function createDemoScenario(): Scenario {
  const scenario = createScenario('Demo Portfolio')
  scenario.profile.name = 'Alex'
  scenario.profile.currentAge = 34
  scenario.accounts = [
    createDefaultAccount({ name: '401(k)', accountType: '401k', balance: 85000, monthlyContribution: 1500, employerMatchPercent: 50 }),
    createDefaultAccount({ name: 'Roth IRA', accountType: 'roth_ira', balance: 42000, monthlyContribution: 500 }),
    createDefaultAccount({ name: 'Brokerage', accountType: 'brokerage', balance: 28000, monthlyContribution: 800, holdings: [
      { id: createId(), ticker: 'VTI', shares: 50, pricePerShare: 240, lots: [
        { id: createId(), shares: 30, costPerShare: 180, acquiredDate: '2022-03-15' },
        { id: createId(), shares: 20, costPerShare: 260, acquiredDate: '2025-01-10' },
      ] },
      { id: createId(), ticker: 'AAPL', shares: 20, pricePerShare: 190, lots: [
        { id: createId(), shares: 20, costPerShare: 220, acquiredDate: '2025-06-01' },
      ] },
    ], syncBalanceFromHoldings: true }),
    createDefaultAccount({ name: 'HYSA', accountType: 'hysa', balance: 15000, monthlyContribution: 400 }),
    createDefaultAccount({ name: 'Checking', accountType: 'checking', balance: 5000, monthlyContribution: 0 }),
    createDefaultAccount({ name: 'Car Loan', accountType: 'loan', balance: 8500, isLiability: true, interestRate: 6.5, loanTermMonths: 36, monthlyContribution: 250 }),
  ]
  scenario.cashFlowEntries = seedCashFlow()
  scenario.goals = seedGoals()
  scenario.sinkingFunds = seedSinkingFunds()
  scenario.insurancePolicies = seedInsurance()
  scenario.creditScoreHistory = seedCreditScores()
  return scenario
}

function seedCashFlow(): CashFlowEntry[] {
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const midMonth = new Date(today.getFullYear(), today.getMonth(), 15).toISOString().slice(0, 10)
  return [
    { id: createId(), date: firstOfMonth, kind: 'income', amount: 6500, description: 'Salary', recurring: true, frequency: 'monthly', categoryId: 'salary' },
    { id: createId(), date: firstOfMonth, kind: 'expense', amount: 2200, description: 'Rent', recurring: true, frequency: 'monthly', categoryId: 'housing' },
    { id: createId(), date: midMonth, kind: 'expense', amount: 180, description: 'Electric bill', recurring: true, frequency: 'monthly', categoryId: 'utilities' },
    { id: createId(), date: firstOfMonth, kind: 'expense', amount: 65, description: 'Internet', recurring: true, frequency: 'monthly', categoryId: 'utilities' },
    { id: createId(), date: midMonth, kind: 'expense', amount: 600, description: 'Groceries', recurring: true, frequency: 'monthly', categoryId: 'food' },
    { id: createId(), date: firstOfMonth, kind: 'expense', amount: 45, description: 'Netflix + Spotify', recurring: true, frequency: 'monthly', categoryId: 'entertainment' },
    { id: createId(), date: firstOfMonth, kind: 'expense', amount: 250, description: 'Car payment', recurring: true, frequency: 'monthly', categoryId: 'transport' },
  ]
}

function seedGoals(): FinancialGoal[] {
  const inTwoYears = new Date()
  inTwoYears.setFullYear(inTwoYears.getFullYear() + 2)
  return [
    { id: createId(), name: 'Emergency Fund', kind: 'emergency_fund', targetAmount: 24000, currentAmount: 15000, monthlyContribution: 400, notes: '6 months of expenses' },
    { id: createId(), name: 'House Down Payment', kind: 'down_payment', targetAmount: 80000, currentAmount: 22000, targetDate: inTwoYears.toISOString().slice(0, 10), monthlyContribution: 1500 },
    { id: createId(), name: 'Iceland Trip', kind: 'vacation', targetAmount: 6000, currentAmount: 1200, monthlyContribution: 300 },
  ]
}

function seedSinkingFunds(): SinkingFund[] {
  const dec = new Date()
  dec.setMonth(11, 15)
  return [
    { id: createId(), name: 'Holiday gifts', targetAmount: 1500, currentAmount: 500, dueDate: dec.toISOString().slice(0, 10), monthlyContribution: 125 },
    { id: createId(), name: 'Car insurance (6mo)', targetAmount: 900, currentAmount: 300, monthlyContribution: 150 },
    { id: createId(), name: 'Annual subscriptions', targetAmount: 400, currentAmount: 200, monthlyContribution: 35 },
  ]
}

function seedInsurance(): InsurancePolicy[] {
  return [
    { id: createId(), name: 'Term Life', kind: 'life', provider: 'Haven Life', premium: 28, premiumFrequency: 'monthly', coverageAmount: 500000, beneficiary: 'Spouse', notes: '20-year term' },
    { id: createId(), name: 'Auto', kind: 'auto', provider: 'Geico', premium: 165, premiumFrequency: 'monthly', coverageAmount: 100000 },
    { id: createId(), name: 'Renters', kind: 'home', provider: 'Lemonade', premium: 22, premiumFrequency: 'monthly', coverageAmount: 40000 },
    { id: createId(), name: 'Health (employer)', kind: 'health', provider: 'BCBS', premium: 300, premiumFrequency: 'monthly', coverageAmount: 0 },
  ]
}

function seedCreditScores(): CreditScoreEntry[] {
  const out: CreditScoreEntry[] = []
  const now = new Date()
  const scores = [742, 748, 755, 761, 758, 764]
  for (let i = 0; i < scores.length; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (scores.length - 1 - i), 1)
    out.push({ id: createId(), date: d.toISOString().slice(0, 10), score: scores[i], bureau: 'experian' })
  }
  return out
}

interface FinanceStore extends AppState {
  updateActiveScenario: (updater: (s: Scenario) => Scenario) => void
  setActiveScenario: (id: string) => void
  addScenario: (name?: string) => void
  duplicateScenario: (id: string) => void
  deleteScenario: (id: string) => void
  addAccount: (account?: Partial<Account>) => void
  updateAccount: (id: string, partial: Partial<Account>) => void
  removeAccount: (id: string) => void
  updateProfile: (partial: Partial<UserProfile>) => void
  updateAssumptions: (partial: Partial<ProjectionAssumptions>) => void
  updateFireSettings: (partial: Partial<FireSettings>) => void
  updateTaxInputs: (partial: Partial<TaxSimulatorInputs>) => void
  updatePaycheckInputs: (partial: Partial<PaycheckInputs>) => void
  updateStressInputs: (partial: Partial<StressScenarioInputs>) => void
  updateBudgetInputs: (partial: Partial<BudgetInputs>) => void
  updateBudgetCategory: (id: string, partial: Partial<{ label: string; amount: number }>) => void
  updateAllocationCategories: (categories: AllocationCategoryDef[]) => void
  setAccounts: (accounts: Account[]) => void
  addHolding: (accountId: string, holding: Omit<StockHolding, 'id'>) => void
  updateHolding: (accountId: string, holdingId: string, partial: Partial<StockHolding>) => void
  removeHolding: (accountId: string, holdingId: string) => void
  loadDemo: () => void
  resetAll: () => void
  importState: (state: AppState) => void
  completeOnboarding: () => void
  toggleLightMode: () => void
  getActiveScenario: () => Scenario
  importNetWorthFromXlsx: (buffer: ArrayBuffer) => Promise<void>
  loadNwTrackerSeed: () => void
  setNetWorthData: (lineItems: NetWorthLineItem[], snapshots: NetWorthSnapshot[]) => void
  addNetWorthSnapshot: (date: string, balances?: Record<string, number>) => void
  updateNetWorthSnapshot: (id: string, partial: Partial<Pick<NetWorthSnapshot, 'date' | 'balances'>>) => void
  removeNetWorthSnapshot: (id: string) => void
  updateNetWorthBalance: (snapshotId: string, lineItemId: string, value: number | null) => void
  addNetWorthLineItem: (item: Omit<NetWorthLineItem, 'id' | 'sortOrder'>) => void
  updateNetWorthLineItem: (id: string, partial: Partial<NetWorthLineItem>) => void
  removeNetWorthLineItem: (id: string) => void
  recordNetWorthFromAccounts: (date?: string) => void
  updateUiState: (partial: Partial<ScenarioUiState>) => void
  updateMarketData: (partial: Partial<UserProfile['marketData']>) => void
  refreshPrices: () => Promise<void>
  clearPriceCache: () => void
  addStockTransaction: (tx: Omit<StockTransaction, 'id'>) => void
  updateStockTransaction: (id: string, partial: Partial<StockTransaction>) => void
  removeStockTransaction: (id: string) => void
  // cash flow
  addCashFlow: (entry: Omit<CashFlowEntry, 'id'>) => void
  updateCashFlow: (id: string, partial: Partial<CashFlowEntry>) => void
  removeCashFlow: (id: string) => void
  // goals
  addGoal: (goal: Omit<FinancialGoal, 'id'>) => void
  updateGoal: (id: string, partial: Partial<FinancialGoal>) => void
  removeGoal: (id: string) => void
  // sinking funds
  addSinkingFund: (fund: Omit<SinkingFund, 'id'>) => void
  updateSinkingFund: (id: string, partial: Partial<SinkingFund>) => void
  removeSinkingFund: (id: string) => void
  // insurance
  addInsurance: (policy: Omit<InsurancePolicy, 'id'>) => void
  updateInsurance: (id: string, partial: Partial<InsurancePolicy>) => void
  removeInsurance: (id: string) => void
  // credit score
  addCreditScore: (entry: Omit<CreditScoreEntry, 'id'>) => void
  updateCreditScore: (id: string, partial: Partial<CreditScoreEntry>) => void
  removeCreditScore: (id: string) => void
  setNavItemEnabled: (id: NavItemId, enabled: boolean) => void
  // full backup/restore
  exportFullState: () => string
  importFullState: (raw: string) => void
}

const initialScenario = createScenario()

const initialState: AppState = {
  scenarios: [initialScenario],
  activeScenarioId: initialScenario.id,
  hasOnboarded: false,
  priceCache: {},
  disabledNavIds: [],
}

function migrateLegacyData(): AppState | null {
  try {
    const raw = localStorage.getItem('midnight-ledger')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.state?.scenarios || parsed.scenarios) return null

    const scenario = createDemoScenario()
    scenario.profile.name = parsed.state?.settings?.name ?? parsed.settings?.name ?? ''
    scenario.profile.currency = parsed.state?.settings?.currency ?? parsed.settings?.currency ?? 'USD'
    scenario.profile.lightMode = parsed.state?.settings?.lightMode ?? parsed.settings?.lightMode ?? false

    const snapshots = parsed.state?.snapshots ?? parsed.snapshots ?? []
    if (snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1]
      scenario.accounts = [
        ...latest.assets.map((a: { name: string; category: string; value: number }) =>
          createDefaultAccount({
            name: a.name,
            balance: a.value,
            accountType: a.category === 'cash' ? 'checking' : a.category === 'investments' ? 'brokerage' : 'custom',
            isLiability: false,
          })
        ),
        ...latest.liabilities.map((l: { name: string; value: number }) =>
          createDefaultAccount({ name: l.name, balance: l.value, accountType: 'loan', isLiability: true })
        ),
      ]
    }

    return { scenarios: [scenario], activeScenarioId: scenario.id, hasOnboarded: true, priceCache: {}, disabledNavIds: [] }
  } catch {
    return null
  }
}

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      getActiveScenario: () => {
        const { scenarios, activeScenarioId } = get()
        return scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0] ?? createScenario()
      },

      updateActiveScenario: (updater) =>
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === state.activeScenarioId ? updater(s) : s
          ),
        })),

      setActiveScenario: (id) => set({ activeScenarioId: id }),

      addScenario: (name) => {
        const scenario = createScenario(name ?? `Scenario ${get().scenarios.length + 1}`)
        set((s) => ({
          scenarios: [...s.scenarios, scenario],
          activeScenarioId: scenario.id,
        }))
      },

      duplicateScenario: (id) => {
        const source = get().scenarios.find((s) => s.id === id)
        if (!source) return
        const lineItemIdMap = new Map<string, string>()
        const newLineItems = (source.netWorthLineItems ?? []).map((item) => {
          const newId = createId()
          lineItemIdMap.set(item.id, newId)
          return { ...item, id: newId }
        })
        for (const item of newLineItems) {
          if (item.parentId) item.parentId = lineItemIdMap.get(item.parentId) ?? null
        }
        const copy: Scenario = {
          ...source,
          id: createId(),
          name: `${source.name} (copy)`,
          accounts: source.accounts.map((a) => ({ ...a, id: createId() })),
          netWorthLineItems: newLineItems,
          netWorthSnapshots: (source.netWorthSnapshots ?? []).map((snap) => ({
            ...snap,
            id: createId(),
            balances: Object.fromEntries(
              Object.entries(snap.balances).map(([key, value]) => [
                lineItemIdMap.get(key) ?? createId(),
                value,
              ])
            ),
          })),
        }
        set((s) => ({ scenarios: [...s.scenarios, copy], activeScenarioId: copy.id }))
      },

      deleteScenario: (id) =>
        set((s) => {
          if (s.scenarios.length <= 1) return s
          const next = s.scenarios.filter((sc) => sc.id !== id)
          return {
            scenarios: next,
            activeScenarioId: s.activeScenarioId === id ? next[0].id : s.activeScenarioId,
          }
        }),

      addAccount: (partial) =>
        get().updateActiveScenario((s) => ({
          ...s,
          accounts: [...s.accounts, createDefaultAccount(partial)],
        })),

      updateAccount: (id, partial) =>
        get().updateActiveScenario((s) => ({
          ...s,
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...partial } : a)),
        })),

      removeAccount: (id) =>
        get().updateActiveScenario((s) => ({
          ...s,
          accounts: s.accounts.filter((a) => a.id !== id),
        })),

      updateProfile: (partial) =>
        get().updateActiveScenario((s) => ({ ...s, profile: { ...s.profile, ...partial } })),

      updateAssumptions: (partial) =>
        get().updateActiveScenario((s) => ({ ...s, assumptions: { ...s.assumptions, ...partial } })),

      updateFireSettings: (partial) =>
        get().updateActiveScenario((s) => ({ ...s, fireSettings: { ...s.fireSettings, ...partial } })),

      updateTaxInputs: (partial) =>
        get().updateActiveScenario((s) => ({ ...s, taxInputs: { ...s.taxInputs, ...partial } })),

      updatePaycheckInputs: (partial) =>
        get().updateActiveScenario((s) => ({ ...s, paycheckInputs: { ...s.paycheckInputs, ...partial } })),

      updateStressInputs: (partial) =>
        get().updateActiveScenario((s) => ({ ...s, stressInputs: { ...s.stressInputs, ...partial } })),

      updateBudgetInputs: (partial) =>
        get().updateActiveScenario((s) => ({ ...s, budgetInputs: { ...s.budgetInputs, ...partial } })),

      updateBudgetCategory: (id, partial) =>
        get().updateActiveScenario((s) => ({
          ...s,
          budgetInputs: {
            ...s.budgetInputs,
            postTaxCategories: s.budgetInputs.postTaxCategories.map((c) =>
              c.id === id ? { ...c, ...partial } : c
            ),
          },
        })),

      updateAllocationCategories: (categories) =>
        get().updateActiveScenario((s) => ({ ...s, allocationCategories: categories })),

      setAccounts: (accounts) =>
        get().updateActiveScenario((s) => ({ ...s, accounts: accounts.map(migrateAccount) })),

      addHolding: (accountId, holding) =>
        get().updateActiveScenario((s) => ({
          ...s,
          accounts: s.accounts.map((a) =>
            a.id === accountId
              ? { ...a, holdings: [...(a.holdings ?? []), { ...holding, id: createId() }] }
              : a
          ),
        })),

      updateHolding: (accountId, holdingId, partial) =>
        get().updateActiveScenario((s) => ({
          ...s,
          accounts: s.accounts.map((a) =>
            a.id === accountId
              ? {
                  ...a,
                  holdings: (a.holdings ?? []).map((h) =>
                    h.id === holdingId ? { ...h, ...partial } : h
                  ),
                }
              : a
          ),
        })),

      removeHolding: (accountId, holdingId) =>
        get().updateActiveScenario((s) => ({
          ...s,
          accounts: s.accounts.map((a) =>
            a.id === accountId
              ? { ...a, holdings: (a.holdings ?? []).filter((h) => h.id !== holdingId) }
              : a
          ),
        })),

      loadDemo: () => {
        const demo = createDemoScenario()
        set({ scenarios: [demo], activeScenarioId: demo.id, hasOnboarded: true })
      },

      resetAll: () => {
        const fresh = createScenario()
        set({ scenarios: [fresh], activeScenarioId: fresh.id, hasOnboarded: false, disabledNavIds: [] })
      },

      importState: (state) =>
        set({
          ...state,
          priceCache: state.priceCache ?? {},
          disabledNavIds: state.disabledNavIds ?? [],
        }),

      completeOnboarding: () => set({ hasOnboarded: true }),

      toggleLightMode: () =>
        get().updateActiveScenario((s) => ({
          ...s,
          profile: { ...s.profile, lightMode: !s.profile.lightMode },
        })),

      loadNwTrackerSeed: () => {
        const scenario = createScenario('NW Tracker')
        const seed = buildNwTrackerSeed()
        scenario.netWorthLineItems = seed.lineItems
        scenario.netWorthSnapshots = seed.snapshots
        scenario.accounts = seed.accounts
        scenario.profile.marketData = { ...scenario.profile.marketData, livePricesEnabled: true, quoteProvider: 'yahoo' }
        set({ scenarios: [scenario], activeScenarioId: scenario.id, hasOnboarded: true })
      },

      importNetWorthFromXlsx: async (buffer) => {
        const { parseNwTrackerXlsx } = await import('../engine/networthXlsx')
        const { lineItems, snapshots } = await parseNwTrackerXlsx(buffer)
        get().updateActiveScenario((s) => ({
          ...s,
          netWorthLineItems: lineItems,
          netWorthSnapshots: snapshots,
        }))
      },

      setNetWorthData: (lineItems, snapshots) =>
        get().updateActiveScenario((s) => ({
          ...s,
          netWorthLineItems: lineItems,
          netWorthSnapshots: snapshots,
        })),

      addNetWorthSnapshot: (date, balances) =>
        get().updateActiveScenario((s) => {
          const existing = s.netWorthSnapshots.find((snap) => snap.date === date)
          if (existing) {
            return {
              ...s,
              netWorthSnapshots: s.netWorthSnapshots.map((snap) =>
                snap.id === existing.id
                  ? { ...snap, balances: balances ?? snap.balances }
                  : snap
              ),
            }
          }
          const latest = [...s.netWorthSnapshots].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
          return {
            ...s,
            netWorthSnapshots: [
              ...s.netWorthSnapshots,
              {
                id: createId(),
                date,
                balances: balances ?? latest?.balances ?? {},
              },
            ],
          }
        }),

      updateNetWorthSnapshot: (id, partial) =>
        get().updateActiveScenario((s) => ({
          ...s,
          netWorthSnapshots: s.netWorthSnapshots.map((snap) =>
            snap.id === id ? { ...snap, ...partial } : snap
          ),
        })),

      removeNetWorthSnapshot: (id) =>
        get().updateActiveScenario((s) => ({
          ...s,
          netWorthSnapshots: s.netWorthSnapshots.filter((snap) => snap.id !== id),
        })),

      updateNetWorthBalance: (snapshotId, lineItemId, value) =>
        get().updateActiveScenario((s) => ({
          ...s,
          netWorthSnapshots: s.netWorthSnapshots.map((snap) => {
            if (snap.id !== snapshotId) return snap
            const balances = { ...snap.balances }
            if (value == null || Number.isNaN(value)) delete balances[lineItemId]
            else balances[lineItemId] = value
            return { ...snap, balances }
          }),
        })),

      addNetWorthLineItem: (item) =>
        get().updateActiveScenario((s) => ({
          ...s,
          netWorthLineItems: [
            ...s.netWorthLineItems,
            {
              ...item,
              id: createId(),
              sortOrder: s.netWorthLineItems.length,
            },
          ],
        })),

      updateNetWorthLineItem: (id, partial) =>
        get().updateActiveScenario((s) => ({
          ...s,
          netWorthLineItems: s.netWorthLineItems.map((item) =>
            item.id === id ? { ...item, ...partial } : item
          ),
        })),

      removeNetWorthLineItem: (id) =>
        get().updateActiveScenario((s) => ({
          ...s,
          netWorthLineItems: s.netWorthLineItems.filter((item) => item.id !== id),
          netWorthSnapshots: s.netWorthSnapshots.map((snap) => {
            const balances = { ...snap.balances }
            delete balances[id]
            return { ...snap, balances }
          }),
        })),

      recordNetWorthFromAccounts: (date) => {
        const scenario = get().getActiveScenario()
        const snapshotDate = date ?? new Date().toISOString().slice(0, 10)
        const lineItems =
          scenario.netWorthLineItems.length > 0
            ? [...scenario.netWorthLineItems]
            : buildLineItemsFromAccounts(scenario.accounts)
        const { balances, lineItems: updatedLineItems } = mapAccountsToSnapshotBalances(
          scenario.accounts,
          lineItems
        )
        get().updateActiveScenario((s) => ({
          ...s,
          netWorthLineItems: updatedLineItems,
          netWorthSnapshots: (() => {
            const existing = s.netWorthSnapshots.find((snap) => snap.date === snapshotDate)
            if (existing) {
              return s.netWorthSnapshots.map((snap) =>
                snap.id === existing.id ? { ...snap, balances } : snap
              )
            }
            return [...s.netWorthSnapshots, { id: createId(), date: snapshotDate, balances }]
          })(),
        }))
      },

      updateUiState: (partial) =>
        get().updateActiveScenario((s) => ({
          ...s,
          uiState: { ...defaultUiState(), ...s.uiState, ...partial },
        })),

      updateMarketData: (partial) =>
        get().updateActiveScenario((s) => ({
          ...s,
          profile: {
            ...s.profile,
            marketData: { ...defaultMarketData(), ...s.profile.marketData, ...partial },
          },
        })),

      refreshPrices: async () => {
        const scenario = get().getActiveScenario()
        const { marketData } = scenario.profile
        if (!marketData.livePricesEnabled) return

        const tickers = [
          ...new Set(
            scenario.accounts.flatMap((a) =>
              (a.holdings ?? []).map((h) => h.ticker.trim().toUpperCase()).filter(Boolean)
            )
          ),
        ]
        if (tickers.length === 0) return

        try {
          const quotes = await fetchQuotes(marketData.quoteProvider, tickers, {
            alphaVantageKey: marketData.alphaVantageKey,
            finnhubKey: marketData.finnhubKey,
          })
          set((state) => ({
            priceCache: Object.fromEntries(
              Object.entries({ ...state.priceCache, ...quotes }).filter(([key]) => tickers.includes(key))
            ),
          }))
          get().updateMarketData({ lastPriceRefresh: new Date().toISOString() })
        } catch {
          // degrade silently — manual prices remain
        }
      },

      clearPriceCache: () => set({ priceCache: {} }),

      addStockTransaction: (tx) => {
        const txn: StockTransaction = { ...tx, id: createId(), ticker: tx.ticker.trim().toUpperCase() }
        get().updateActiveScenario((s) => {
          const nextTxs = [...(s.stockTransactions ?? []), txn]
          const nextAccounts = applyTransactionToAccounts(s.accounts, txn)
          return { ...s, stockTransactions: nextTxs, accounts: nextAccounts }
        })
      },

      updateStockTransaction: (id, partial) =>
        get().updateActiveScenario((s) => ({
          ...s,
          stockTransactions: (s.stockTransactions ?? []).map((t) =>
            t.id === id ? { ...t, ...partial, ticker: (partial.ticker ?? t.ticker).trim().toUpperCase() } : t
          ),
        })),

      removeStockTransaction: (id) =>
        get().updateActiveScenario((s) => ({
          ...s,
          stockTransactions: (s.stockTransactions ?? []).filter((t) => t.id !== id),
        })),

      addCashFlow: (entry) =>
        get().updateActiveScenario((s) => ({
          ...s,
          cashFlowEntries: [...(s.cashFlowEntries ?? []), { ...entry, id: createId() }],
        })),
      updateCashFlow: (id, partial) =>
        get().updateActiveScenario((s) => ({
          ...s,
          cashFlowEntries: (s.cashFlowEntries ?? []).map((e) => (e.id === id ? { ...e, ...partial } : e)),
        })),
      removeCashFlow: (id) =>
        get().updateActiveScenario((s) => ({
          ...s,
          cashFlowEntries: (s.cashFlowEntries ?? []).filter((e) => e.id !== id),
        })),

      addGoal: (goal) =>
        get().updateActiveScenario((s) => ({
          ...s,
          goals: [...(s.goals ?? []), { ...goal, id: createId() }],
        })),
      updateGoal: (id, partial) =>
        get().updateActiveScenario((s) => ({
          ...s,
          goals: (s.goals ?? []).map((g) => (g.id === id ? { ...g, ...partial } : g)),
        })),
      removeGoal: (id) =>
        get().updateActiveScenario((s) => ({
          ...s,
          goals: (s.goals ?? []).filter((g) => g.id !== id),
        })),

      addSinkingFund: (fund) =>
        get().updateActiveScenario((s) => ({
          ...s,
          sinkingFunds: [...(s.sinkingFunds ?? []), { ...fund, id: createId() }],
        })),
      updateSinkingFund: (id, partial) =>
        get().updateActiveScenario((s) => ({
          ...s,
          sinkingFunds: (s.sinkingFunds ?? []).map((f) => (f.id === id ? { ...f, ...partial } : f)),
        })),
      removeSinkingFund: (id) =>
        get().updateActiveScenario((s) => ({
          ...s,
          sinkingFunds: (s.sinkingFunds ?? []).filter((f) => f.id !== id),
        })),

      addInsurance: (policy) =>
        get().updateActiveScenario((s) => ({
          ...s,
          insurancePolicies: [...(s.insurancePolicies ?? []), { ...policy, id: createId() }],
        })),
      updateInsurance: (id, partial) =>
        get().updateActiveScenario((s) => ({
          ...s,
          insurancePolicies: (s.insurancePolicies ?? []).map((p) => (p.id === id ? { ...p, ...partial } : p)),
        })),
      removeInsurance: (id) =>
        get().updateActiveScenario((s) => ({
          ...s,
          insurancePolicies: (s.insurancePolicies ?? []).filter((p) => p.id !== id),
        })),

      addCreditScore: (entry) =>
        get().updateActiveScenario((s) => ({
          ...s,
          creditScoreHistory: [...(s.creditScoreHistory ?? []), { ...entry, id: createId() }],
        })),
      updateCreditScore: (id, partial) =>
        get().updateActiveScenario((s) => ({
          ...s,
          creditScoreHistory: (s.creditScoreHistory ?? []).map((c) => (c.id === id ? { ...c, ...partial } : c)),
        })),
      removeCreditScore: (id) =>
        get().updateActiveScenario((s) => ({
          ...s,
          creditScoreHistory: (s.creditScoreHistory ?? []).filter((c) => c.id !== id),
        })),

      setNavItemEnabled: (id, enabled) =>
        set((s) => {
          const has = s.disabledNavIds.includes(id)
          if (enabled && has) {
            return { disabledNavIds: s.disabledNavIds.filter((x) => x !== id) }
          }
          if (!enabled && !has) {
            return { disabledNavIds: [...s.disabledNavIds, id] }
          }
          return s
        }),

      exportFullState: () => {
        const { scenarios, activeScenarioId, hasOnboarded, priceCache, disabledNavIds } = get()
        return JSON.stringify({ scenarios, activeScenarioId, hasOnboarded, priceCache, disabledNavIds }, null, 2)
      },
      importFullState: (raw) => {
        const parsed = JSON.parse(raw) as AppState
        if (!Array.isArray(parsed.scenarios)) throw new Error('Invalid backup: scenarios missing')
        set({
          scenarios: parsed.scenarios.map(migrateScenario),
          activeScenarioId: parsed.activeScenarioId ?? parsed.scenarios[0].id,
          hasOnboarded: parsed.hasOnboarded ?? true,
          priceCache: parsed.priceCache ?? {},
          disabledNavIds: parsed.disabledNavIds ?? [],
        })
      },
    }),
    {
      name: 'midnight-ledger-v3',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.scenarios = state.scenarios.map(migrateScenario)
          state.priceCache = state.priceCache ?? {}
          state.disabledNavIds = state.disabledNavIds ?? []
        }
        if (state && state.scenarios.length === 0) {
          const migrated = migrateLegacyData()
          if (migrated) state.importState(migrated)
        }
      },
      partialize: (state) => ({
        scenarios: state.scenarios,
        activeScenarioId: state.activeScenarioId,
        hasOnboarded: state.hasOnboarded,
        priceCache: state.priceCache,
        disabledNavIds: state.disabledNavIds,
      }),
    }
  )
)

export function exportAppState(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

export function parseAppState(raw: string): AppState {
  const parsed = JSON.parse(raw) as AppState
  if (!Array.isArray(parsed.scenarios)) throw new Error('Invalid export file')
  return parsed
}

/* Optional Supabase backend abstraction — plug in later */
export interface FinanceBackend {
  save: (state: AppState) => Promise<void>
  load: () => Promise<AppState | null>
}

export const localBackend: FinanceBackend = {
  save: async (state) => {
    localStorage.setItem('midnight-ledger-v3', JSON.stringify({ state }))
  },
  load: async () => {
    const raw = localStorage.getItem('midnight-ledger-v3')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.state ?? parsed
  },
}
