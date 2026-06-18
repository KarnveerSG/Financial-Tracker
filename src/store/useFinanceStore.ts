import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Account,
  AllocationCategoryDef,
  AppState,
  PaycheckInputs,
  ProjectionAssumptions,
  FireSettings,
  Scenario,
  StressScenarioInputs,
  TaxSimulatorInputs,
  UserProfile,
} from '../types'
import { DEFAULT_ALLOCATION_CATEGORIES } from '../types'
import { createDefaultAccount } from '../engine/accounts'
import { createId } from '../engine/format'

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
  }
}

function defaultAssumptions(): ProjectionAssumptions {
  return {
    inflationRate: 3,
    annualReturnRate: 7,
    returnStdDev: 15,
    salaryGrowthRate: 3,
    contributionGrowthRate: 3,
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
    accounts: [],
    profile: defaultProfile(),
    assumptions: defaultAssumptions(),
    fireSettings: defaultFireSettings(),
    taxInputs: defaultTaxInputs(),
    paycheckInputs: defaultPaycheckInputs(),
    stressInputs: defaultStressInputs(),
    allocationCategories: [...DEFAULT_ALLOCATION_CATEGORIES],
    savingsHistory: [],
  }
}

function createDemoScenario(): Scenario {
  const scenario = createScenario('Demo Portfolio')
  scenario.profile.name = 'Alex'
  scenario.profile.currentAge = 34
  scenario.accounts = [
    createDefaultAccount({ name: '401(k)', accountType: '401k', balance: 85000, monthlyContribution: 1500, employerMatchPercent: 50 }),
    createDefaultAccount({ name: 'Roth IRA', accountType: 'roth_ira', balance: 42000, monthlyContribution: 500 }),
    createDefaultAccount({ name: 'Brokerage', accountType: 'brokerage', balance: 28000, monthlyContribution: 800 }),
    createDefaultAccount({ name: 'HYSA', accountType: 'hysa', balance: 15000, monthlyContribution: 400 }),
    createDefaultAccount({ name: 'Checking', accountType: 'checking', balance: 5000, monthlyContribution: 0 }),
    createDefaultAccount({ name: 'Car Loan', accountType: 'loan', balance: 8500, isLiability: true }),
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
  updateAllocationCategories: (categories: AllocationCategoryDef[]) => void
  setAccounts: (accounts: Account[]) => void
  loadDemo: () => void
  resetAll: () => void
  importState: (state: AppState) => void
  completeOnboarding: () => void
  toggleLightMode: () => void
  getActiveScenario: () => Scenario
}

const initialScenario = createScenario()

const initialState: AppState = {
  scenarios: [initialScenario],
  activeScenarioId: initialScenario.id,
  hasOnboarded: false,
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

    return { scenarios: [scenario], activeScenarioId: scenario.id, hasOnboarded: true }
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
        return scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0]
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
        const copy = { ...source, id: createId(), name: `${source.name} (copy)`, accounts: source.accounts.map((a) => ({ ...a, id: createId() })) }
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

      updateAllocationCategories: (categories) =>
        get().updateActiveScenario((s) => ({ ...s, allocationCategories: categories })),

      setAccounts: (accounts) =>
        get().updateActiveScenario((s) => ({ ...s, accounts })),

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
    }),
    {
      name: 'midnight-ledger-v2',
      onRehydrateStorage: () => (state) => {
        if (state && state.scenarios.length === 0) {
          const migrated = migrateLegacyData()
          if (migrated) state.importState(migrated)
        }
      },
      partialize: (state) => ({
        scenarios: state.scenarios,
        activeScenarioId: state.activeScenarioId,
        hasOnboarded: state.hasOnboarded,
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
    localStorage.setItem('midnight-ledger-v2', JSON.stringify({ state }))
  },
  load: async () => {
    const raw = localStorage.getItem('midnight-ledger-v2')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.state ?? parsed
  },
}
