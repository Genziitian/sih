import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import type { Role } from '../types'
import { useStore } from '../store'
import { DEMO_CASES } from '../demo/cases'
import { OfflineIndicator } from './OfflineIndicator'
import { Button } from './ui'

const ROLE_LABELS: Record<Role, string> = {
  field_worker: 'Field worker',
  ophthalmologist: 'Ophthalmologist',
  programme_officer: 'Programme officer',
}

const ROLE_NAV: Record<Role, { to: string; label: string }[]> = {
  field_worker: [
    { to: '/screening', label: 'New screening' },
    { to: '/pending', label: 'Pending sync' },
  ],
  ophthalmologist: [{ to: '/queue', label: 'Review queue' }],
  programme_officer: [{ to: '/dashboard', label: 'Dashboard' }],
}

const QUICK_ACTIONS = [
  { caseId: 'g0', label: 'Demo: Good image' },
  { caseId: 'poor', label: 'Demo: Poor image' },
  { caseId: 'g2', label: 'Demo: Grade 2' },
  { caseId: 'lowconf', label: 'Demo: Low confidence' },
  { caseId: 'ungradable', label: 'Demo: Ungradable' },
  { caseId: 'both_ungradable', label: 'Demo: Both eyes ungradable' },
  { caseId: 'service_down', label: 'Demo: Backend unavailable' },
]

function DemoControls({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const loadDemoCase = useStore((s) => s.loadDemoCase)
  const resetDraft = useStore((s) => s.resetDraft)
  const resetPrototype = useStore((s) => s.resetPrototype)
  const setRole = useStore((s) => s.setRole)
  const backend = useStore((s) => s.backend)
  const [busy, setBusy] = useState(false)

  const run = async (caseId: string) => {
    setBusy(true)
    setRole('field_worker')
    resetDraft()
    navigate('/screening')
    await loadDemoCase(caseId)
    setBusy(false)
    onClose()
  }

  return (
    <div className="bg-surface border-t border-line">
      <div className="shell py-4">
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <div>
            <h2 className="text-[13px] font-semibold m-0">Prototype controls</h2>
            <p className="label m-0">
              Jump straight to any state. Each button loads a scripted capture on the screening
              screen.
            </p>
          </div>
          <button className="label underline" onClick={onClose}>
            Hide
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => {
            const c = DEMO_CASES.find((d) => d.id === a.caseId)
            return (
              <Button key={a.caseId} compact disabled={busy} onClick={() => void run(a.caseId)} title={c?.blurb}>
                {a.label}
              </Button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-line">
          <Button
            compact
            variant="alert"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await resetPrototype()
              setBusy(false)
            }}
          >
            Reset prototype data
          </Button>
          <span className="label">
            Backend: {backend?.kind === 'supabase' ? 'Supabase' : 'Browser store (IndexedDB)'}
            {backend?.fallbackReason ? ` — ${backend.fallbackReason}` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const role = useStore((s) => s.role)
  const setRole = useStore((s) => s.setRole)
  const navigate = useNavigate()
  const [demoOpen, setDemoOpen] = useState(false)

  const nav = ROLE_NAV[role]

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="bg-surface border-b border-line sticky top-0 z-20">
        <div className="shell h-15 min-h-15 flex items-center gap-5 py-2.5">
          <Link
            to="/"
            className="flex items-center gap-2.5 shrink-0 no-underline text-ink"
            title="Back to the overview"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="10" fill="none" stroke="var(--color-primary)" strokeWidth="1.7" />
              <circle cx="15.5" cy="12" r="3.6" fill="var(--color-primary)" />
            </svg>
            <span className="text-[14.5px] font-semibold tracking-[-0.01em] hidden sm:inline">
              Retinal screening
            </span>
          </Link>

          <span className="w-px h-6 bg-line hidden sm:block" aria-hidden />

          <nav className="flex items-center gap-1 min-w-0" aria-label="Primary">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  [
                    'min-h-9 px-3 flex items-center text-[14px] rounded-control no-underline whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-primary-wash text-primary-ink font-medium'
                      : 'text-muted hover:text-ink hover:bg-sunken',
                  ].join(' ')
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          <div className="hidden lg:flex items-center gap-3">
            <OfflineIndicator />
            <span className="w-px h-6 bg-line" aria-hidden />
          </div>

          <label className="flex items-center gap-2 shrink-0">
            <span className="label hidden md:inline">Role</span>
            <select
              value={role}
              onChange={(e) => {
                const next = e.target.value as Role
                setRole(next)
                navigate(ROLE_NAV[next][0].to)
              }}
              className="min-h-9 px-2.5 bg-surface border border-line-strong rounded-control text-[13.5px] font-medium"
              aria-label="Prototype role"
            >
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={() => setDemoOpen((v) => !v)}
            aria-expanded={demoOpen}
            className={[
              'min-h-9 px-3 text-[13px] font-medium rounded-control border transition-colors shrink-0',
              demoOpen
                ? 'bg-primary-wash border-primary-wash text-primary-ink'
                : 'bg-surface border-line-strong text-muted hover:text-ink',
            ].join(' ')}
          >
            Prototype
          </button>
        </div>

        <div className="lg:hidden border-t border-line">
          <div className="shell py-2">
            <OfflineIndicator />
          </div>
        </div>

        {demoOpen && <DemoControls onClose={() => setDemoOpen(false)} />}
      </header>

      <main className="flex-1 shell py-6">{children}</main>

      <footer className="border-t border-line mt-4">
        <div className="shell py-4 label">
          AI-assisted screening prototype. Results are not a diagnosis; a clinician confirms every
          referral. Fundus images shown are synthetic.
        </div>
      </footer>
    </div>
  )
}
