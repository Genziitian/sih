import { useEffect, useState } from 'react'
import type { ClinicianDecision, DisagreementReason } from '../types'
import { Button, Kbd, Note } from './ui'

const REASONS: { id: DisagreementReason; label: string }[] = [
  { id: 'interpretation', label: 'Image interpretation differs' },
  { id: 'image_quality', label: 'Image quality concern' },
  { id: 'clinical_context', label: 'Clinical context' },
  { id: 'model_error', label: 'Model error' },
  { id: 'other', label: 'Other' },
]

const DECISIONS: { id: ClinicianDecision; label: string; key: string }[] = [
  { id: 'refer', label: 'Confirm referral', key: 'R' },
  { id: 'no_refer', label: 'Confirm no referral', key: 'N' },
  { id: 'ungradable', label: 'Mark ungradable', key: 'U' },
]

export function DecisionPanel({
  modelSuggestsReferral,
  pendingDecision,
  onPending,
  onCommit,
  busy,
}: {
  modelSuggestsReferral: boolean
  pendingDecision: ClinicianDecision | null
  onPending: (d: ClinicianDecision | null) => void
  onCommit: (d: ClinicianDecision, reason: DisagreementReason | null) => void
  busy: boolean
}) {
  const [reason, setReason] = useState<DisagreementReason | null>(null)

  const disagrees = (d: ClinicianDecision) =>
    (modelSuggestsReferral && d === 'no_refer') || (!modelSuggestsReferral && d === 'refer')

  useEffect(() => setReason(null), [pendingDecision])

  const choose = (d: ClinicianDecision) => {
    if (disagrees(d)) onPending(d)
    else onCommit(d, null)
  }

  return (
    <div className="border-t border-line pt-3">
      <div className="grid gap-2">
        {DECISIONS.map((d) => (
          <Button
            key={d.id}
            block
            disabled={busy}
            variant={
              pendingDecision === d.id ? 'primary' : d.id === 'refer' ? 'primary' : 'secondary'
            }
            onClick={() => choose(d.id)}
          >
            <span className="flex-1 text-left">{d.label}</span>
            <Kbd>{d.key}</Kbd>
          </Button>
        ))}
      </div>

      {pendingDecision && disagrees(pendingDecision) && (
        <div className="mt-3">
          <Note tone="alert" title="Why does your decision differ?">
            The model suggested {modelSuggestsReferral ? 'a referral' : 'no referral'}. Recording the
            reason is what makes the audit trail useful.
          </Note>
          <fieldset className="mt-2 border-0 p-0 m-0">
            <legend className="sr-only">Reason for differing from the model</legend>
            {REASONS.map((r) => (
              <label
                key={r.id}
                className="flex items-center gap-3 min-h-12 px-2 -mx-2 rounded-[4px] hover:bg-canvas cursor-pointer border-b border-line last:border-0"
              >
                <input
                  type="radio"
                  name="disagreement-reason"
                  value={r.id}
                  checked={reason === r.id}
                  onChange={() => setReason(r.id)}
                  className="accent-[var(--color-primary)] w-4 h-4"
                />
                <span className="text-[14px]">{r.label}</span>
              </label>
            ))}
          </fieldset>
          <div className="flex gap-2 mt-3">
            <Button
              variant="primary"
              disabled={!reason || busy}
              onClick={() => reason && onCommit(pendingDecision, reason)}
            >
              Save decision
            </Button>
            <Button onClick={() => onPending(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
          {!reason && (
            <p className="label mt-2">Select a reason to save this decision.</p>
          )}
        </div>
      )}
    </div>
  )
}
