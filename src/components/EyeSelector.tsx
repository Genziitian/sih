import type { EyeSide } from '../types'

export function EyeSelector({
  value,
  onChange,
  captured,
  disabled = false,
}: {
  value: EyeSide
  onChange: (side: EyeSide) => void
  captured: Partial<Record<EyeSide, boolean>>
  disabled?: boolean
}) {
  return (
    <div>
      <span className="label block mb-1">Eye</span>
      <div className="inline-flex hairline rounded-control overflow-hidden">
        {(['right', 'left'] as EyeSide[]).map((side) => {
          const active = value === side
          return (
            <button
              key={side}
              onClick={() => onChange(side)}
              aria-pressed={active}
              disabled={disabled}
              className={[
                'min-h-12 px-5 text-[15px] font-medium border-r border-line last:border-r-0',
                'flex items-center gap-2',
                active ? 'bg-primary text-white' : 'bg-surface hover:bg-canvas',
                disabled ? 'opacity-60 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {side === 'right' ? 'Right' : 'Left'}
              {captured[side] && (
                <span
                  aria-label="captured"
                  className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-primary'}`}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
