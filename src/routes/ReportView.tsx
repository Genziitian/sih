import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { EyeExam, EyeSide, Screening } from '../types'
import { useStore } from '../store'
import {
  DME_COLOR,
  DME_LABELS,
  DME_SHORT,
  GRADES,
  LESION_LABELS,
  LESION_ORDER,
  UNGRADABLE_COLOR,
  followUp,
  gradeMeta,
  summarise,
  visualAcuityFor,
} from '../lib/grading'
import { downloadReportPdf, openReportPdf, reportFilename } from '../lib/reportPdf'
import { CLINICIAN_NAME, FACILITY, MODEL_VERSION, VALIDATION } from '../demo/cases'
import { OPERATING_POINTS, DEFAULT_THRESHOLD_INDEX } from '../lib/simulation'
import { resolveFundusSrc } from '../demo/fundus'
import { Button, Note } from '../components/ui'

function draftToScreening(draft: ReturnType<typeof useStore.getState>['draft']): Screening {
  const eyes: Screening['eyes'] = {}
  for (const side of ['right', 'left'] as EyeSide[]) {
    const e = draft.eyes[side]
    if (!e) continue
    eyes[side] = {
      side,
      imageSrc: e.imageSrc,
      imageLabel: e.imageLabel,
      visualAcuity: visualAcuityFor(e.analysis?.grade ?? null, e.imageSrc.length),
      quality: e.quality ?? {
        focus: 0,
        illumination: 0,
        fieldOfView: 0,
        verdict: 'poor',
        message: 'Not assessed.',
      },
      analysis: e.analysis,
    }
  }
  const base: Screening = {
    id: draft.id,
    patient: draft.patient,
    site: draft.site,
    createdAt: new Date().toISOString(),
    eyes,
    status: 'draft',
    priority: 'routine',
    worstGrade: null,
    lowestConfidence: null,
    referralSuggested: false,
    review: null,
    synced: false,
  }
  const s = summarise(base)
  return { ...base, ...s, worstGrade: s.worstGrade }
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

function Card({
  n,
  title,
  aside,
  children,
}: {
  n: string
  title: string
  aside?: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-surface hairline rounded-panel overflow-hidden">
      <header className="flex items-baseline gap-2.5 px-5 py-3 border-b border-line">
        <span className="font-mono text-[11px] text-faint">{n}</span>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] m-0">{title}</h2>
        {aside && <span className="label ml-auto">{aside}</span>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Facts({ items, cols = 4 }: { items: [string, React.ReactNode][]; cols?: number }) {
  return (
    <dl
      className="grid gap-x-5 gap-y-4 m-0"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${cols === 2 ? 180 : 130}px, 1fr))` }}
    >
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="label">{k}</dt>
          <dd className="m-0 text-[15px] tnum mt-0.5">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function EyeCard({ exam }: { exam: EyeExam | undefined }) {
  if (!exam) {
    return (
      <div className="bg-surface hairline rounded-panel p-5">
        <h3 className="text-[13px] font-semibold m-0 mb-3">Not captured</h3>
        <div className="aspect-square rounded-panel bg-sunken flex items-center justify-center label">
          No image on file
        </div>
      </div>
    )
  }
  const a = exam.analysis
  const q = exam.quality
  const gradable = !!a && !a.ungradable
  const tone = gradable ? gradeMeta(a!.grade!).colorVar : UNGRADABLE_COLOR

  return (
    <div className="bg-surface hairline rounded-panel overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line">
        <h3 className="text-[13px] font-semibold m-0">
          {exam.side === 'right' ? 'Right eye' : 'Left eye'}{' '}
          <span className="text-muted font-normal">({exam.side === 'right' ? 'OD' : 'OS'})</span>
        </h3>
        <span
          className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'var(--color-sunken)', color: tone }}
        >
          {!a ? 'Not analysed' : a.ungradable ? 'Ungradable' : gradeMeta(a.grade!).short}
        </span>
      </header>

      <img
        src={resolveFundusSrc(exam.imageSrc)}
        alt={`${exam.side} eye fundus photograph`}
        className="w-full aspect-square object-cover"
      />

      <div className="p-5 space-y-4">
        <Facts
          cols={2}
          items={[
            ['Visual acuity', exam.visualAcuity],
            ['Model confidence', a ? a.confidence.toFixed(2) : '—'],
            [
              'Macular oedema',
              gradable ? (
                <span style={{ color: DME_COLOR[a!.dme] }}>
                  {DME_SHORT[a!.dme]}
                  {a!.maculaInvolved && ' · central'}
                </span>
              ) : (
                '—'
              ),
            ],
            [
              'Capture quality',
              q.overridden ? 'Overridden' : q.verdict === 'good' ? 'Passed' : 'Failed',
            ],
          ]}
        />

        <div>
          <div className="label mb-2">Capture metrics</div>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ['Focus', q.focus],
                ['Illumination', q.illumination],
                ['Field', q.fieldOfView],
              ] as [string, number][]
            ).map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-muted">{k}</span>
                  <span className="tnum">{Math.round(v * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-sunken overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${v * 100}%`,
                      background: v >= 0.75 ? 'var(--color-primary)' : v >= 0.5 ? 'var(--color-g2)' : 'var(--color-alert)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {gradable && (
          <div>
            <div className="label mb-1.5">Lesion counts</div>
            <ul className="m-0 p-0 list-none">
              {LESION_ORDER.map((t) => (
                <li
                  key={t}
                  className="flex items-baseline justify-between py-1.5 border-b border-line last:border-0"
                >
                  <span className="text-[13.5px]">{LESION_LABELS[t]}</span>
                  <span className="text-[15px] tnum font-medium">{a!.findings[t]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export function ReportView() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const screenings = useStore((s) => s.screenings)
  const outbox = useStore((s) => s.outbox)
  const draft = useStore((s) => s.draft)
  const [busy, setBusy] = useState<'download' | 'open' | null>(null)
  const [failed, setFailed] = useState(false)

  const screening = useMemo(() => {
    if (id === 'draft') return draftToScreening(draft)
    return screenings.find((s) => s.id === id) ?? outbox.find((s) => s.id === id) ?? null
  }, [id, screenings, outbox, draft])

  if (!screening) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <p className="text-[15px]">That screening is not on this device.</p>
        <Button className="mt-3" onClick={() => navigate('/queue')}>
          Back to queue
        </Button>
      </div>
    )
  }

  const { patient: p } = screening
  const worst = screening.worstGrade
  const meta = worst !== null ? gradeMeta(worst) : null
  const review = screening.review

  const analyses = Object.values(screening.eyes)
    .map((e) => e?.analysis)
    .filter(Boolean)
  const worstDme =
    (['severe', 'moderate', 'mild', 'none'] as const).find((g) =>
      analyses.some((a) => a!.dme === g && !a!.ungradable),
    ) ?? 'none'
  const plan = followUp(worst, worstDme, new Date(screening.createdAt))

  const analysedAt = analyses
    .map((a) => a!.analysedAt)
    .sort()
    .pop()
  const turnaround = review
    ? Math.max(
        0,
        Math.round(
          (new Date(review.decidedAt).getTime() - new Date(screening.createdAt).getTime()) / 60000,
        ),
      )
    : null
  const op = OPERATING_POINTS[DEFAULT_THRESHOLD_INDEX]

  const run = async (kind: 'download' | 'open') => {
    setBusy(kind)
    setFailed(false)
    try {
      if (kind === 'download') await downloadReportPdf(screening)
      else await openReportPdf(screening)
    } catch {
      setFailed(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="max-w-[1000px] mx-auto space-y-4">
      {/* --- action bar --- */}
      <div className="flex flex-wrap items-center gap-3">
        <Button compact onClick={() => navigate(-1)}>
          Back
        </Button>
        <div className="min-w-0">
          <div className="font-mono text-[14px] truncate">{screening.id}</div>
          <div className="label">
            {FACILITY} · {fmtDate(screening.createdAt)}
          </div>
        </div>
        <div className="flex-1" />
        <Button compact onClick={() => void run('open')} disabled={busy !== null}>
          {busy === 'open' ? 'Preparing…' : 'Open PDF'}
        </Button>
        <Button
          compact
          variant="primary"
          onClick={() => void run('download')}
          disabled={busy !== null}
        >
          {busy === 'download' ? 'Building PDF…' : 'Download report'}
        </Button>
      </div>

      {failed && (
        <Note tone="alert" title="The report could not be built.">
          The screening is safe. Try again, or open the PDF in a new tab instead.
        </Note>
      )}

      {/* --- headline result --- */}
      <section
        className="rounded-panel p-6 sm:p-8 hairline"
        style={{
          background: 'var(--color-surface)',
          borderColor: meta ? meta.colorVar : 'var(--color-line)',
        }}
      >
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8">
          <div>
            <span className="label">Worst-eye result</span>
            <p
              className="display text-[clamp(26px,4vw,40px)] m-0 mt-1"
              style={{ color: meta ? meta.colorVar : UNGRADABLE_COLOR }}
            >
              {meta ? `Grade ${meta.grade} — ${meta.label.toLowerCase()}` : 'Ungradable'}
            </p>
            <p className="text-[16px] mt-3 mb-0">
              {meta ? meta.action : 'Neither eye could be graded — refer for manual examination.'}
            </p>

            <div className="grid grid-cols-5 gap-px bg-line hairline rounded-control overflow-hidden mt-5">
              {GRADES.map((g) => {
                const active = worst === g.grade
                return (
                  <div
                    key={g.grade}
                    className="bg-surface px-2 py-2 text-center"
                    style={
                      active
                        ? { background: g.colorVar, color: 'var(--color-on-severity)' }
                        : undefined
                    }
                  >
                    <div className="tnum text-[16px] font-semibold leading-none">{g.grade}</div>
                    <div
                      className={`text-[10px] leading-tight mt-1 ${active ? 'text-on-severity/90' : 'text-muted'}`}
                    >
                      {g.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <span className="label">Macular oedema</span>
              <p
                className="text-[22px] font-semibold m-0 mt-1"
                style={{ color: DME_COLOR[worstDme] }}
              >
                {DME_SHORT[worstDme]}
              </p>
              <p className="text-[13px] text-muted m-0 mt-1">{DME_LABELS[worstDme]}</p>
            </div>
            <div className="pt-4 border-t border-line">
              <Facts
                cols={2}
                items={[
                  ['Urgency', plan.urgency],
                  ['Seen within', plan.within],
                  ['Next screening', plan.nextScreening],
                  [
                    'Lowest confidence',
                    screening.lowestConfidence !== null
                      ? screening.lowestConfidence.toFixed(2)
                      : '—',
                  ],
                ]}
              />
            </div>
          </div>
        </div>

        {screening.lowestConfidence !== null && screening.lowestConfidence < 0.7 && (
          <div className="mt-5">
            <Note tone="alert" title="Below the reporting threshold">
              At least one eye scored under 0.70 confidence, so no grade was reported to the field
              worker and the case was escalated for clinician review.
            </Note>
          </div>
        )}
      </section>

      {/* --- eyes --- */}
      <div className="grid md:grid-cols-2 gap-4">
        <EyeCard exam={screening.eyes.right} />
        <EyeCard exam={screening.eyes.left} />
      </div>

      {/* --- patient --- */}
      <Card n="01" title="Patient" aside={screening.site}>
        <Facts
          items={[
            ['Name', p.name],
            ['Patient ref', p.patientRef],
            ['Age / sex', `${p.age} / ${p.sex}`],
            ['Diabetes duration', `${p.yearsSinceDiagnosis} years`],
          ]}
        />
      </Card>

      {/* --- risk --- */}
      <Card n="02" title="Risk factors" aside="Recorded at the camera">
        <Facts
          items={[
            [
              'HbA1c',
              p.hba1c !== null ? (
                <span style={{ color: p.hba1c >= 8 ? 'var(--color-alert)' : undefined }}>
                  {p.hba1c.toFixed(1)} %
                </span>
              ) : (
                'Not recorded'
              ),
            ],
            [
              'Blood pressure',
              p.systolic && p.diastolic ? `${p.systolic} / ${p.diastolic} mmHg` : 'Not recorded',
            ],
            ['Hypertension', p.hypertension ? 'Yes' : 'No'],
            ['Smoker', p.smoker ? 'Yes' : 'No'],
          ]}
        />
        {p.hba1c !== null && p.hba1c >= 8 && (
          <p className="text-[13px] mt-4 mb-0" style={{ color: 'var(--color-alert)' }}>
            HbA1c above 8.0% — glycaemic control is a contributing factor and should be addressed
            alongside any ophthalmic referral.
          </p>
        )}
      </Card>

      {/* --- decision --- */}
      <Card n="03" title="Clinician decision">
        {review ? (
          <>
            <Facts
              items={[
                [
                  'Decision',
                  review.decision === 'refer'
                    ? 'Referral confirmed'
                    : review.decision === 'no_refer'
                      ? 'No referral'
                      : 'Ungradable — manual examination',
                ],
                ['Agrees with model', review.disagreedWithModel ? 'No' : 'Yes'],
                ['Reason for difference', review.reason ?? '—'],
                ['Decided', `${fmtDate(review.decidedAt)} · ${fmtTime(review.decidedAt)}`],
              ]}
            />
            <p className="text-[14px] mt-4 mb-0">
              Signed by <strong>{review.clinicianName}</strong>
            </p>
          </>
        ) : (
          <Note title="Awaiting clinician review">
            This report is not valid for referral until a clinician signs it. The downloaded PDF
            carries signature lines.
          </Note>
        )}
      </Card>

      {/* --- audit --- */}
      <Card n="04" title="Model and audit trail">
        <Facts
          items={[
            ['Model version', MODEL_VERSION],
            [
              'Target operating point',
              `Sens ${(op.sensitivity * 100).toFixed(0)}% / Spec ${(op.specificity * 100).toFixed(0)}%`,
            ],
            ['Reporting threshold', 'Confidence ≥ 0.70'],
            ['Captured', fmtTime(screening.createdAt)],
            ['Analysed', analysedAt ? fmtTime(analysedAt) : 'Not analysed'],
            ['Reviewed', review ? fmtTime(review.decidedAt) : 'Pending'],
            ['Turnaround', turnaround !== null ? `${turnaround} min` : '—'],
            ['Upload state', screening.synced ? 'Synced' : 'Held on device'],
          ]}
        />
        <p className="label mt-5">
          Model status: {VALIDATION.dataset}. Reference clinician {CLINICIAN_NAME}. Downloads as{' '}
          <span className="font-mono">{reportFilename(screening)}</span>.
        </p>
      </Card>

      <p className="label pb-4">
        AI-assisted screening result, not a diagnosis. A clinician confirms every referral. Grading
        follows the International Clinical Diabetic Retinopathy severity scale. Fundus images in
        this prototype are synthetic.
      </p>
    </div>
  )
}
