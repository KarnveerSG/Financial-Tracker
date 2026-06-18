import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { OnboardingPage } from './pages/OnboardingPage'
import { DashboardPage } from './pages/DashboardPage'
import { AccountsPage } from './pages/AccountsPage'
import { ProjectionsPage } from './pages/ProjectionsPage'
import { FirePage } from './pages/FirePage'
import { TaxPage } from './pages/TaxPage'
import { PaycheckPage } from './pages/PaycheckPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'
import { useFinanceStore } from './store/useFinanceStore'

function ThemeSync() {
  const lightMode = useFinanceStore((s) => s.getActiveScenario().profile.lightMode)

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

function ProtectedLayout() {
  const hasOnboarded = useFinanceStore((s) => s.hasOnboarded)
  if (!hasOnboarded) return <Navigate to="/" replace />
  return <AppLayout />
}

function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <Routes>
        <Route path="/" element={<OnboardingPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/projections" element={<ProjectionsPage />} />
          <Route path="/fire" element={<FirePage />} />
          <Route path="/tax" element={<TaxPage />} />
          <Route path="/paycheck" element={<PaycheckPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
