import { useMemo } from 'react'
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
  followUp,
  gradeMeta,
  summarise,
  visualAcuityFor,
} from '../lib/grading'
import { CLINICIAN_NAME, FACILITY, MODEL_VERSION, VALIDATION } from '../demo/cases'
import { OPERATING_POINTS, DEFAULT_THRESHOLD_INDEX } from '../lib/simulation'
import { resolveFundusSrc } from '../demo/fundus'
import { Button } from '../components/ui'

function draftToScreening(draft: ReturnType<typeof useStore.getState>['draft']): Screening {
  const eyes: Screening['eyes'] = {}
  for (const side of ['right', 'left'] as EyeSide[]) {
    const e = draft.eyes[side]
    if (!e) continue
    const exam: EyeExam = {
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
    eyes[side] = exam
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

function Section({
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
    <section className="py-4 border-b border-line print-break">
      <header className="flex items-baseline gap-2.5 mb-3">
        <span className="font-mono text-[10px] text-muted">{n}</span>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] m-0">{title}</h2>
        {aside && <span className="label ml-auto">{aside}</span>}
      </header>
      {children}
    </section>
  )
}

function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 m-0">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="label">{k}</dt>
          <dd className="m-0 text-[13.5px] tnum">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** One eye, fully specified: image, acuity, capture quality, both grading axes. */
function EyeBlock({ exam }: { exam: EyeExam | undefined }) {
  if (!exam) {
    return (
      <div>
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] m-0 mb-2">
          Not captured
        </h3>
        <div className="aspect-square hairline bg-canvas flex items-center justify-center label">
          No image on file
        </div>
      </div>
    )
  }
  const a = exam.analysis
  const q = exam.quality
  const gradable = !!a && !a.ungradable

  const rows: [string, React.ReactNode][] = [
    ['Visual acuity', exam.visualAcuity],
    ['Gradable', !a ? 'Not analysed' : a.ungradable ? 'No' : 'Yes'],
    ['DR grade', !a ? '—' : a.ungradable ? 'Ungradable' : a.gradeLabel],
    [
      'Macular oedema',
      !gradable ? '—' : <span style={{ color: DME_COLOR[a!.dme] }}>{DME_SHORT[a!.dme]}</span>,
    ],
    ['Central subfield involved', !gradable ? '—' : a!.maculaInvolved ? 'Yes' : 'No'],
    ['Model confidence', a ? a.confidence.toFixed(2) : '—'],
    ['Focus', `${Math.round(q.focus * 100)}%`],
    ['Illumination', `${Math.round(q.illumination * 100)}%`],
    ['Field of view', `${Math.round(q.fieldOfView * 100)}%`],
    ['Quality flag', q.overridden ? 'Overridden by operator' : q.verdict === 'good' ? 'Passed' : q.message],
  ]

  return (
    <div className="print-break">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] m-0 mb-2">
        {exam.side === 'right' ? 'Right eye (OD)' : 'Left eye (OS)'}
      </h3>
      <img
        src={resolveFundusSrc(exam.imageSrc)}
        alt={`${exam.side} eye fundus photograph`}
        className="w-full aspect-square object-cover hairline"
      />

      <table className="w-full border-collapse mt-3">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-line last:border-0">
              <td className="py-1 label">{k}</td>
              <td className="py-1 text-[13px] tnum text-right">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {gradable && (
        <table className="w-full border-collapse mt-3">
          <thead>
            <tr>
              <th className="label text-left font-normal pb-1">Lesion counts</th>
              <th className="label text-right font-normal pb-1">n</th>
            </tr>
          </thead>
          <tbody>
            {LESION_ORDER.map((t) => (
              <tr key={t} className="border-b border-line last:border-0">
                <td className="py-1 text-[13px]">{LESION_LABELS[t]}</td>
                <td className="py-1 text-[13px] tnum text-right">{a!.findings[t]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function ReportView() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const screenings = useStore((s) => s.screenings)
  const outbox = useStore((s) => s.outbox)
  const draft = useStore((s) => s.draft)

  const screening = useMemo(() => {
    if (id === 'draft') return draftToScreening(draft)
    return screenings.find((s) => s.id === id) ?? outbox.find((s) => s.id === id) ?? null
  }, [id, screenings, outbox, draft])

  if (!screening) {
    return (
      <div className="night min-h-dvh max-w-xl mx-auto text-center py-16">
        <p className="text-[15px]">That screening is not on this device.</p>
        <Button className="mt-3" onClick={() => navigate('/queue')}>
          Back to queue
        </Button>
      </div>
    )
  }

  const { patient: p } = screening
  const worst = screening.worstGrade
  const worstMeta = worst !== null ? gradeMeta(worst) : null
  const review = screening.review

  const analyses = Object.values(screening.eyes)
    .map((e) => e?.analysis)
    .filter(Boolean)
  const worstDme = (['severe', 'moderate', 'mild', 'none'] as const).find((d) =>
    analyses.some((a) => a!.dme === d && !a!.ungradable),
  ) ?? 'none'
  const plan = followUp(worst, worstDme, new Date(screening.createdAt))

  const analysedAt = analyses.map((a) => a!.analysedAt).sort().pop() ?? null
  const turnaround =
    review && analysedAt
      ? Math.max(
          0,
          Math.round(
            (new Date(review.decidedAt).getTime() - new Date(screening.createdAt).getTime()) / 60000,
          ),
        )
      : null

  const op = OPERATING_POINTS[DEFAULT_THRESHOLD_INDEX]

  return (
    <div className="night min-h-dvh -m-5 -mx-4 px-4 py-5">
      <div className="max-w-[860px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 no-print">
          <Button compact onClick={() => navigate(-1)}>
            Back
          </Button>
          <Button compact variant="primary" onClick={() => window.print()}>
            Print / Save as PDF
          </Button>
        </div>

        {/* The sheet keeps the light clinical palette wherever it sits — it is
            the one thing here that reaches paper. */}
        <article className="paper print-page hairline rounded-panel p-8">
          <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
            <div>
              <h1 className="text-[17px] font-semibold m-0">{FACILITY}</h1>
              <p className="label m-0">
                Diabetic retinopathy screening report · ICDR severity scale
              </p>
            </div>
            <dl className="text-right m-0">
              <dt className="label">Screening ID</dt>
              <dd className="m-0 font-mono text-[14px]">{screening.id}</dd>
              <dt className="label mt-1">Screened</dt>
              <dd className="m-0 text-[13px] tnum">
                {fmtDate(screening.createdAt)} · {fmtTime(screening.createdAt)}
              </dd>
            </dl>
          </header>

          <Section n="01" title="Patient" aside={screening.site}>
            <Facts
              items={[
                ['Name', p.name],
                ['Patient ref', p.patientRef],
                ['Age / sex', `${p.age} / ${p.sex}`],
                ['Diabetes duration', `${p.yearsSinceDiagnosis} years`],
              ]}
            />
          </Section>

          <Section n="02" title="Risk factors" aside="Recorded at the camera">
            <Facts
              items={[
                ['HbA1c', p.hba1c !== null ? `${p.hba1c.toFixed(1)} %` : 'Not recorded'],
                [
                  'Blood pressure',
                  p.systolic && p.diastolic ? `${p.systolic} / ${p.diastolic} mmHg` : 'Not recorded',
                ],
                ['Hypertension', p.hypertension ? 'Yes' : 'No'],
                ['Smoker', p.smoker ? 'Yes' : 'No'],
              ]}
            />
            {p.hba1c !== null && p.hba1c >= 8 && (
              <p className="text-[12.5px] mt-3 mb-0" style={{ color: 'var(--color-alert)' }}>
                HbA1c above 8.0% — glycaemic control is a contributing factor and should be
                addressed alongside any ophthalmic referral.
              </p>
            )}
          </Section>

          <Section n="03" title="Examination" aside="Both eyes">
            <div className="grid sm:grid-cols-2 gap-6">
              <EyeBlock exam={screening.eyes.right} />
              <EyeBlock exam={screening.eyes.left} />
            </div>
          </Section>

          <Section n="04" title="Assessment" aside="Worst-eye rule">
            <div className="grid grid-cols-5 gap-px bg-line hairline overflow-hidden">
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
                    <div className="tnum text-[14px] font-semibold">{g.grade}</div>
                    <div className={`text-[10px] ${active ? 'text-on-severity/90' : 'text-muted'}`}>
                      {g.label}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mt-4">
              <div>
                <div className="label">Retinopathy</div>
                <p
                  className="text-[16px] font-semibold m-0"
                  style={{ color: worstMeta?.colorVar ?? 'var(--color-ungradable)' }}
                >
                  {worstMeta ? `${worstMeta.short} — ${worstMeta.label.toLowerCase()}` : 'Ungradable'}
                </p>
                <p className="text-[13px] m-0 mt-1">
                  {worstMeta
                    ? worstMeta.action
                    : 'Neither eye could be graded — refer for manual examination.'}
                </p>
              </div>
              <div>
                <div className="label">Macular oedema</div>
                <p className="text-[16px] font-semibold m-0" style={{ color: DME_COLOR[worstDme] }}>
                  {DME_SHORT[worstDme]}
                </p>
                <p className="text-[13px] m-0 mt-1">{DME_LABELS[worstDme]}</p>
              </div>
            </div>

            <p className="label mt-3">
              Lowest model confidence across both eyes:{' '}
              <span className="tnum">
                {screening.lowestConfidence !== null
                  ? screening.lowestConfidence.toFixed(2)
                  : '—'}
              </span>
              {screening.lowestConfidence !== null && screening.lowestConfidence < 0.7 && (
                <> — below the reporting threshold, escalated for clinician review.</>
              )}
            </p>
          </Section>

          <Section n="05" title="Referral and follow-up">
            <Facts
              items={[
                ['Urgency', plan.urgency],
                ['To be seen within', plan.within],
                ['Next screening due', plan.nextScreening],
                ['Priority band', screening.priority.replace('_', ' ')],
              ]}
            />
          </Section>

          <Section n="06" title="Clinician decision">
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
                <p className="text-[13px] mt-3 mb-0">
                  Signed by <strong>{review.clinicianName}</strong>
                </p>
              </>
            ) : (
              <>
                <p className="text-[13.5px] m-0">
                  Awaiting clinician review. This report is not valid for referral until signed
                  below.
                </p>
                <div className="grid grid-cols-3 gap-8 mt-10">
                  <div className="border-t border-ink pt-1 label">Clinician signature</div>
                  <div className="border-t border-ink pt-1 label">Registration no.</div>
                  <div className="border-t border-ink pt-1 label">Date</div>
                </div>
              </>
            )}
          </Section>

          <Section n="07" title="Model and audit trail">
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
          </Section>

          <footer className="pt-4 grid sm:grid-cols-2 gap-x-8 gap-y-1">
            <div className="label">Model status</div>
            <div className="text-[12px] sm:text-right">{VALIDATION.dataset}</div>
            <div className="label">Reference clinician</div>
            <div className="text-[12px] sm:text-right">{CLINICIAN_NAME}</div>
            <p className="label col-span-full mt-3 m-0">
              AI-assisted screening result, not a diagnosis. A clinician confirms every referral.
              Grading follows the International Clinical Diabetic Retinopathy severity scale.
              Fundus images in this prototype are synthetic.
            </p>
          </footer>
        </article>
      </div>
    </div>
  )
}
