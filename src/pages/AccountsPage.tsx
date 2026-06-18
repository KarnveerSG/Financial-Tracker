import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PageHeader } from '../components/layout/AppLayout'
import { SectionCard } from '../components/shared/MetricCard'
import { useFinanceStore } from '../store/useFinanceStore'
import { ACCOUNT_TYPES, type Account } from '../types'
import { accountSchema, type AccountFormValues } from '../schemas/forms'
import { formatCurrency } from '../engine/format'

function AccountForm({
  account,
  onSave,
  onCancel,
}: {
  account?: Account
  onSave: (values: AccountFormValues) => void
  onCancel: () => void
}) {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const { register, handleSubmit, watch, formState: { errors } } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: account ?? {
      name: '',
      accountType: 'brokerage',
      balance: 0,
      monthlyContribution: 0,
      expectedAnnualReturn: 7,
      taxTreatment: 'taxable',
      employerMatchPercent: 0,
      contributionIncreaseRate: 0,
      allocationCategory: 'taxable_brokerage',
      isLiability: false,
      notes: '',
    },
  })

  const accountType = watch('accountType')
  const typeMeta = ACCOUNT_TYPES.find((t) => t.value === accountType)

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Account Name</label>
          <input {...register('name')} className="input-field" />
          {errors.name && <p className="mt-1 text-xs text-ledger-danger">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label">Account Type</label>
          <select {...register('accountType')} className="input-field">
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Current Balance</label>
          <input {...register('balance')} type="number" className="input-field tabular-nums" />
        </div>
        <div>
          <label className="label">Monthly Contribution</label>
          <input {...register('monthlyContribution')} type="number" className="input-field tabular-nums" />
        </div>
        <div>
          <label className="label">Expected Annual Return (%)</label>
          <input {...register('expectedAnnualReturn')} type="number" step="0.1" className="input-field tabular-nums" />
        </div>
        <div>
          <label className="label">Tax Treatment</label>
          <select {...register('taxTreatment')} className="input-field">
            <option value="pretax">Pretax</option>
            <option value="roth">Roth / Post-Tax</option>
            <option value="taxable">Taxable</option>
            <option value="none">None</option>
          </select>
        </div>
        <div>
          <label className="label">Allocation Category</label>
          <select {...register('allocationCategory')} className="input-field">
            {scenario.allocationCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Employer Match (%)</label>
          <input {...register('employerMatchPercent')} type="number" className="input-field tabular-nums" />
        </div>
        <div>
          <label className="label">Contribution Increase Rate (%/yr)</label>
          <input {...register('contributionIncreaseRate')} type="number" className="input-field tabular-nums" />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input {...register('isLiability')} type="checkbox" className="rounded" />
            This is a liability / debt
          </label>
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea {...register('notes')} className="input-field min-h-[80px]" />
      </div>
      {typeMeta && (
        <p className="text-xs text-ledger-muted">
          Default category: {typeMeta.defaultCategory} · Tax: {typeMeta.defaultTax}
        </p>
      )}
      <div className="flex gap-3">
        <button type="submit" className="btn-primary">Save Account</button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}

export function AccountsPage() {
  const scenario = useFinanceStore((s) => s.getActiveScenario())
  const { addAccount, updateAccount, removeAccount } = useFinanceStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const editingAccount = scenario.accounts.find((a) => a.id === editingId)

  const handleSave = (values: AccountFormValues) => {
    const payload = { ...values, accountType: values.accountType as Account['accountType'] }
    if (editingId) {
      updateAccount(editingId, payload)
      setEditingId(null)
    } else {
      addAccount(payload)
      setShowForm(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Manage unlimited accounts with contributions, returns, and tax treatment"
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => { setShowForm(true); setEditingId(null) }}
          className="btn-primary"
        >
          + Add Account
        </button>
      </div>

      {(showForm || editingId) && (
        <SectionCard title={editingId ? 'Edit Account' : 'New Account'}>
          <AccountForm
            account={editingAccount}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingId(null) }}
          />
        </SectionCard>
      )}

      <div className="mt-6 space-y-3">
        {scenario.accounts.length === 0 ? (
          <div className="card text-center text-ledger-muted">
            No accounts yet. Add your 401(k), brokerage, HYSA, and debts to get started.
          </div>
        ) : (
          scenario.accounts.map((account) => (
            <div key={account.id} className="card flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium">{account.name}</p>
                <p className="text-sm text-ledger-muted">
                  {ACCOUNT_TYPES.find((t) => t.value === account.accountType)?.label}
                  {' · '}{account.taxTreatment}
                  {account.isLiability && ' · Liability'}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-serif text-xl tabular-nums ${account.isLiability ? 'text-ledger-danger' : 'text-ledger-success'}`}>
                  {formatCurrency(account.balance, scenario.profile.currency)}
                </p>
                {!account.isLiability && account.monthlyContribution > 0 && (
                  <p className="text-xs text-ledger-muted tabular-nums">
                    +{formatCurrency(account.monthlyContribution, scenario.profile.currency)}/mo
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditingId(account.id)} className="btn-ghost text-sm">Edit</button>
                <button type="button" onClick={() => removeAccount(account.id)} className="btn-ghost text-sm text-ledger-danger">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
