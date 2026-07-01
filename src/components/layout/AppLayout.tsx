import { NavLink } from 'react-router-dom'
import { getVisibleNavItems } from '../../config/navigation'
import { useFinanceStore } from '../../store/useFinanceStore'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { getActiveScenario, toggleLightMode, disabledNavIds } = useFinanceStore()
  const scenario = getActiveScenario()
  const navItems = getVisibleNavItems(disabledNavIds)

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="no-print border-b border-ledger-border bg-ledger-surface lg:fixed lg:inset-y-0 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-5 lg:px-6">
          <div>
            <p className="font-serif text-xl font-semibold">Midnight Ledger</p>
            <p className="text-xs text-ledger-muted">{scenario.name}</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-6">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors lg:px-4 ${
                  isActive
                    ? 'bg-ledger-gold/15 font-medium text-ledger-gold'
                    : 'text-ledger-muted hover:bg-ledger-elevated hover:text-ledger-text'
                }`
              }
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <button
        type="button"
        onClick={toggleLightMode}
        className="fixed bottom-4 left-4 z-50 btn-ghost rounded-xl border border-ledger-border bg-ledger-surface/95 px-3 py-2 text-sm shadow-lg backdrop-blur-sm bottom-20 lg:bottom-4"
        aria-label="Toggle theme"
      >
        {scenario.profile.lightMode ? '◐ Dark mode' : '◑ Light mode'}
      </button>

      <div className="flex-1 lg:pl-64">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <footer className="px-6 pb-6 text-center text-xs text-ledger-muted">
          Calculations are estimates · Data stored locally in your browser
        </footer>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-ledger-muted">{subtitle}</p>}
    </div>
  )
}
