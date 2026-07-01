import { useState } from 'react'
import { PageHeader } from '../components/layout/AppLayout'
import { MetricCard, SectionCard } from '../components/shared/MetricCard'
import { useFinanceStore } from '../store/useFinanceStore'
import { formatCurrency } from '../engine/format'
import type { InsuranceKind } from '../types'

const KINDS: { value: InsuranceKind; label: string }[] = [
  { value: 'life', label: 'Life' },
  { value: 'disability', label: 'Disability' },
  { value: 'health', label: 'Health' },
  { value: 'auto', label: 'Auto' },
  { value: 'home', label: 'Home / Renters' },
  { value: 'umbrella', label: 'Umbrella' },
  { value: 'other', label: 'Other' },
]

function annualize(premium: number, freq: 'monthly' | 'quarterly' | 'yearly') {
  return freq === 'monthly' ? premium * 12 : freq === 'quarterly' ? premium * 4 : premium
}

export function InsurancePage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const { addInsurance, updateInsurance, removeInsurance } = useFinanceStore()
  const currency = scenario.profile.currency
  const policies = scenario.insurancePolicies ?? []

  const [form, setForm] = useState({
    name: '',
    kind: 'life' as InsuranceKind,
    provider: '',
    premium: '',
    premiumFrequency: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
    coverageAmount: '',
    renewalDate: '',
    beneficiary: '',
    policyNumber: '',
  })

  const totalAnnual = policies.reduce((sum, p) => sum + annualize(p.premium, p.premiumFrequency), 0)
  const totalCoverage = policies.reduce((sum, p) => sum + (p.coverageAmount || 0), 0)

  const submit = () => {
    if (!form.name.trim()) return
    addInsurance({
      name: form.name.trim(),
      kind: form.kind,
      provider: form.provider.trim(),
      premium: parseFloat(form.premium) || 0,
      premiumFrequency: form.premiumFrequency,
      coverageAmount: parseFloat(form.coverageAmount) || 0,
      renewalDate: form.renewalDate || undefined,
      beneficiary: form.beneficiary || undefined,
      policyNumber: form.policyNumber || undefined,
    })
    setForm({ ...form, name: '', provider: '', premium: '', coverageAmount: '', renewalDate: '', beneficiary: '', policyNumber: '' })
  }

  return (
    <div>
      <PageHeader title="Insurance" subtitle="Track policies, premiums, coverage, and renewal dates" />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Policies" value={String(policies.length)} />
        <MetricCard label="Annual premiums" value={formatCurrency(totalAnnual, currency)} />
        <MetricCard label="Total coverage" value={formatCurrency(totalCoverage, currency)} />
      </div>

      <SectionCard title="Policies">
        {policies.length === 0 ? (
          <p className="text-sm text-ledger-muted">No policies yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ledger-muted">
                <th className="pb-2">Name</th>
                <th className="pb-2">Kind</th>
                <th className="pb-2">Provider</th>
                <th className="pb-2 text-right">Premium</th>
                <th className="pb-2 text-right">Annual</th>
                <th className="pb-2 text-right">Coverage</th>
                <th className="pb-2">Renewal</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id} className="border-t border-ledger-border">
                  <td className="py-1.5"><input value={p.name} onChange={(e) => updateInsurance(p.id, { name: e.target.value })} className="w-full bg-transparent" /></td>
                  <td className="py-1.5 text-ledger-muted">{KINDS.find((k) => k.value === p.kind)?.label}</td>
                  <td className="py-1.5"><input value={p.provider} onChange={(e) => updateInsurance(p.id, { provider: e.target.value })} className="w-full bg-transparent" /></td>
                  <td className="py-1.5 text-right"><input type="number" value={p.premium} onChange={(e) => updateInsurance(p.id, { premium: +e.target.value })} className="w-24 bg-transparent text-right tabular-nums" /> /{p.premiumFrequency[0]}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCurrency(annualize(p.premium, p.premiumFrequency), currency)}</td>
                  <td className="py-1.5 text-right"><input type="number" value={p.coverageAmount} onChange={(e) => updateInsurance(p.id, { coverageAmount: +e.target.value })} className="w-28 bg-transparent text-right tabular-nums" /></td>
                  <td className="py-1.5"><input type="date" value={p.renewalDate ?? ''} onChange={(e) => updateInsurance(p.id, { renewalDate: e.target.value })} className="bg-transparent" /></td>
                  <td className="py-1.5 text-right"><button type="button" onClick={() => removeInsurance(p.id)} className="text-xs text-ledger-muted hover:text-ledger-danger">Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <SectionCard title="Add policy">
        <div className="grid gap-3 md:grid-cols-4">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as InsuranceKind })} className="input-field">
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <input placeholder="Provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="input-field" />
          <div className="flex gap-2">
            <input placeholder="Premium" type="number" value={form.premium} onChange={(e) => setForm({ ...form, premium: e.target.value })} className="input-field flex-1" />
            <select value={form.premiumFrequency} onChange={(e) => setForm({ ...form, premiumFrequency: e.target.value as 'monthly' | 'quarterly' | 'yearly' })} className="input-field w-28">
              <option value="monthly">/mo</option>
              <option value="quarterly">/qtr</option>
              <option value="yearly">/yr</option>
            </select>
          </div>
          <input placeholder="Coverage $" type="number" value={form.coverageAmount} onChange={(e) => setForm({ ...form, coverageAmount: e.target.value })} className="input-field" />
          <input placeholder="Renewal date" type="date" value={form.renewalDate} onChange={(e) => setForm({ ...form, renewalDate: e.target.value })} className="input-field" />
          <input placeholder="Beneficiary" value={form.beneficiary} onChange={(e) => setForm({ ...form, beneficiary: e.target.value })} className="input-field" />
          <input placeholder="Policy #" value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} className="input-field" />
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={submit} className="btn-primary text-sm">Add policy</button>
        </div>
      </SectionCard>
    </div>
  )
}
