import { useMemo, useState } from 'react'
import { reviewQueue, useStore } from '../store'
import { PROGRAMME_STATS } from '../demo/seed'
import { SITES } from '../demo/cases'
import { pct } from '../lib/grading'
import { DEFAULT_THRESHOLD_INDEX, simulate, type SimInputs } from '../lib/simulation'
import { SimulationControls } from '../components/SimulationControls'
import { BacklogChart } from '../components/BacklogChart'
import { SiteTable } from '../components/SiteTable'
import { Metric, Panel, Row } from '../components/ui'

export function Dashboard() {
  const screenings = useStore((s) => s.screenings)
  const audit = useStore((s) => s.audit)

  const [inputs, setInputs] = useState<SimInputs>({
    arrivalsPerDay: 180,
    reviewsPerDay: 40,
    thresholdIndex: DEFAULT_THRESHOLD_INDEX,
  })

  const sim = useMemo(() => simulate(inputs), [inputs])
  const queue = useMemo(() => reviewQueue(screenings), [screenings])
  const decided = screenings.filter((s) => s.status === 'completed')
  const disagreements = decided.filter((s) => s.review?.disagreedWithModel).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[18px] font-semibold m-0">District programme</h1>
        <p className="label m-0">Vellore district · six screening sites · week 23</p>
      </div>

      <Panel bodyClass="px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-line -mx-4">
          {[
            {
              label: 'Screenings this week',
              value: PROGRAMME_STATS.screeningsThisWeek.toLocaleString('en-IN'),
              note: '+4.7% on last week',
            },
            {
              label: 'Referral rate',
              value: pct(PROGRAMME_STATS.referralRate),
              note: 'Within the 10–15% expected band',
            },
            {
              label: 'Median time to clinician review',
              value: `${PROGRAMME_STATS.medianReviewMinutes} min`,
              note: `${queue.length} cases waiting now`,
            },
            {
              label: 'Images rejected for quality',
              value: pct(PROGRAMME_STATS.imagesRejected),
              note: 'Two sites drive most of this',
              tone: 'var(--color-alert)',
            },
          ].map((m) => (
            <div key={m.label} className="px-4">
              <Metric label={m.label} value={m.value} note={m.note} tone={m.tone} />
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Panel title="Workflow simulation" aside="12 weeks">
          <SimulationControls
            inputs={inputs}
            onChange={(patch) => setInputs((s) => ({ ...s, ...patch }))}
          />
        </Panel>

        <div className="space-y-4">
          <Panel bodyClass="p-4">
            <p className="text-[17px] leading-snug m-0">
              At this threshold,{' '}
              <strong className="tnum">{sim.missedPer100} in 100</strong> referable cases are missed
              and your ophthalmologist reviews{' '}
              <strong className="tnum">{sim.referralsPerWeek.toLocaleString('en-IN')} cases</strong>{' '}
              a week.{' '}
              {sim.clears ? (
                <span style={{ color: 'var(--color-primary)' }}>
                  Current capacity clears that every week.
                </span>
              ) : (
                <span style={{ color: 'var(--color-alert)' }}>
                  Capacity is short by{' '}
                  {(sim.referralsPerWeek - sim.capacityPerWeek).toLocaleString('en-IN')} cases a
                  week, so the backlog grows.
                </span>
              )}
            </p>
          </Panel>

          <Panel bodyClass="p-4">
            <BacklogChart sim={sim} />
            <div className="grid sm:grid-cols-2 gap-x-8 mt-4">
              <div>
                <Row
                  label="Cases referred per week"
                  value={sim.referralsPerWeek.toLocaleString('en-IN')}
                />
                <Row
                  label="— true positives"
                  value={sim.truePositivesPerWeek.toLocaleString('en-IN')}
                />
                <Row
                  label="— false positives"
                  value={sim.falsePositivesPerWeek.toLocaleString('en-IN')}
                />
              </div>
              <div>
                <Row label="Clinician hours needed per week" value={`${sim.clinicianHoursPerWeek} h`} />
                <Row
                  label="Review capacity per week"
                  value={sim.capacityPerWeek.toLocaleString('en-IN')}
                />
                <Row label="Referable cases missed per week" value={sim.missedPerWeek} />
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel
          title="Screening sites"
          aside="Sorted by rejection rate"
          bodyClass="p-0"
        >
          <SiteTable sites={SITES} />
        </Panel>

        <Panel title="Clinician activity">
          <Row label="Cases decided" value={decided.length} />
          <Row label="Awaiting review" value={queue.length} />
          <Row label="Decisions differing from model" value={disagreements} />
          <div className="mt-4">
            <div className="label mb-2">Recent audit trail</div>
            {audit.length === 0 ? (
              <p className="label m-0">No activity recorded in this session yet.</p>
            ) : (
              <ul className="m-0 p-0 list-none">
                {audit.slice(0, 6).map((a) => (
                  <li key={a.id} className="py-2 border-b border-line last:border-0">
                    <div className="text-[13px]">
                      <span className="font-mono">{a.screeningId}</span> · {a.event}
                    </div>
                    <div className="label">
                      {a.actor} · {a.detail}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
