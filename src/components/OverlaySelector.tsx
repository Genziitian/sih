import type { OverlayMode } from './FundusViewer'

const MODES: { id: OverlayMode; label: string; key: string }[] = [
  { id: 'original', label: 'Original', key: 'O' },
  { id: 'attention', label: 'Attention map', key: 'A' },
  { id: 'lesions', label: 'Lesions', key: 'L' },
]

export function OverlaySelector({
  mode,
  onChange,
  opacity,
  onOpacity,
  showKeys = false,
  disabled = false,
}: {
  mode: OverlayMode
  onChange: (m: OverlayMode) => void
  opacity: number
  onOpacity: (v: number) => void
  showKeys?: boolean
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex hairline rounded-control overflow-hidden" role="tablist">
        {MODES.map((m) => {
          const active = mode === m.id
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={active}
              disabled={disabled}
              onClick={() => onChange(m.id)}
              className={[
                'min-h-11 px-3 text-[13px] font-medium border-r border-line last:border-r-0',
                'disabled:text-muted disabled:cursor-not-allowed',
                active ? 'bg-primary text-white' : 'bg-surface hover:bg-canvas',
              ].join(' ')}
            >
              {m.label}
              {showKeys && (
                <span className={`ml-2 font-mono text-[11px] ${active ? 'opacity-80' : 'text-muted'}`}>
                  {m.key}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <label className="flex items-center gap-2 flex-1 min-w-48">
        <span className="label whitespace-nowrap">Overlay opacity</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(opacity * 100)}
          disabled={disabled || mode === 'original'}
          onChange={(e) => onOpacity(Number(e.target.value) / 100)}
          aria-label="Overlay opacity"
          className="flex-1 disabled:opacity-40"
        />
        <span className="tnum label w-9 text-right">{Math.round(opacity * 100)}%</span>
      </label>
    </div>
  )
}
