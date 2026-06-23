import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Account,
  AllocationCategoryDef,
  AppState,
  BudgetInputs,
  NetWorthLineItem,
  NetWorthSnapshot,
  PaycheckInputs,
  ProjectionAssumptions,
  FireSettings,
  Scenario,
  ScenarioUiState,
  StockHolding,
  StressScenarioInputs,
  TaxSimulatorInputs,
  UserProfile,
} from '../types'
import { DEFAULT_ALLOCATION_CATEGORIES, DEFAULT_BUDGET_CATEGORIES } from '../types'
import { createDefaultAccount } from '../engine/accounts'
import { createId } from '../engine/format'

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
      { id: createId(), ticker: 'VTI', shares: 50, pricePerShare: 240 },
      { id: createId(), ticker: 'AAPL', shares: 20, pricePerShare: 190 },
    ], syncBalanceFromHoldings: true }),
    createDefaultAccount({ name: 'HYSA', accountType: 'hysa', balance: 15000, monthlyContribution: 400 }),
    createDefaultAccount({ name: 'Checking', accountType: 'checking', balance: 5000, monthlyContribution: 0 }),
    createDefaultAccount({ name: 'Car Loan', accountType: 'loan', balance: 8500, isLiability: true, interestRate: 6.5, loanTermMonths: 36, monthlyContribution: 250 }),
  ]
  return scenario
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
}

const initialScenario = createScenario()

const initialState: AppState = {
  scenarios: [initialScenario],
  activeScenarioId: initialScenario.id,
  hasOnboarded: false,
  priceCache: {},
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

    return { scenarios: [scenario], activeScenarioId: scenario.id, hasOnboarded: true, priceCache: {} }
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
        set({ scenarios: [fresh], activeScenarioId: fresh.id, hasOnboarded: false })
      },

      importState: (state) => set({ ...state }),

      completeOnboarding: () => set({ hasOnboarded: true }),

      toggleLightMode: () =>
        get().updateActiveScenario((s) => ({
          ...s,
          profile: { ...s.profile, lightMode: !s.profile.lightMode },
        })),

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
    }),
    {
      name: 'midnight-ledger-v3',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.scenarios = state.scenarios.map(migrateScenario)
          state.priceCache = state.priceCache ?? {}
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
