import type { Grade } from '../types'
import { GRADES, UNGRADABLE_COLOR } from '../lib/grading'

/** Severity is never colour-only: the number and the word carry it too. */
export function SeverityStrip({
  grade,
  ungradable = false,
}: {
  grade: Grade | null
  ungradable?: boolean
}) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-px bg-line hairline rounded-[4px] overflow-hidden">
        {GRADES.map((g) => {
          const active = !ungradable && grade === g.grade
          return (
            <div
              key={g.grade}
              aria-current={active ? 'true' : undefined}
              className="bg-surface px-1.5 py-2 text-center"
              style={active ? { background: g.colorVar, color: '#fff' } : undefined}
            >
              <div className="tnum text-[15px] font-semibold leading-none">{g.grade}</div>
              <div
                className={`text-[10.5px] leading-tight mt-1 ${active ? 'text-white/90' : 'text-muted'}`}
              >
                {g.label}
              </div>
            </div>
          )
        })}
      </div>
      {ungradable && (
        <div
          className="mt-2 text-[13px] font-medium"
          style={{ color: UNGRADABLE_COLOR }}
        >
          Outside the scale — image could not be graded
        </div>
      )}
    </div>
  )
}
