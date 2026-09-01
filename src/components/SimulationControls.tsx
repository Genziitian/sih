import { OPERATING_POINTS, type SimInputs } from '../lib/simulation'

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  display: string
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <div className="py-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[14px]">{label}</span>
        <span className="tnum text-[15px] font-medium">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      {hint && <p className="label -mt-2">{hint}</p>}
    </div>
  )
}

export function SimulationControls({
  inputs,
  onChange,
}: {
  inputs: SimInputs
  onChange: (patch: Partial<SimInputs>) => void
}) {
  const point = OPERATING_POINTS[inputs.thresholdIndex]
  return (
    <div className="divide-y divide-line">
      <Slider
        label="Daily patient arrivals"
        value={inputs.arrivalsPerDay}
        min={20}
        max={600}
        step={10}
        display={`${inputs.arrivalsPerDay} / day`}
        onChange={(v) => onChange({ arrivalsPerDay: v })}
      />
      <Slider
        label="Ophthalmologist review capacity"
        value={inputs.reviewsPerDay}
        min={5}
        max={200}
        step={5}
        display={`${inputs.reviewsPerDay} cases / day`}
        onChange={(v) => onChange({ reviewsPerDay: v })}
      />
      <div className="py-1">
        <div className="flex items-baseline justify-between">
          <span className="text-[14px]">Operating threshold</span>
          <span className="tnum text-[15px] font-medium">
            Sensitivity {Math.round(point.sensitivity * 100)}% · Specificity{' '}
            {Math.round(point.specificity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={OPERATING_POINTS.length - 1}
          step={1}
          value={inputs.thresholdIndex}
          onChange={(e) => onChange({ thresholdIndex: Number(e.target.value) })}
          aria-label="Operating threshold"
          aria-valuetext={`Sensitivity ${Math.round(point.sensitivity * 100)} percent, specificity ${Math.round(point.specificity * 100)} percent`}
        />
        <p className="label -mt-2">
          Move right to catch more disease and refer more people. Move left to protect clinician
          time and miss more.
        </p>
      </div>
    </div>
  )
}
