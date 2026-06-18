interface MetricCardProps {
  label: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
}

export function MetricCard({ label, value, sub, trend }: MetricCardProps) {
  const trendColor =
    trend === 'up' ? 'text-ledger-success' : trend === 'down' ? 'text-ledger-danger' : 'text-ledger-muted'

  return (
    <div className="card flex flex-col gap-1">
      <p className="text-xs uppercase tracking-wider text-ledger-muted">{label}</p>
      <p className="font-serif text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className={`text-xs tabular-nums ${trendColor}`}>{sub}</p>}
    </div>
  )
}

export function ProgressGauge({
  label,
  percent,
  detail,
  color = '#c9a962',
}: {
  label: string
  percent: number
  detail?: string
  color?: string
}) {
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <div className="card">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-ledger-muted">{label}</p>
          <p className="mt-1 font-serif text-3xl font-semibold tabular-nums">{clamped.toFixed(1)}%</p>
          {detail && <p className="mt-1 text-sm text-ledger-muted">{detail}</p>}
        </div>
        <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden>
          <circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" className="text-ledger-border" strokeWidth="8" />
          <circle
            cx="40"
            cy="40"
            r="32"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(clamped / 100) * 201} 201`}
            transform="rotate(-90 40 40)"
          />
        </svg>
      </div>
    </div>
  )
}

export function SectionCard({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

export function InputRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}
