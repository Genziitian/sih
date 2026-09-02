import type { Findings, LesionType } from '../types'
import { LESION_COLORS, LESION_LABELS, LESION_ORDER } from '../lib/grading'

export function LesionList({
  findings,
  selected,
  onSelect,
}: {
  findings: Findings
  selected: LesionType | null
  onSelect: (t: LesionType | null) => void
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="label">Findings</span>
        {selected && (
          <button className="label underline" onClick={() => onSelect(null)}>
            Clear highlight
          </button>
        )}
      </div>
      <ul className="m-0 p-0 list-none">
        {LESION_ORDER.map((type) => {
          const count = findings[type]
          const active = selected === type
          return (
            <li key={type}>
              <button
                onClick={() => onSelect(active ? null : type)}
                disabled={count === 0}
                aria-pressed={active}
                className={[
                  'w-full min-h-12 flex items-center gap-3 px-2 -mx-2 rounded-control text-left',
                  'border-b border-line last:border-0',
                  count === 0 ? 'text-muted cursor-default' : 'hover:bg-canvas',
                  active ? 'bg-canvas' : '',
                ].join(' ')}
              >
                <span
                  className="inline-block w-3 h-3 rounded-full border-2 shrink-0"
                  style={{
                    borderColor: count === 0 ? 'var(--color-line)' : LESION_COLORS[type],
                  }}
                />
                <span className="flex-1 text-[14px]">{LESION_LABELS[type]}</span>
                <span className="tnum text-[15px] font-medium">{count}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="label mt-2">
        Select a finding to outline it on the image.
      </p>
    </div>
  )
}
