import type { Priority } from '../types'
import { PRIORITY_LABELS, PRIORITY_ORDER } from '../lib/grading'

export type QueueFilter = 'all' | Priority

export function QueueFilters({
  value,
  counts,
  onChange,
}: {
  value: QueueFilter
  counts: Record<QueueFilter, number>
  onChange: (f: QueueFilter) => void
}) {
  const options: QueueFilter[] = ['all', ...PRIORITY_ORDER]
  return (
    <div className="inline-flex hairline rounded-[4px] overflow-hidden" role="tablist">
      {options.map((o) => {
        const active = value === o
        return (
          <button
            key={o}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o)}
            className={[
              'min-h-11 px-3 text-[13px] font-medium border-r border-line last:border-r-0',
              active ? 'bg-primary text-white' : 'bg-surface hover:bg-canvas',
            ].join(' ')}
          >
            {o === 'all' ? 'All' : PRIORITY_LABELS[o]}
            <span className={`ml-2 tnum ${active ? 'text-white/75' : 'text-muted'}`}>
              {counts[o] ?? 0}
            </span>
          </button>
        )
      })}
    </div>
  )
}
