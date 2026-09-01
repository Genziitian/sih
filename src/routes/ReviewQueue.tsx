import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Screening } from '../types'
import { reviewQueue, useStore } from '../store'
import {
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  UNGRADABLE_COLOR,
  elapsedLabel,
  gradeMeta,
} from '../lib/grading'
import { QueueFilters, type QueueFilter } from '../components/QueueFilters'
import { Panel } from '../components/ui'

function gradeCell(s: Screening) {
  if (s.worstGrade === null) {
    return <span style={{ color: UNGRADABLE_COLOR }}>Ungradable</span>
  }
  const meta = gradeMeta(s.worstGrade)
  return (
    <span style={{ color: meta.colorVar }} className="font-medium">
      {meta.short} · {meta.label.toLowerCase()}
    </span>
  )
}

export function ReviewQueue() {
  const navigate = useNavigate()
  const screenings = useStore((s) => s.screenings)
  const completed = useStore((s) => s.screenings.filter((x) => x.status === 'completed').length)
  const [filter, setFilter] = useState<QueueFilter>('all')

  const queue = useMemo(() => reviewQueue(screenings), [screenings])

  const counts = useMemo(() => {
    const base: Record<QueueFilter, number> = {
      all: queue.length,
      referable: 0,
      low_confidence: 0,
      ungradable: 0,
      routine: 0,
    }
    for (const s of queue) base[s.priority] += 1
    return base
  }, [queue])

  const rows = filter === 'all' ? queue : queue.filter((s) => s.priority === filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold m-0">Review queue</h1>
          <p className="label m-0">
            Ordered by clinical priority: referable, then low confidence, then ungradable.{' '}
            {completed > 0 && `${completed} decided today.`}
          </p>
        </div>
        <QueueFilters value={filter} counts={counts} onChange={setFilter} />
      </div>

      <Panel bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[820px]">
            <thead>
              <tr className="border-b border-line">
                {[
                  'Screening ID',
                  'Age',
                  'Camera site',
                  'Suggested grade',
                  'Confidence',
                  'Time waiting',
                  'Status',
                ].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={`py-2 px-3 label font-normal ${i > 3 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.id}
                  tabIndex={0}
                  role="link"
                  onClick={() => navigate(`/queue/${s.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/queue/${s.id}`)
                    }
                  }}
                  className="border-b border-line last:border-0 cursor-pointer hover:bg-canvas focus:bg-canvas"
                >
                  <td className="py-2.5 px-3 font-mono text-[13px]">{s.id}</td>
                  <td className="py-2.5 px-3 text-[14px] tnum">{s.patient.age}</td>
                  <td className="py-2.5 px-3 text-[14px]">{s.site}</td>
                  <td className="py-2.5 px-3 text-[14px]">{gradeCell(s)}</td>
                  <td className="py-2.5 px-3 text-[14px] tnum text-right">
                    {s.lowestConfidence === null ? '—' : s.lowestConfidence.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-[14px] tnum text-right">
                    {elapsedLabel(s.createdAt)}
                  </td>
                  <td className="py-2.5 px-3 text-[14px] text-right">
                    <span
                      className="inline-block"
                      style={{
                        color:
                          s.priority === 'referable'
                            ? 'var(--color-alert)'
                            : s.priority === 'low_confidence'
                              ? 'var(--color-g2)'
                              : 'var(--color-muted)',
                      }}
                    >
                      {PRIORITY_LABELS[s.priority]}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 px-3 text-center label">
                    Nothing in this filter. The queue is clear for{' '}
                    {filter === 'all' ? 'now' : PRIORITY_LABELS[filter].toLowerCase()}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {PRIORITY_ORDER.map((p) => (
          <span key={p} className="label tnum">
            {PRIORITY_LABELS[p]}: {counts[p]}
          </span>
        ))}
      </div>
    </div>
  )
}
