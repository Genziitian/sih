import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EyeSide, LesionType } from '../types'
import { useStore } from '../store'
import { LOW_CONFIDENCE_THRESHOLD, gradeMeta } from '../lib/grading'
import { FundusViewer, type OverlayMode } from '../components/FundusViewer'
import { OverlaySelector } from '../components/OverlaySelector'
import { ImageUploader } from '../components/ImageUploader'
import { QualityMeter } from '../components/QualityMeter'
import { SeverityStrip } from '../components/SeverityStrip'
import { ConfidenceBlock } from '../components/ConfidenceBlock'
import { LesionList } from '../components/LesionList'
import { PatientStrip } from '../components/PatientStrip'
import { EyeSelector } from '../components/EyeSelector'
import { Button, Note, Panel } from '../components/ui'

export function NewScreening() {
  const navigate = useNavigate()
  const draft = useStore((s) => s.draft)
  const online = useStore((s) => s.online)
  const setPatient = useStore((s) => s.setPatient)
  const setSite = useStore((s) => s.setSite)
  const setActiveEye = useStore((s) => s.setActiveEye)
  const attachImage = useStore((s) => s.attachImage)
  const clearEye = useStore((s) => s.clearEye)
  const overrideQuality = useStore((s) => s.overrideQuality)
  const runAnalysis = useStore((s) => s.runAnalysis)
  const submitForReview = useStore((s) => s.submitForReview)
  const resetDraft = useStore((s) => s.resetDraft)

  const [mode, setMode] = useState<OverlayMode>('original')
  const [opacity, setOpacity] = useState(0.7)
  const [highlight, setHighlight] = useState<LesionType | null>(null)
  const [sent, setSent] = useState<{ id: string; offline: boolean } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const side = draft.activeEye
  const eye = draft.eyes[side]
  const analysis = eye?.analysis ?? null
  const running = eye?.analysisState === 'running'
  const unavailable = eye?.analysisState === 'unavailable'

  const lowConfidence =
    !!analysis && !analysis.ungradable && analysis.confidence < LOW_CONFIDENCE_THRESHOLD

  const bothUngradable = useMemo(() => {
    const analyses = (['right', 'left'] as EyeSide[])
      .map((s) => draft.eyes[s]?.analysis)
      .filter(Boolean)
    return analyses.length === 2 && analyses.every((a) => a!.ungradable)
  }, [draft.eyes])

  const analysedCount = (['right', 'left'] as EyeSide[]).filter(
    (s) => draft.eyes[s]?.analysis,
  ).length
  const canSend = analysedCount > 0 && !running

  const switchEye = (next: EyeSide) => {
    setActiveEye(next)
    setMode('original')
    setHighlight(null)
  }

  const send = async () => {
    setSubmitting(true)
    const wasOffline = !online
    const id = await submitForReview()
    setSent({ id, offline: wasOffline })
    setSubmitting(false)
  }

  /* --- after submission ------------------------------------------------- */
  if (sent) {
    return (
      <div className="max-w-2xl mx-auto">
        <Panel title="Screening sent">
          <Note tone="good" title={sent.offline ? 'Saved on this device' : 'Sent for clinician review'}>
            {sent.offline
              ? `${sent.id} is queued in Pending sync. It uploads automatically when you go back online.`
              : `${sent.id} is now in the ophthalmologist's queue.`}
          </Note>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant="primary"
              onClick={() => {
                setSent(null)
                resetDraft()
                setMode('original')
                setHighlight(null)
              }}
            >
              Start next screening
            </Button>
            <Button onClick={() => navigate(`/report/${sent.id}`)}>Download report</Button>
            {sent.offline ? (
              <Button onClick={() => navigate('/pending')}>Open pending sync</Button>
            ) : (
              <Button onClick={() => navigate('/queue')}>Open review queue</Button>
            )}
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Panel title="Screening" aside={draft.site}>
        <PatientStrip
          screeningId={draft.id}
          patient={draft.patient}
          site={draft.site}
          onPatient={setPatient}
          onSite={setSite}
        />
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <EyeSelector
            value={side}
            onChange={switchEye}
            captured={{ right: !!draft.eyes.right, left: !!draft.eyes.left }}
            disabled={running}
          />
          <p className="label max-w-md">
            {analysedCount === 2
              ? 'Both eyes captured and analysed.'
              : analysedCount === 1
                ? 'One eye done. Capture the other eye for a complete screening.'
                : 'Capture the right eye first, then switch to the left.'}
          </p>
        </div>
      </Panel>

      {bothUngradable && (
        <Note tone="alert" title="Both eyes could not be graded.">
          Neither image carries enough signal for the model or a remote reader. This patient needs a
          slit-lamp examination — do not send them home as screened.
        </Note>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* --- image column --- */}
        <div className="space-y-3">
          {eye && (
            <OverlaySelector
              mode={mode}
              onChange={setMode}
              opacity={opacity}
              onOpacity={setOpacity}
              disabled={!analysis || running}
            />
          )}

          <div className="relative">
            {running && (
              <div className="absolute inset-x-0 -top-1 h-0.5 bg-line overflow-hidden z-10">
                <div className="h-full w-1/3 bg-primary animate-[slide_1.2s_ease-in-out_infinite]" />
              </div>
            )}
            {eye ? (
              <FundusViewer
                src={eye.imageSrc}
                lesions={analysis?.lesions ?? []}
                attention={analysis?.attention ?? []}
                mode={analysis ? mode : 'original'}
                opacity={opacity}
                highlight={highlight}
                caption={`${side === 'right' ? 'Right' : 'Left'} eye fundus photograph`}
              />
            ) : (
              <ImageUploader
                side={side}
                onPick={(src, label, caseId) => void attachImage(side, src, label, caseId)}
              />
            )}
          </div>

          {eye && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="label truncate max-w-[60%]">{eye.imageLabel}</span>
              <Button
                compact
                disabled={running}
                onClick={() => {
                  clearEye(side)
                  setMode('original')
                  setHighlight(null)
                }}
              >
                Retake
              </Button>
            </div>
          )}

          {analysis && !analysis.ungradable && !eye?.imageSrc.startsWith('fundus://') && (
            <p className="label">
              Overlay positions on an uploaded photograph are illustrative in this prototype.
            </p>
          )}
        </div>

        {/* --- panel column --- */}
        <div className="space-y-4">
          {!eye && (
            <Panel title="Before you capture">
              <ul className="m-0 pl-4 text-[14px] space-y-2 text-muted">
                <li>Dim the room and let the patient dark-adapt for two minutes.</li>
                <li>Centre on the macula, with the optic disc inside the frame.</li>
                <li>Ask the patient to blink fully, then hold still.</li>
              </ul>
            </Panel>
          )}

          {eye && !analysis && !unavailable && (
            <Panel title="Image quality check">
              <QualityMeter quality={eye.quality} checking={eye.checkingQuality} />
              <div className="mt-4 grid gap-2">
                {eye.quality?.verdict === 'good' || eye.overridden ? (
                  <Button
                    variant="primary"
                    block
                    disabled={running || eye.checkingQuality}
                    onClick={() => void runAnalysis(side)}
                  >
                    {running ? 'Analysing…' : 'Run analysis'}
                  </Button>
                ) : eye.quality ? (
                  <>
                    <Button
                      variant="primary"
                      block
                      onClick={() => {
                        clearEye(side)
                        setMode('original')
                      }}
                    >
                      Retake
                    </Button>
                    <Button block onClick={() => overrideQuality(side)}>
                      {eye.quality.verdict === 'ungradable'
                        ? 'Continue and flag as ungradable'
                        : 'Use anyway and flag for review'}
                    </Button>
                  </>
                ) : null}
              </div>
              {running && (
                <p className="label mt-3" aria-live="polite">
                  Running the model on this image. Do not navigate away.
                </p>
              )}
            </Panel>
          )}

          {unavailable && (
            <Panel title="Analysis">
              <Note tone="alert" title="Analysis is unavailable.">
                Your images are saved and will be processed automatically. You can finish this
                screening and move on to the next patient.
              </Note>
              <div className="grid gap-2 mt-4">
                <Button variant="primary" block onClick={() => void runAnalysis(side)}>
                  Try again
                </Button>
              </div>
            </Panel>
          )}

          {analysis && analysis.ungradable && (
            <Panel title="Result">
              <SeverityStrip grade={null} ungradable />
              <p className="text-[20px] font-medium mt-3 mb-1">Ungradable</p>
              <Note tone="alert" title={analysis.action}>
                {analysis.quality.message}
              </Note>
              <div className="mt-4">
                <ConfidenceBlock analysis={analysis} />
              </div>
            </Panel>
          )}

          {analysis && !analysis.ungradable && lowConfidence && (
            <Panel title="Result">
              <Note tone="alert" title="Sent for priority review">
                Please prioritise clinician review. The model is not confident enough for this image
                to be reported as a grade.
              </Note>
              <div className="mt-4">
                <ConfidenceBlock analysis={analysis} />
              </div>
              <p className="text-[13px] text-muted mt-3">
                The attention map and lesion outlines are still available on the image, so the
                clinician can see what the model was looking at.
              </p>
            </Panel>
          )}

          {analysis && !analysis.ungradable && !lowConfidence && (
            <>
              <Panel title="AI-assisted screening result">
                <SeverityStrip grade={analysis.grade} />
                <p
                  className="text-[26px] leading-tight font-medium mt-3 mb-2"
                  style={{ color: gradeMeta(analysis.grade!).colorVar }}
                >
                  {analysis.gradeLabel}
                </p>
                <Note tone={analysis.referralSuggested ? 'alert' : 'good'} title={analysis.action}>
                  {analysis.referralSuggested
                    ? 'A clinician confirms this referral before the patient is contacted.'
                    : 'No referral suggested at this screening.'}
                </Note>
                <div className="mt-4">
                  <ConfidenceBlock analysis={analysis} />
                </div>
              </Panel>

              <Panel title="Findings">
                <LesionList
                  findings={analysis.findings}
                  selected={highlight}
                  onSelect={(t) => {
                    setHighlight(t)
                    if (t) setMode('lesions')
                  }}
                />
              </Panel>
            </>
          )}

          {analysis && (
            <Note title="This is an AI-assisted screening result, not a diagnosis.">
              A clinician confirms every referral.
            </Note>
          )}

          <div className="grid gap-2 sticky bottom-4">
            <Button
              variant="primary"
              block
              disabled={!canSend || submitting}
              onClick={() => void send()}
            >
              {bothUngradable
                ? 'Refer for manual examination'
                : submitting
                  ? 'Sending…'
                  : online
                    ? 'Send for review'
                    : 'Save on this device'}
            </Button>
            <Button block disabled={!canSend} onClick={() => navigate('/report/draft')}>
              Download report
            </Button>
          </div>
        </div>
      </div>

      <style>{`@keyframes slide { 0% { transform: translateX(-100%) } 100% { transform: translateX(400%) } }`}</style>
    </div>
  )
}

