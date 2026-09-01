import { useMemo } from 'react'
import type { AttentionBlob, Lesion, LesionType } from '../types'
import { LESION_COLORS, LESION_LABELS } from '../lib/grading'
import { resolveFundusSrc } from '../demo/fundus'

export type OverlayMode = 'original' | 'attention' | 'lesions'

function heatColor(weight: number) {
  if (weight >= 0.78) return '#d92b1c'
  if (weight >= 0.6) return '#e8801f'
  if (weight >= 0.45) return '#dfc41f'
  return '#2f6fbf'
}

function AttentionLayer({ blobs, opacity }: { blobs: AttentionBlob[]; opacity: number }) {
  return (
    <svg
      viewBox="0 0 1000 1000"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity }}
      aria-hidden
    >
      <defs>
        <filter id="heat-blur">
          <feGaussianBlur stdDeviation="26" />
        </filter>
        {blobs.map((b, i) => (
          <radialGradient key={i} id={`heat-${i}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={heatColor(b.weight)} stopOpacity={b.weight} />
            <stop offset="55%" stopColor={heatColor(b.weight)} stopOpacity={b.weight * 0.45} />
            <stop offset="100%" stopColor={heatColor(b.weight)} stopOpacity="0" />
          </radialGradient>
        ))}
        <clipPath id="heat-clip">
          <circle cx="500" cy="500" r="470" />
        </clipPath>
      </defs>
      <g clipPath="url(#heat-clip)" filter="url(#heat-blur)">
        {blobs.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={`url(#heat-${i})`} />
        ))}
      </g>
    </svg>
  )
}

function LesionLayer({
  lesions,
  opacity,
  highlight,
}: {
  lesions: Lesion[]
  opacity: number
  highlight: LesionType | null
}) {
  return (
    <svg
      viewBox="0 0 1000 1000"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity }}
      aria-hidden
    >
      {lesions.map((l) => {
        const dim = highlight !== null && highlight !== l.type
        const r = Math.max(l.r + 7, 12)
        return (
          <g key={l.id} opacity={dim ? 0.12 : 1}>
            <circle
              cx={l.x}
              cy={l.y}
              r={r}
              fill="none"
              stroke={LESION_COLORS[l.type]}
              strokeWidth={highlight === l.type ? 4.5 : 3}
            />
            {highlight === l.type && (
              <circle cx={l.x} cy={l.y} r={r + 9} fill="none" stroke={LESION_COLORS[l.type]}
                strokeWidth="1.5" strokeDasharray="6 6" opacity="0.8" />
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function FundusViewer({
  src,
  lesions = [],
  attention = [],
  mode,
  opacity,
  highlight = null,
  caption,
  className = '',
}: {
  src: string
  lesions?: Lesion[]
  attention?: AttentionBlob[]
  mode: OverlayMode
  opacity: number
  highlight?: LesionType | null
  caption?: string
  className?: string
}) {
  const resolved = useMemo(() => resolveFundusSrc(src), [src])

  return (
    <figure className={`m-0 ${className}`}>
      <div className="relative aspect-square w-full bg-[#080603] hairline overflow-hidden">
        <img
          src={resolved}
          alt={caption ?? 'Fundus photograph'}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        {mode === 'attention' && <AttentionLayer blobs={attention} opacity={opacity} />}
        {mode === 'lesions' && (
          <LesionLayer lesions={lesions} opacity={opacity} highlight={highlight} />
        )}
      </div>
      {mode === 'lesions' && lesions.length > 0 && (
        <figcaption className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {[...new Set(lesions.map((l) => l.type))].map((t) => (
            <span key={t} className="flex items-center gap-1.5 label">
              <span
                className="inline-block w-3 h-3 rounded-full border-2"
                style={{ borderColor: LESION_COLORS[t] }}
              />
              {LESION_LABELS[t]}
            </span>
          ))}
        </figcaption>
      )}
      {mode === 'attention' && (
        <figcaption className="flex items-center gap-2 mt-2 label">
          <span>Low attention</span>
          <span className="flex-1 h-2 max-w-40" style={{
            background: 'linear-gradient(90deg,#2f6fbf,#dfc41f,#e8801f,#d92b1c)',
          }} />
          <span>High attention</span>
        </figcaption>
      )}
    </figure>
  )
}
