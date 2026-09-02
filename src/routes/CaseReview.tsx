import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ClinicianDecision, DisagreementReason, EyeSide, LesionType } from '../types'
import { reviewQueue, useStore } from '../store'
import {
  LOW_CONFIDENCE_THRESHOLD,
  UNGRADABLE_COLOR,
  elapsedLabel,
  gradeMeta,
} from '../lib/grading'
import { FundusViewer, type OverlayMode } from '../components/FundusViewer'
import { OverlaySelector } from '../components/OverlaySelector'
import { SeverityStrip } from '../components/SeverityStrip'
import { ConfidenceBlock } from '../components/ConfidenceBlock'
import { LesionList } from '../components/LesionList'
import { PatientStrip } from '../components/PatientStrip'
import { DecisionPanel } from '../components/DecisionPanel'
import { Button, Kbd, Note, Panel, Row } from '../components/ui'

/** Frozen for the sitting, so "Case 8 of 23" counts up instead of shrinking. */
let sessionOrder: string[] = []

export function CaseReview() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const screenings = useStore((s) => s.screenings)
  const recordDecision = useStore((s) => s.recordDecision)

  const [side, setSide] = useState<EyeSide | null>(null)
  const [mode, setMode] = useState<OverlayMode>('original')
  const [opacity, setOpacity] = useState(0.7)
  const [highlight, setHighlight] = useState<LesionType | null>(null)
  const [pending, setPending] = useState<ClinicianDecision | null>(null)
  const [busy, setBusy] = useState(false)

  const screening = screenings.find((s) => s.id === id) ?? null
  const queue = useMemo(() => reviewQueue(screenings), [screenings])

  if (screening && !sessionOrder.includes(screening.id)) {
    sessionOrder = [...new Set([...sessionOrder, ...queue.map((q) => q.id), screening.id])]
  }

  const position = sessionOrder.indexOf(id) + 1
  const total = sessionOrder.length

  const nextId = useMemo(() => {
    const after = sessionOrder.slice(sessionOrder.indexOf(id) + 1)
    const stillOpen = after.find((cid) =>
      screenings.some((s) => s.id === cid && s.status === 'awaiting_review'),
    )
    return stillOpen ?? queue.find((q) => q.id !== id)?.id ?? null
  }, [id, queue, screenings])

  const prevId = useMemo(() => {
    const before = sessionOrder.slice(0, Math.max(0, sessionOrder.indexOf(id)))
    return before.length ? before[before.length - 1] : null
  }, [id])

  // Default to the worse eye — that is the one the decision turns on.
  const defaultSide: EyeSide = useMemo(() => {
    if (!screening) return 'right'
    const r = screening.eyes.right?.analysis
    const l = screening.eyes.left?.analysis
    if (r?.ungradable && !l?.ungradable) return 'left'
    if (l?.ungradable && !r?.ungradable) return 'right'
    return (r?.grade ?? -1) >= (l?.grade ?? -1) ? 'right' : 'left'
  }, [screening])

  const activeSide = side ?? defaultSide
  const eye = screening?.eyes[activeSide] ?? null
  const analysis = eye?.analysis ?? null

  useEffect(() => {
    setSide(null)
    setMode('original')
    setHighlight(null)
    setPending(null)
  }, [id])

  const commit = async (decision: ClinicianDecision, reason: DisagreementReason | null) => {
    if (!screening) return
    setBusy(true)
    await recordDecision(screening.id, decision, reason)
    setBusy(false)
    setPending(null)
    if (nextId) navigate(`/queue/${nextId}`)
    else navigate('/queue')
  }

  const bothUngradable =
    !!screening &&
    Object.values(screening.eyes).length === 2 &&
    Object.values(screening.eyes).every((e) => e?.analysis?.ungradable)

  const modelSuggestsReferral = screening?.referralSuggested ?? false

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'o') setMode('original')
      else if (k === 'a') setMode('attention')
      else if (k === 'l') setMode('lesions')
      else if (k === 'r') {
        e.preventDefault()
        modelSuggestsReferral ? void commit('refer', null) : setPending('refer')
      } else if (k === 'n') {
        e.preventDefault()
        modelSuggestsReferral ? setPending('no_refer') : void commit('no_refer', null)
      } else if (k === 'u') {
        e.preventDefault()
        void commit('ungradable', null)
      } else if (e.key === 'ArrowRight' && nextId) navigate(`/queue/${nextId}`)
      else if (e.key === 'ArrowLeft' && prevId) navigate(`/queue/${prevId}`)
      else if (k === 'e') setSide(activeSide === 'right' ? 'left' : 'right')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!screening) {
    return (
      <Note tone="alert" title="That case is no longer in the queue.">
        <Button compact className="mt-2" onClick={() => navigate('/queue')}>
          Back to queue
        </Button>
      </Note>
    )
  }

  const decided = screening.status === 'completed'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <button className="label underline" onClick={() => navigate('/queue')}>
            Review queue
          </button>
          <span className="font-mono text-[14px]">{screening.id}</span>
          <span className="label tnum">
            Case {position} of {total}
          </span>
          <span className="label tnum">waiting {elapsedLabel(screening.createdAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button compact disabled={!prevId} onClick={() => prevId && navigate(`/queue/${prevId}`)}>
            Previous
          </Button>
          <Button compact disabled={!nextId} onClick={() => nextId && navigate(`/queue/${nextId}`)}>
            Next
          </Button>
          <span className="label hidden lg:inline">
            <Kbd>←</Kbd> <Kbd>→</Kbd> move · <Kbd>E</Kbd> other eye
          </span>
        </div>
      </div>

      {bothUngradable && (
        <Note tone="alert" title="Both eyes could not be graded.">
          Refer for manual examination — mark the case ungradable to route it to a slit-lamp clinic.
        </Note>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex hairline rounded-control overflow-hidden">
              {(['right', 'left'] as EyeSide[]).map((s) => {
                const active = activeSide === s
                const has = !!screening.eyes[s]
                return (
                  <button
                    key={s}
                    disabled={!has}
                    onClick={() => setSide(s)}
                    aria-pressed={active}
                    className={[
                      'min-h-11 px-4 text-[13px] font-medium border-r border-line last:border-r-0',
                      active ? 'bg-primary text-white' : 'bg-surface hover:bg-canvas',
                      has ? '' : 'text-muted cursor-not-allowed',
                    ].join(' ')}
                  >
                    {s === 'right' ? 'Right eye' : 'Left eye'}
                  </button>
                )
              })}
            </div>
            <OverlaySelector
              mode={mode}
              onChange={setMode}
              opacity={opacity}
              onOpacity={setOpacity}
              showKeys
              disabled={!analysis}
            />
          </div>

          {eye && (
            <FundusViewer
              src={eye.imageSrc}
              lesions={analysis?.lesions ?? []}
              attention={analysis?.attention ?? []}
              mode={analysis ? mode : 'original'}
              opacity={opacity}
              highlight={highlight}
              caption={`${activeSide} eye`}
            />
          )}
        </div>

        <div className="space-y-4">
          <Panel title="Patient">
            <PatientStrip
              readOnly
              screeningId={screening.id}
              patient={screening.patient}
              site={screening.site}
            />
          </Panel>

          <Panel title="Model result" aside={`${activeSide === 'right' ? 'Right' : 'Left'} eye`}>
            {!analysis ? (
              <Note tone="alert" title="Not yet analysed">
                This screening reached the queue before inference completed.
              </Note>
            ) : analysis.ungradable ? (
              <>
                <SeverityStrip grade={null} ungradable />
                <p className="text-[20px] font-medium mt-3 mb-1" style={{ color: UNGRADABLE_COLOR }}>
                  Ungradable
                </p>
                <p className="text-[13px] text-muted m-0">{analysis.quality.message}</p>
              </>
            ) : (
              <>
                <SeverityStrip grade={analysis.grade} />
                <p
                  className="text-[22px] leading-tight font-medium mt-3 mb-2"
                  style={{ color: gradeMeta(analysis.grade!).colorVar }}
                >
                  {analysis.gradeLabel}
                </p>
                <p className="text-[14px] m-0">{analysis.action}</p>
                {analysis.confidence < LOW_CONFIDENCE_THRESHOLD && (
                  <div className="mt-3">
                    <Note tone="alert" title="Low confidence — flagged for priority review">
                      The field worker was not shown a grade for this eye.
                    </Note>
                  </div>
                )}
              </>
            )}
            {analysis && (
              <div className="mt-4">
                <ConfidenceBlock analysis={analysis} />
              </div>
            )}
          </Panel>

          {analysis && !analysis.ungradable && (
            <Panel
              title="Findings"
              aside={
                <button className="label underline" onClick={() => setMode('attention')}>
                  Show attention map
                </button>
              }
            >
              <div className="flex gap-3">
                <button
                  onClick={() => setMode('attention')}
                  className="w-24 shrink-0"
                  title="Show the attention map on the main image"
                >
                  <FundusViewer
                    src={eye!.imageSrc}
                    attention={analysis.attention}
                    mode="attention"
                    opacity={0.85}
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <LesionList
                    findings={analysis.findings}
                    selected={highlight}
                    onSelect={(t) => {
                      setHighlight(t)
                      if (t) setMode('lesions')
                    }}
                  />
                </div>
              </div>
            </Panel>
          )}

          <Panel title="Decision">
            {decided && screening.review ? (
              <>
                <Note tone="good" title={
                  screening.review.decision === 'refer'
                    ? 'Referral confirmed'
                    : screening.review.decision === 'no_refer'
                      ? 'No referral'
                      : 'Marked ungradable'
                }>
                  {screening.review.clinicianName} ·{' '}
                  {new Date(screening.review.decidedAt).toLocaleString()}
                </Note>
                {screening.review.disagreedWithModel && (
                  <div className="mt-3">
                    <Row label="Differs from model" value={screening.review.reason ?? '—'} />
                  </div>
                )}
                <div className="grid gap-2 mt-3">
                  <Button block onClick={() => navigate(`/report/${screening.id}`)}>
                    Open report
                  </Button>
                  {nextId && (
                    <Button variant="primary" block onClick={() => navigate(`/queue/${nextId}`)}>
                      Next case
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <DecisionPanel
                modelSuggestsReferral={modelSuggestsReferral}
                pendingDecision={pending}
                onPending={setPending}
                onCommit={(d, r) => void commit(d, r)}
                busy={busy}
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
