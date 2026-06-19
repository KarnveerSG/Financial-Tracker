import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { OnboardingPage } from './pages/OnboardingPage'
import { DashboardPage } from './pages/DashboardPage'
import { AccountsPage } from './pages/AccountsPage'
import { ProjectionsPage } from './pages/ProjectionsPage'
import { FirePage } from './pages/FirePage'
import { TaxPage } from './pages/TaxPage'
import { PaycheckPage } from './pages/PaycheckPage'
import { BudgetPage } from './pages/BudgetPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'
import { useFinanceStore } from './store/useFinanceStore'
import { isElectronFile } from './lib/isElectron'

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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<OnboardingPage />} />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/accounts" element={<Protected><AccountsPage /></Protected>} />
      <Route path="/projections" element={<Protected><ProjectionsPage /></Protected>} />
      <Route path="/fire" element={<Protected><FirePage /></Protected>} />
      <Route path="/tax" element={<Protected><TaxPage /></Protected>} />
      <Route path="/paycheck" element={<Protected><PaycheckPage /></Protected>} />
      <Route path="/budget" element={<Protected><BudgetPage /></Protected>} />
      <Route path="/analytics" element={<Protected><AnalyticsPage /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <PersistGate>
      <AppRouter>
        <ThemeSync />
        <AppRoutes />
      </AppRouter>
    </PersistGate>
  )
}

export default App
