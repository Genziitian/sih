import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useStore } from './store'
import { AppShell } from './components/AppShell'
import { Landing } from './routes/Landing'
import { NewScreening } from './routes/NewScreening'
import { PendingSync } from './routes/PendingSync'
import { ReviewQueue } from './routes/ReviewQueue'
import { CaseReview } from './routes/CaseReview'
import { Dashboard } from './routes/Dashboard'
import { ReportView } from './routes/ReportView'

function Boot() {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <p className="label">Loading screening data…</p>
    </div>
  )
}

export default function App() {
  const ready = useStore((s) => s.ready)
  const bootstrap = useStore((s) => s.bootstrap)
  const setRole = useStore((s) => s.setRole)
  const location = useLocation()

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  // Deep links should put the shell in the matching role.
  useEffect(() => {
    if (location.pathname.startsWith('/queue')) setRole('ophthalmologist')
    else if (location.pathname.startsWith('/dashboard')) setRole('programme_officer')
    else if (
      location.pathname.startsWith('/screening') ||
      location.pathname.startsWith('/pending')
    )
      setRole('field_worker')
  }, [location.pathname, setRole])

  if (!ready) return <Boot />

  // The landing page is the product surface, not the instrument: its own shell.
  if (location.pathname === '/') return <Landing />

  // The report is a document, not an application screen: no shell, no chrome.
  if (location.pathname.startsWith('/report/')) {
    return (
      <div className="py-5 px-4">
        <Routes>
          <Route path="/report/:id" element={<ReportView />} />
        </Routes>
      </div>
    )
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/screening" element={<NewScreening />} />
        <Route path="/pending" element={<PendingSync />} />
        <Route path="/queue" element={<ReviewQueue />} />
        <Route path="/queue/:id" element={<CaseReview />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
