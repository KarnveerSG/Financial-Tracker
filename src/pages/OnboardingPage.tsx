import { flushSync } from 'react-dom'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useFinanceStore } from '../store/useFinanceStore'

export function OnboardingPage() {
  const navigate = useNavigate()
  const { loadDemo, completeOnboarding, hasOnboarded, loadNwTrackerSeed } = useFinanceStore()

  useEffect(() => {
    if (hasOnboarded) navigate('/dashboard', { replace: true })
  }, [hasOnboarded, navigate])

  const start = () => {
    flushSync(() => completeOnboarding())
    navigate('/dashboard', { replace: true })
  }

  const tryDemo = () => {
    flushSync(() => loadDemo())
    navigate('/dashboard', { replace: true })
  }

  const loadMyData = () => {
    flushSync(() => loadNwTrackerSeed())
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-ledger-gold/20 bg-ledger-surface shadow-glow"
      >
        <span className="font-serif text-3xl text-ledger-gold">◈</span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="font-serif text-4xl font-semibold sm:text-5xl"
      >
        Midnight Ledger
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-4 max-w-lg text-lg text-ledger-muted"
      >
        Personal finance dashboard for net worth, FIRE progress, tax planning, projections, and paycheck analysis.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-10 flex flex-col gap-3 sm:flex-row"
      >
        <button type="button" onClick={loadMyData} className="btn-primary">
          Load my NW Tracker data
        </button>
        <button type="button" onClick={start} className="btn-secondary">
          Start blank
        </button>
        <button type="button" onClick={tryDemo} className="btn-secondary">
          Explore demo
        </button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-12 max-w-md text-sm text-ledger-muted"
      >
        Track wealth accumulation, retirement readiness, CoastFI, and run Monte Carlo projections — all stored locally in your browser.
      </motion.p>
    </div>
  )
}
