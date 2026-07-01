import { useEffect, useState, lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { OnboardingPage } from './pages/OnboardingPage'
import { DashboardPage } from './pages/DashboardPage'
import { NetWorthPage } from './pages/NetWorthPage'
import { AccountsPage } from './pages/AccountsPage'
import { FirePage } from './pages/FirePage'
import { TaxPage } from './pages/TaxPage'
import { PaycheckPage } from './pages/PaycheckPage'
import { BudgetPage } from './pages/BudgetPage'
import { SettingsPage } from './pages/SettingsPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { MortgagePage } from './pages/MortgagePage'
import { DebtPayoffPage } from './pages/DebtPayoffPage'
import { CashFlowPage } from './pages/CashFlowPage'
import { GoalsPage } from './pages/GoalsPage'
import { InsurancePage } from './pages/InsurancePage'
import { CreditPage } from './pages/CreditPage'
import { TaxLossHarvestPage } from './pages/TaxLossHarvestPage'
import { RetirementPage } from './pages/RetirementPage'
import { useFinanceStore } from './store/useFinanceStore'
import { isElectronFile } from './lib/isElectron'
import { isNavItemEnabled, navItemForPath } from './config/navigation'

const ProjectionsPage = lazy(() =>
  import('./pages/ProjectionsPage').then((m) => ({ default: m.ProjectionsPage }))
)
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage }))
)
const CompareScenariosPage = lazy(() =>
  import('./pages/CompareScenariosPage').then((m) => ({ default: m.CompareScenariosPage }))
)

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-ledger-muted">
      Loading…
    </div>
  )
}

const AppRouter = isElectronFile ? HashRouter : BrowserRouter

function PersistGate({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(() => useFinanceStore.persist.hasHydrated())

  useEffect(() => {
    if (useFinanceStore.persist.hasHydrated()) {
      setHydrated(true)
      return
    }
    const unsub = useFinanceStore.persist.onFinishHydration(() => setHydrated(true))
    const timer = window.setTimeout(() => setHydrated(true), 1500)
    return () => {
      unsub()
      window.clearTimeout(timer)
    }
  }, [])

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ledger-bg text-ledger-muted">
        Loading…
      </div>
    )
  }

  return children
}

function AutoPriceRefresh() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const refreshPrices = useFinanceStore((s) => s.refreshPrices)

  useEffect(() => {
    const md = scenario.profile.marketData
    if (!md.livePricesEnabled) return
    const last = md.lastPriceRefresh ? new Date(md.lastPriceRefresh).getTime() : 0
    const age = Date.now() - last
    if (age > 12 * 60 * 60 * 1000) {
      void refreshPrices()
    }
  }, [scenario.profile.marketData, refreshPrices])

  return null
}

function ThemeSync() {
  const lightMode = useFinanceStore((s) => {
    const scenario = s.scenarios.find((x) => x.id === s.activeScenarioId) ?? s.scenarios[0]
    return scenario?.profile.lightMode ?? false
  })

  useEffect(() => {
    const root = document.documentElement
    if (lightMode) {
      root.classList.remove('dark')
      root.classList.add('light')
    } else {
      root.classList.remove('light')
      root.classList.add('dark')
    }
  }, [lightMode])

  return null
}

function Protected({ children }: { children: React.ReactNode }) {
  const hasOnboarded = useFinanceStore((s) => s.hasOnboarded)
  if (!hasOnboarded) return <Navigate to="/" replace />
  return <AppLayout>{children}</AppLayout>
}

function NavGuard({ path, children }: { path: string; children: React.ReactNode }) {
  const disabledNavIds = useFinanceStore((s) => s.disabledNavIds)
  const item = navItemForPath(path)
  if (item && !isNavItemEnabled(disabledNavIds, item.id)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function GuardedRoute({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <Protected>
      <NavGuard path={path}>{children}</NavGuard>
    </Protected>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<OnboardingPage />} />
      <Route path="/dashboard" element={<GuardedRoute path="/dashboard"><DashboardPage /></GuardedRoute>} />
      <Route path="/net-worth" element={<GuardedRoute path="/net-worth"><NetWorthPage /></GuardedRoute>} />
      <Route path="/accounts" element={<GuardedRoute path="/accounts"><AccountsPage /></GuardedRoute>} />
      <Route path="/projections" element={<GuardedRoute path="/projections"><Suspense fallback={<RouteFallback />}><ProjectionsPage /></Suspense></GuardedRoute>} />
      <Route path="/fire" element={<GuardedRoute path="/fire"><FirePage /></GuardedRoute>} />
      <Route path="/tax" element={<GuardedRoute path="/tax"><TaxPage /></GuardedRoute>} />
      <Route path="/paycheck" element={<GuardedRoute path="/paycheck"><PaycheckPage /></GuardedRoute>} />
      <Route path="/budget" element={<GuardedRoute path="/budget"><BudgetPage /></GuardedRoute>} />
      <Route path="/transactions" element={<GuardedRoute path="/transactions"><TransactionsPage /></GuardedRoute>} />
      <Route path="/mortgage" element={<GuardedRoute path="/mortgage"><MortgagePage /></GuardedRoute>} />
      <Route path="/debt-payoff" element={<GuardedRoute path="/debt-payoff"><DebtPayoffPage /></GuardedRoute>} />
      <Route path="/cash-flow" element={<GuardedRoute path="/cash-flow"><CashFlowPage /></GuardedRoute>} />
      <Route path="/goals" element={<GuardedRoute path="/goals"><GoalsPage /></GuardedRoute>} />
      <Route path="/insurance" element={<GuardedRoute path="/insurance"><InsurancePage /></GuardedRoute>} />
      <Route path="/credit" element={<GuardedRoute path="/credit"><CreditPage /></GuardedRoute>} />
      <Route path="/tax-loss-harvest" element={<GuardedRoute path="/tax-loss-harvest"><TaxLossHarvestPage /></GuardedRoute>} />
      <Route path="/retirement" element={<GuardedRoute path="/retirement"><RetirementPage /></GuardedRoute>} />
      <Route path="/analytics" element={<GuardedRoute path="/analytics"><Suspense fallback={<RouteFallback />}><AnalyticsPage /></Suspense></GuardedRoute>} />
      <Route path="/analytics/compare" element={<GuardedRoute path="/analytics/compare"><Suspense fallback={<RouteFallback />}><CompareScenariosPage /></Suspense></GuardedRoute>} />
      <Route path="/settings" element={<GuardedRoute path="/settings"><SettingsPage /></GuardedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <PersistGate>
      <AppRouter>
        <ThemeSync />
        <AutoPriceRefresh />
        <AppRoutes />
      </AppRouter>
    </PersistGate>
  )
}

export default App
