import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PageHeader } from '../components/layout/AppLayout'
import { SectionCard } from '../components/shared/MetricCard'
import { useFinanceStore } from '../store/useFinanceStore'
import { ACCOUNT_TYPES, HOLDINGS_ACCOUNT_TYPES, type Account, type StockHolding } from '../types'
import { accountSchema, type AccountFormValues } from '../schemas/forms'
import { formatCurrency, createId } from '../engine/format'
import { getHoldingsValue, resolveAccountBalance } from '../engine/accounts'
import { calculateLoanInterest } from '../engine/loans'

const LIABILITY_TYPES = new Set(['loan', 'mortgage', 'credit'])

function StockHoldingsEditor({
  holdings,
  onChange,
}: {
  holdings: StockHolding[]
  onChange: (holdings: StockHolding[]) => void
}) {
  const addRow = () => {
    onChange([...holdings, { id: createId(), ticker: '', shares: 0, pricePerShare: 0 }])
  }

  const updateRow = (id: string, partial: Partial<StockHolding>) => {
    onChange(holdings.map((h) => (h.id === id ? { ...h, ...partial } : h)))
  }

  const removeRow = (id: string) => {
    onChange(holdings.filter((h) => h.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="label mb-0">Stock Holdings</p>
        <button type="button" onClick={addRow} className="btn-ghost text-sm">+ Add Stock</button>
      </div>
      {holdings.length === 0 ? (
        <p className="text-sm text-ledger-muted">No holdings yet. Add tickers you own in this account.</p>
      ) : (
        <div className="space-y-2">
          {holdings.map((h) => (
            <div key={h.id} className="grid gap-2 sm:grid-cols-4 items-end">
              <div>
                <label className="label text-xs">Ticker</label>
                <input
                  value={h.ticker}
                  onChange={(e) => updateRow(h.id, { ticker: e.target.value.toUpperCase() })}
                  className="input-field"
                  placeholder="AAPL"
                />
              </div>
              <div>
                <label className="label text-xs">Shares</label>
                <input
                  type="number"
                  step="0.001"
                  value={h.shares || ''}
                  onChange={(e) => updateRow(h.id, { shares: +e.target.value })}
                  className="input-field tabular-nums"
                />
              </div>
              <div>
                <label className="label text-xs">Price/Share</label>
                <input
                  type="number"
                  step="0.01"
                  value={h.pricePerShare || ''}
                  onChange={(e) => updateRow(h.id, { pricePerShare: +e.target.value })}
                  className="input-field tabular-nums"
                />
              </div>
              <div className="flex items-center gap-2 pb-1">
                <span className="text-sm tabular-nums text-ledger-muted">
                  {formatCurrency(h.shares * h.pricePerShare)}
                </span>
                <button type="button" onClick={() => removeRow(h.id)} className="btn-ghost text-sm text-ledger-danger">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {holdings.length > 0 && (
        <p className="text-sm text-ledger-muted">
          Total holdings value: {formatCurrency(getHoldingsValue(holdings))}
        </p>
      )}
    </div>
  )
}

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
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<AccountFormValues>({
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
      interestRate: 0,
      loanTermMonths: 0,
      holdings: [],
      syncBalanceFromHoldings: false,
      notes: '',
    },
  })

  const accountType = watch('accountType')
  const isLiability = watch('isLiability')
  const holdings = watch('holdings')
  const syncBalanceFromHoldings = watch('syncBalanceFromHoldings')
  const interestRate = watch('interestRate')
  const loanTermMonths = watch('loanTermMonths')
  const monthlyContribution = watch('monthlyContribution')
  const balance = watch('balance')
  const contributionIncreaseRate = watch('contributionIncreaseRate')

  const typeMeta = ACCOUNT_TYPES.find((t) => t.value === accountType)
  const isLoanType = isLiability || LIABILITY_TYPES.has(accountType)
  const showHoldings = !isLoanType && (HOLDINGS_ACCOUNT_TYPES.includes(accountType as Account['accountType']) || holdings.length > 0)

  const loanPreview = isLoanType
    ? calculateLoanInterest({
        ...(account ?? { id: '', name: '', accountType: 'loan', balance, expectedAnnualReturn: 0, taxTreatment: 'none', employerMatchPercent: 0, allocationCategory: 'other', notes: '', holdings: [], syncBalanceFromHoldings: false }),
        balance,
        monthlyContribution,
        interestRate,
        loanTermMonths,
        contributionIncreaseRate,
        isLiability: true,
      })
    : null

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
          <select
            {...register('accountType')}
            className="input-field"
            onChange={(e) => {
              const val = e.target.value as Account['accountType']
              register('accountType').onChange(e)
              const meta = ACCOUNT_TYPES.find((t) => t.value === val)
              if (meta?.isLiability) {
                setValue('isLiability', true)
                setValue('taxTreatment', 'none')
              }
            }}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{isLoanType ? 'Current Balance Owed' : 'Current Balance'}</label>
          <input {...register('balance')} type="number" className="input-field tabular-nums" disabled={syncBalanceFromHoldings && !isLoanType} />
        </div>
        <div>
          <label className="label">{isLoanType ? 'Monthly Payment' : 'Monthly Contribution'}</label>
          <input {...register('monthlyContribution')} type="number" className="input-field tabular-nums" />
        </div>
        {!isLoanType && (
          <div>
            <label className="label">Expected Annual Return (%)</label>
            <input {...register('expectedAnnualReturn')} type="number" step="0.1" className="input-field tabular-nums" />
          </div>
        )}
        <div>
          <label className="label">Tax Treatment</label>
          <select {...register('taxTreatment')} className="input-field">
            <option value="pretax">Pretax</option>
            <option value="roth">Roth / Post-Tax</option>
            <option value="taxable">Taxable</option>
            <option value="none">None</option>
          </select>
        </div>
        {!isLoanType && (
          <div>
            <label className="label">Allocation Category</label>
            <select {...register('allocationCategory')} className="input-field">
              {scenario.allocationCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        )}
        {!isLoanType && (
          <div>
            <label className="label">Employer Match (%)</label>
            <input {...register('employerMatchPercent')} type="number" className="input-field tabular-nums" />
          </div>
        )}
        <div>
          <label className="label">{isLoanType ? 'Payment Increase Rate (%/yr)' : 'Contribution Increase Rate (%/yr)'}</label>
          <input {...register('contributionIncreaseRate')} type="number" className="input-field tabular-nums" />
        </div>
        {isLoanType && (
          <>
            <div>
              <label className="label">Interest Rate (% APR)</label>
              <input {...register('interestRate')} type="number" step="0.01" className="input-field tabular-nums" />
            </div>
            <div>
              <label className="label">Remaining Term (months)</label>
              <input {...register('loanTermMonths')} type="number" className="input-field tabular-nums" />
            </div>
          </>
        )}
        {!isLoanType && (
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input {...register('isLiability')} type="checkbox" className="rounded" />
              This is a liability / debt
            </label>
          </div>
        )}
      </div>

      {showHoldings && (
        <div className="rounded-xl border border-ledger-border p-4">
          <StockHoldingsEditor
            holdings={holdings}
            onChange={(next) => setValue('holdings', next)}
          />
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input {...register('syncBalanceFromHoldings')} type="checkbox" className="rounded" />
            Sync account balance from holdings
          </label>
        </div>
      )}

      {loanPreview && loanPreview.annualInterest > 0 && (
        <div className="rounded-xl bg-ledger-bg/50 p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span>Est. annual interest</span>
            <span className="tabular-nums text-ledger-danger">{formatCurrency(loanPreview.annualInterest, scenario.profile.currency)}</span>
          </div>
          {loanPreview.totalInterestRemaining > 0 ? (
            <div className="flex justify-between">
              <span>Total interest remaining</span>
              <span className="tabular-nums text-ledger-danger">{formatCurrency(loanPreview.totalInterestRemaining, scenario.profile.currency)}</span>
            </div>
          ) : (
            <p className="text-xs text-ledger-muted">Add remaining term and monthly payment to estimate total interest.</p>
          )}
        </div>
      )}

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
    let balance = values.balance
    if (values.syncBalanceFromHoldings && values.holdings.length > 0) {
      balance = getHoldingsValue(values.holdings)
    }
    const payload = {
      ...values,
      balance,
      accountType: values.accountType as Account['accountType'],
    }
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
        subtitle="Manage unlimited accounts with contributions, returns, tax treatment, holdings, and loans"
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
          scenario.accounts.map((account) => {
            const balance = resolveAccountBalance(account)
            const loanInfo = account.isLiability ? calculateLoanInterest(account) : null
            const holdingsValue = account.holdings?.length ? getHoldingsValue(account.holdings) : 0

            return (
              <div key={account.id} className="card flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-sm text-ledger-muted">
                    {ACCOUNT_TYPES.find((t) => t.value === account.accountType)?.label}
                    {' · '}{account.taxTreatment}
                    {account.isLiability && ' · Liability'}
                    {account.holdings?.length > 0 && ` · ${account.holdings.length} holding${account.holdings.length > 1 ? 's' : ''}`}
                  </p>
                  {loanInfo && loanInfo.annualInterest > 0 && (
                    <p className="text-xs text-ledger-danger tabular-nums">
                      {formatCurrency(loanInfo.annualInterest, scenario.profile.currency)}/yr interest
                      {loanInfo.totalInterestRemaining > 0 && ` · ${formatCurrency(loanInfo.totalInterestRemaining, scenario.profile.currency)} remaining`}
                    </p>
                  )}
                  {holdingsValue > 0 && (
                    <p className="text-xs text-ledger-muted tabular-nums">
                      Holdings: {formatCurrency(holdingsValue, scenario.profile.currency)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className={`font-serif text-xl tabular-nums ${account.isLiability ? 'text-ledger-danger' : 'text-ledger-success'}`}>
                    {formatCurrency(balance, scenario.profile.currency)}
                  </p>
                  {!account.isLiability && account.monthlyContribution > 0 && (
                    <p className="text-xs text-ledger-muted tabular-nums">
                      +{formatCurrency(account.monthlyContribution, scenario.profile.currency)}/mo
                    </p>
                  )}
                  {account.isLiability && account.monthlyContribution > 0 && (
                    <p className="text-xs text-ledger-muted tabular-nums">
                      {formatCurrency(account.monthlyContribution, scenario.profile.currency)}/mo payment
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingId(account.id)} className="btn-ghost text-sm">Edit</button>
                  <button type="button" onClick={() => removeAccount(account.id)} className="btn-ghost text-sm text-ledger-danger">Delete</button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
