import type { ImageQuality } from '../types'
import { Bar, Note } from './ui'

const ROWS: { key: keyof Pick<ImageQuality, 'focus' | 'illumination' | 'fieldOfView'>; label: string }[] = [
  { key: 'focus', label: 'Focus' },
  { key: 'illumination', label: 'Illumination' },
  { key: 'fieldOfView', label: 'Field of view' },
]

const toneFor = (v: number) =>
  v >= 0.75 ? 'var(--color-primary)' : v >= 0.5 ? 'var(--color-g2)' : 'var(--color-alert)'

export function QualityMeter({
  quality,
  checking,
}: {
  quality: ImageQuality | null
  checking: boolean
}) {
  return (
    <div>
      <div className="label mb-2">Image quality</div>
      <div className="space-y-2.5">
        {ROWS.map((r) => {
          const value = quality ? quality[r.key] : 0
          return (
            <div key={r.key} className="grid grid-cols-[110px_1fr_44px] items-center gap-3">
              <span className="text-[13px]">{r.label}</span>
              <Bar value={checking ? 0 : value} color={checking ? 'var(--color-line)' : toneFor(value)} />
              <span className="tnum label text-right">
                {checking || !quality ? '—' : `${Math.round(value * 100)}%`}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-3">
        {checking || !quality ? (
          <Note>Checking focus, illumination and field of view…</Note>
        ) : quality.verdict === 'good' ? (
          <Note tone="good" title={quality.message}>
            {quality.overridden ? 'Flagged for review by the worker.' : 'Ready for analysis.'}
          </Note>
        ) : (
          <Note tone="alert" title={quality.message}>
            {quality.verdict === 'ungradable'
              ? 'A retake is unlikely to help if the media stays hazy — refer for manual examination.'
              : 'A retake usually fixes this in under a minute.'}
          </Note>
        )}
      </div>
    </div>
  )
}
