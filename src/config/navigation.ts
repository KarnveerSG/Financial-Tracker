export type NavItemId =
  | 'dashboard'
  | 'net-worth'
  | 'accounts'
  | 'transactions'
  | 'cash-flow'
  | 'goals'
  | 'projections'
  | 'mortgage'
  | 'debt-payoff'
  | 'credit'
  | 'insurance'
  | 'fire'
  | 'retirement'
  | 'tax'
  | 'tax-loss-harvest'
  | 'paycheck'
  | 'budget'
  | 'analytics'
  | 'compare'
  | 'settings'

export interface NavItem {
  id: NavItemId
  to: string
  label: string
  icon: string
  /** Always visible in nav; cannot be disabled in settings */
  required?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', to: '/dashboard', label: 'Dashboard', icon: '◈', required: true },
  { id: 'net-worth', to: '/net-worth', label: 'Net Worth', icon: '◆' },
  { id: 'accounts', to: '/accounts', label: 'Accounts', icon: '▤' },
  { id: 'transactions', to: '/transactions', label: 'Transactions', icon: '⇄' },
  { id: 'cash-flow', to: '/cash-flow', label: 'Cash Flow', icon: '≈' },
  { id: 'goals', to: '/goals', label: 'Goals & Funds', icon: '★' },
  { id: 'projections', to: '/projections', label: 'Projections', icon: '↗' },
  { id: 'mortgage', to: '/mortgage', label: 'Mortgage', icon: '⌂' },
  { id: 'debt-payoff', to: '/debt-payoff', label: 'Debt Payoff', icon: '⇢' },
  { id: 'credit', to: '/credit', label: 'Credit', icon: '◔' },
  { id: 'insurance', to: '/insurance', label: 'Insurance', icon: '⛨' },
  { id: 'fire', to: '/fire', label: 'FIRE & CoastFI', icon: '◎' },
  { id: 'retirement', to: '/retirement', label: 'Retirement Toolkit', icon: '⚭' },
  { id: 'tax', to: '/tax', label: 'Tax Planning', icon: '◫' },
  { id: 'tax-loss-harvest', to: '/tax-loss-harvest', label: 'Tax-Loss Harvest', icon: '▼' },
  { id: 'paycheck', to: '/paycheck', label: 'Paycheck', icon: '◧' },
  { id: 'budget', to: '/budget', label: 'Budget', icon: '◨' },
  { id: 'analytics', to: '/analytics', label: 'Analytics', icon: '◉' },
  { id: 'compare', to: '/analytics/compare', label: 'Compare', icon: '⇋' },
  { id: 'settings', to: '/settings', label: 'Settings', icon: '⚙', required: true },
]

const NAV_BY_PATH = new Map(NAV_ITEMS.map((item) => [item.to, item]))

export function navItemForPath(path: string): NavItem | undefined {
  return NAV_BY_PATH.get(path)
}

export function isNavItemEnabled(disabledNavIds: string[] | undefined, id: NavItemId): boolean {
  const item = NAV_ITEMS.find((n) => n.id === id)
  if (item?.required) return true
  return !disabledNavIds?.includes(id)
}

export function getVisibleNavItems(disabledNavIds: string[] | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => item.required || isNavItemEnabled(disabledNavIds, item.id))
}

export function getToggleableNavItems(): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.required)
}
