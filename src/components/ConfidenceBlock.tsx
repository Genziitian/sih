import type { AnalysisResult } from '../types'
import { Bar } from './ui'

const BAND_COLOR: Record<AnalysisResult['confidenceBand'], string> = {
  high: 'var(--color-primary)',
  moderate: 'var(--color-g2)',
  low: 'var(--color-alert)',
}

export function ConfidenceBlock({ analysis }: { analysis: AnalysisResult }) {
  const color = BAND_COLOR[analysis.confidenceBand]
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label">Model confidence</span>
        <span className="tnum text-[18px] font-medium" style={{ color }}>
          {analysis.confidence.toFixed(2)}
        </span>
      </div>
      <div className="mt-2">
        <Bar value={analysis.confidence} color={color} />
      </div>
      <p className="text-[13px] text-muted mt-2">{analysis.confidenceNote}</p>
    </div>
  )
}
