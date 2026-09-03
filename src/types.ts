export type Role = 'field_worker' | 'ophthalmologist' | 'programme_officer'

export type EyeSide = 'left' | 'right'

/** ICDR severity scale. `null` means the image could not be graded. */
export type Grade = 0 | 1 | 2 | 3 | 4

export type LesionType =
  | 'microaneurysm'
  | 'haemorrhage'
  | 'hard_exudate'
  | 'neovascularisation'

/** Normalised to a 1000x1000 viewBox so overlays scale with the frame. */
export interface Lesion {
  id: string
  type: LesionType
  x: number
  y: number
  r: number
}

export interface AttentionBlob {
  x: number
  y: number
  r: number
  weight: number
}

export interface Findings {
  microaneurysm: number
  haemorrhage: number
  hard_exudate: number
  neovascularisation: number
}

export type QualityVerdict = 'good' | 'poor' | 'ungradable'

/**
 * Diabetic macular oedema. ICDR grades DME on its own axis alongside
 * retinopathy severity, because exudate near the fovea threatens central
 * vision at any DR grade.
 */
export type DmeGrade = 'none' | 'mild' | 'moderate' | 'severe'

export interface ImageQuality {
  focus: number
  illumination: number
  fieldOfView: number
  verdict: QualityVerdict
  message: string
  /** Set when the worker chose "use anyway" on a poor image. */
  overridden?: boolean
}

export interface AnalysisResult {
  grade: Grade | null
  /** Second grading axis — derived from exudate distance to the fovea. */
  dme: DmeGrade
  /** True when exudate sits inside the central subfield. */
  maculaInvolved: boolean
  gradeLabel: string
  confidence: number
  confidenceBand: 'high' | 'moderate' | 'low'
  confidenceNote: string
  referralSuggested: boolean
  action: string
  ungradable: boolean
  quality: ImageQuality
  findings: Findings
  lesions: Lesion[]
  attention: AttentionBlob[]
  modelVersion: string
  analysedAt: string
}

export interface EyeExam {
  side: EyeSide
  imageSrc: string
  imageLabel: string
  /** Snellen, recorded at the camera before capture. */
  visualAcuity: string
  quality: ImageQuality
  analysis: AnalysisResult | null
}

export type ScreeningStatus =
  | 'draft'
  | 'pending_sync'
  | 'analysis_pending'
  | 'awaiting_review'
  | 'completed'

export type Priority = 'referable' | 'low_confidence' | 'ungradable' | 'routine'

export type ClinicianDecision = 'refer' | 'no_refer' | 'ungradable'

export type DisagreementReason =
  | 'interpretation'
  | 'image_quality'
  | 'clinical_context'
  | 'model_error'
  | 'other'

export interface Review {
  decision: ClinicianDecision
  disagreedWithModel: boolean
  reason: DisagreementReason | null
  clinicianName: string
  decidedAt: string
}

export interface Patient {
  name: string
  age: number
  sex: 'F' | 'M' | 'Other'
  yearsSinceDiagnosis: number
  patientRef: string
  /** Risk factors carried on the referral so the clinic is not guessing. */
  hba1c: number | null
  systolic: number | null
  diastolic: number | null
  hypertension: boolean
  smoker: boolean
}

export interface Screening {
  id: string
  patient: Patient
  site: string
  createdAt: string
  eyes: Partial<Record<EyeSide, EyeExam>>
  status: ScreeningStatus
  priority: Priority
  /** Worst gradeable eye. Null when neither eye could be graded. */
  worstGrade: Grade | null
  lowestConfidence: number | null
  referralSuggested: boolean
  review: Review | null
  synced: boolean
  /** Freezes the demo narrative for a seeded case. */
  demoCaseId?: string
}

export interface Site {
  id: string
  name: string
  volume: number
  rejectionRate: number
}

export interface AuditEntry {
  id: string
  screeningId: string
  at: string
  actor: string
  event: string
  detail: string
}
