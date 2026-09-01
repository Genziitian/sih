import type { Patient } from '../types'
import { SITES } from '../demo/cases'
import { Field, inputClass } from './ui'

export function PatientStrip({
  screeningId,
  patient,
  site,
  onPatient,
  onSite,
  readOnly = false,
}: {
  screeningId: string
  patient: Patient
  site: string
  onPatient?: (patch: Partial<Patient>) => void
  onSite?: (site: string) => void
  readOnly?: boolean
}) {
  if (readOnly) {
    return (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 m-0">
        {[
          ['Screening ID', screeningId],
          ['Patient', patient.name],
          ['Patient ref', patient.patientRef],
          ['Age', `${patient.age}`],
          ['Sex', patient.sex],
          ['Years since diagnosis', `${patient.yearsSinceDiagnosis}`],
          ['Camera site', site],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="label">{k}</dt>
            <dd className="m-0 text-[14px] tnum">{v}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <span className="label block mb-1">Screening ID</span>
        <div className="min-h-12 flex items-center px-3 bg-canvas hairline rounded-[4px] tnum font-mono text-[14px]">
          {screeningId}
        </div>
      </div>
      <Field label="Patient">
        <input
          className={inputClass}
          value={patient.name}
          onChange={(e) => onPatient?.({ name: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Age">
          <input
            type="number"
            min={1}
            max={120}
            className={`${inputClass} tnum`}
            value={patient.age}
            onChange={(e) => onPatient?.({ age: Number(e.target.value) })}
          />
        </Field>
        <Field label="Years with diabetes">
          <input
            type="number"
            min={0}
            max={70}
            className={`${inputClass} tnum`}
            value={patient.yearsSinceDiagnosis}
            onChange={(e) => onPatient?.({ yearsSinceDiagnosis: Number(e.target.value) })}
          />
        </Field>
      </div>
      <Field label="Camera site">
        <select className={inputClass} value={site} onChange={(e) => onSite?.(e.target.value)}>
          {SITES.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
  )
}
