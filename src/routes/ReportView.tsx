import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { EyeExam, EyeSide, Screening } from '../types'
import { useStore } from '../store'
import { GRADES, LESION_LABELS, LESION_ORDER, gradeMeta, summarise } from '../lib/grading'
import { FACILITY, MODEL_VERSION, VALIDATION } from '../demo/cases'
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

function EyeBlock({ exam }: { exam: EyeExam | undefined }) {
  if (!exam) {
    return (
      <div>
        <h3 className="text-[13px] font-semibold m-0 mb-2">Not captured</h3>
        <div className="aspect-square hairline bg-canvas flex items-center justify-center label">
          No image
        </div>
      </div>
    )
  }
  const a = exam.analysis
  return (
    <div className="print-break">
      <h3 className="text-[13px] font-semibold m-0 mb-2">
        {exam.side === 'right' ? 'Right eye' : 'Left eye'}
      </h3>
      <img
        src={resolveFundusSrc(exam.imageSrc)}
        alt={`${exam.side} eye fundus photograph`}
        className="w-full aspect-square object-cover hairline"
      />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 m-0">
        <dt className="label">Grade</dt>
        <dd className="m-0 text-[13px] text-right">
          {!a ? 'Not analysed' : a.ungradable ? 'Ungradable' : a.gradeLabel}
        </dd>
        <dt className="label">Model confidence</dt>
        <dd className="m-0 text-[13px] text-right tnum">{a ? a.confidence.toFixed(2) : '—'}</dd>
        <dt className="label">Image quality</dt>
        <dd className="m-0 text-[13px] text-right">
          {exam.quality.verdict === 'good' ? 'Usable' : exam.quality.message}
        </dd>
      </dl>
      {a && !a.ungradable && (
        <table className="w-full border-collapse mt-2">
          <tbody>
            {LESION_ORDER.map((t) => (
              <tr key={t} className="border-b border-line last:border-0">
                <td className="py-1 label">{LESION_LABELS[t]}</td>
                <td className="py-1 text-[13px] tnum text-right">{a.findings[t]}</td>
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
      <div className="max-w-xl mx-auto text-center py-16">
        <p className="text-[15px]">That screening is not on this device.</p>
        <Button className="mt-3" onClick={() => navigate('/queue')}>
          Back to queue
        </Button>
      </div>
    )
  }

  const worst = screening.worstGrade
  const worstMeta = worst !== null ? gradeMeta(worst) : null
  const review = screening.review

  return (
    <div className="max-w-[820px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 no-print">
        <Button compact onClick={() => navigate(-1)}>
          Back
        </Button>
        <Button compact variant="primary" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </div>

      <article className="print-page bg-surface hairline p-8">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-4">
          <div>
            <h1 className="text-[17px] font-semibold m-0">{FACILITY}</h1>
            <p className="label m-0">Diabetic retinopathy screening report</p>
          </div>
          <dl className="text-right m-0">
            <dt className="label">Screening ID</dt>
            <dd className="m-0 font-mono text-[14px]">{screening.id}</dd>
            <dt className="label mt-1">Date</dt>
            <dd className="m-0 text-[13px] tnum">
              {new Date(screening.createdAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </dd>
          </dl>
        </header>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-line">
          {[
            ['Patient', screening.patient.name],
            ['Patient ref', screening.patient.patientRef],
            ['Age / sex', `${screening.patient.age} / ${screening.patient.sex}`],
            ['Years with diabetes', String(screening.patient.yearsSinceDiagnosis)],
            ['Camera site', screening.site],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="label">{k}</div>
              <div className="text-[14px]">{v}</div>
            </div>
          ))}
        </section>

        <section className="grid sm:grid-cols-2 gap-6 py-4 border-b border-line">
          <EyeBlock exam={screening.eyes.right} />
          <EyeBlock exam={screening.eyes.left} />
        </section>

        <section className="py-4 border-b border-line print-break">
          <h2 className="text-[13px] font-semibold m-0 mb-2">Worst-eye result</h2>
          <div className="grid grid-cols-5 gap-px bg-line hairline overflow-hidden">
            {GRADES.map((g) => {
              const active = worst === g.grade
              return (
                <div
                  key={g.grade}
                  className="bg-surface px-2 py-2 text-center"
                  style={active ? { background: g.colorVar, color: '#fff' } : undefined}
                >
                  <div className="tnum text-[14px] font-semibold">{g.grade}</div>
                  <div className={`text-[10px] ${active ? 'text-white/90' : 'text-muted'}`}>
                    {g.label}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[15px] font-medium mt-3 mb-1">
            {worstMeta ? `${worstMeta.short} — ${worstMeta.label.toLowerCase()}` : 'Ungradable'}
          </p>
          <p className="text-[14px] m-0">
            {worstMeta ? worstMeta.action : 'Refer for manual examination — neither eye could be graded.'}
          </p>
          <p className="label mt-1">
            Lowest model confidence across both eyes:{' '}
            <span className="tnum">
              {screening.lowestConfidence !== null ? screening.lowestConfidence.toFixed(2) : '—'}
            </span>
          </p>
        </section>

        <section className="py-4 border-b border-line print-break">
          <h2 className="text-[13px] font-semibold m-0 mb-2">Clinician decision</h2>
          {review ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 m-0">
              <dt className="label">Decision</dt>
              <dd className="m-0 text-[14px] text-right">
                {review.decision === 'refer'
                  ? 'Referral confirmed'
                  : review.decision === 'no_refer'
                    ? 'No referral'
                    : 'Ungradable — manual examination'}
              </dd>
              <dt className="label">Agrees with model</dt>
              <dd className="m-0 text-[14px] text-right">
                {review.disagreedWithModel ? `No — ${review.reason}` : 'Yes'}
              </dd>
              <dt className="label">Clinician</dt>
              <dd className="m-0 text-[14px] text-right">{review.clinicianName}</dd>
              <dt className="label">Timestamp</dt>
              <dd className="m-0 text-[13px] text-right tnum">
                {new Date(review.decidedAt).toLocaleString('en-GB')}
              </dd>
            </dl>
          ) : (
            <p className="text-[14px] m-0">
              Awaiting clinician review. This report is not valid until a clinician has signed the
              decision below.
            </p>
          )}
          {!review && (
            <div className="grid grid-cols-2 gap-8 mt-8">
              <div className="border-t border-line pt-1 label">Clinician signature</div>
              <div className="border-t border-line pt-1 label">Date</div>
            </div>
          )}
        </section>

        <footer className="pt-4 grid sm:grid-cols-2 gap-x-8 gap-y-1">
          <div className="label">Model version</div>
          <div className="text-[12px] text-right">{MODEL_VERSION}</div>
          <div className="label">Validation dataset</div>
          <div className="text-[12px] text-right">{VALIDATION.dataset}</div>
          <div className="label">Sensitivity</div>
          <div className="text-[12px] text-right tnum">
            {(VALIDATION.sensitivity * 100).toFixed(1)}%
          </div>
          <div className="label">Specificity</div>
          <div className="text-[12px] text-right tnum">
            {(VALIDATION.specificity * 100).toFixed(1)}%
          </div>
          <p className="label col-span-full mt-3 m-0">
            AI-assisted screening result, not a diagnosis. A clinician confirms every referral.
            Fundus images in this prototype are synthetic.
          </p>
        </footer>
      </article>
    </div>
  )
}
