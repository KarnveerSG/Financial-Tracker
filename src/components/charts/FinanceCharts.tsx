import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts'
import { formatCurrency } from '../../engine/format'
import type { Currency } from '../../types'

const tooltipStyle = {
  contentStyle: {
    background: '#1a2332',
    border: '1px solid #2d3a4f',
    borderRadius: '12px',
    fontSize: '12px',
  },
}

export function AllocationPieChart({
  data,
  currency = 'USD',
}: {
  data: { label: string; value: number; color: string }[]
  currency?: Currency
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ledger-muted">
        Add accounts to see allocation
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell key={entry.label} fill={entry.color} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip
          {...tooltipStyle}
          formatter={(value: number) => formatCurrency(value, currency)}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function MonteCarloFanChart({
  data,
  currency = 'USD',
  showReal = false,
}: {
  data: { age: number; median: number; best: number; worst: number; medianReal: number; bestReal: number; worstReal: number }[]
  currency?: Currency
  showReal?: boolean
}) {
  const keyMedian = showReal ? 'medianReal' : 'median'
  const keyBest = showReal ? 'bestReal' : 'best'
  const keyWorst = showReal ? 'worstReal' : 'worst'

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
        <XAxis dataKey="age" tick={{ fill: '#9aa5b8', fontSize: 11 }} />
        <YAxis
          tick={{ fill: '#9aa5b8', fontSize: 11 }}
          tickFormatter={(v) => formatCurrency(v, currency)}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: number) => formatCurrency(value, currency)}
          labelFormatter={(age) => `Age ${age}`}
        />
        <Area type="monotone" dataKey={keyBest} stroke="none" fill="#7d9b8a" fillOpacity={0.15} />
        <Area type="monotone" dataKey={keyMedian} stroke="#c9a962" fill="#c9a962" fillOpacity={0.1} strokeWidth={2} />
        <Area type="monotone" dataKey={keyWorst} stroke="none" fill="#c96b6b" fillOpacity={0.1} />
        <Line type="monotone" dataKey={keyBest} stroke="#7d9b8a" dot={false} strokeWidth={1} strokeDasharray="4 4" />
        <Line type="monotone" dataKey={keyWorst} stroke="#c96b6b" dot={false} strokeWidth={1} strokeDasharray="4 4" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function LineTrendChart<T extends object>({
  data,
  xKey,
  lines,
  currency = 'USD',
}: {
  data: T[]
  xKey: keyof T & string
  lines: { key: keyof T & string; color: string; label: string }[]
  currency?: Currency
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
        <XAxis dataKey={xKey} tick={{ fill: '#9aa5b8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9aa5b8', fontSize: 11 }} tickFormatter={(v) => formatCurrency(Number(v), currency)} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => formatCurrency(v, currency)} />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        {lines.map((l) => (
          <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} name={l.label} dot={false} strokeWidth={2} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function BarBreakdownChart({
  data,
  currency = 'USD',
}: {
  data: { name: string; value: number; color: string }[]
  currency?: Currency
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#9aa5b8', fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} />
        <YAxis type="category" dataKey="name" tick={{ fill: '#9aa5b8', fontSize: 11 }} width={100} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => formatCurrency(v, currency)} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TaxBracketChart({
  data,
  currency = 'USD',
}: {
  data: { bracket: string; amount: number; tax: number }[]
  currency?: Currency
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
        <XAxis dataKey="bracket" tick={{ fill: '#9aa5b8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9aa5b8', fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => formatCurrency(v, currency)} />
        <Bar dataKey="tax" fill="#6b8fbf" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function WaterfallChart({
  data,
  currency = 'USD',
}: {
  data: { name: string; value: number }[]
  currency?: Currency
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
        <XAxis dataKey="name" tick={{ fill: '#9aa5b8', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9aa5b8', fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => formatCurrency(v, currency)} />
        <Bar dataKey="value" fill="#c9a962" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function SankeyFlow({
  gross,
  taxes,
  net,
  currency = 'USD',
}: {
  gross: number
  taxes: number
  net: number
  currency?: Currency
}) {
  const items = [
    { label: 'Gross Income', value: gross, color: '#c9a962' },
    { label: 'Taxes', value: taxes, color: '#c96b6b' },
    { label: 'Net Spendable', value: net, color: '#7d9b8a' },
  ]

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{item.label}</span>
            <span className="tabular-nums">{formatCurrency(item.value, currency)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-ledger-bg">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${gross > 0 ? (item.value / gross) * 100 : 0}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
