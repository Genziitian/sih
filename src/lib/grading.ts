import type {
  AnalysisResult,
  DmeGrade,
  Grade,
  Lesion,
  LesionType,
  Priority,
  Screening,
} from '../types'

export interface GradeMeta {
  grade: Grade
  short: string
  label: string
  action: string
  referral: boolean
  colorVar: string
}

export const GRADES: GradeMeta[] = [
  {
    grade: 0,
    short: 'Grade 0',
    label: 'No apparent retinopathy',
    action: 'No referral. Rescreen in 12 months.',
    referral: false,
    colorVar: 'var(--color-g0)',
  },
  {
    grade: 1,
    short: 'Grade 1',
    label: 'Mild',
    action: 'No referral. Rescreen in 12 months.',
    referral: false,
    colorVar: 'var(--color-g1)',
  },
  {
    grade: 2,
    short: 'Grade 2',
    label: 'Moderate',
    action: 'Refer to ophthalmologist.',
    referral: true,
    colorVar: 'var(--color-g2)',
  },
  {
    grade: 3,
    short: 'Grade 3',
    label: 'Severe',
    action: 'Refer to ophthalmologist within 4 weeks.',
    referral: true,
    colorVar: 'var(--color-g3)',
  },
  {
    grade: 4,
    short: 'Grade 4',
    label: 'Proliferative',
    action: 'Refer urgently. Same-week appointment.',
    referral: true,
    colorVar: 'var(--color-g4)',
  },
]

export const gradeMeta = (grade: Grade): GradeMeta => GRADES[grade]

export const UNGRADABLE_COLOR = 'var(--color-ungradable)'

export const LESION_LABELS: Record<LesionType, string> = {
  microaneurysm: 'Microaneurysms',
  haemorrhage: 'Haemorrhages',
  hard_exudate: 'Hard exudates',
  neovascularisation: 'Neovascularisation',
}

export const LESION_COLORS: Record<LesionType, string> = {
  microaneurysm: '#3f8fd4',
  haemorrhage: '#e2574c',
  hard_exudate: '#e8b427',
  neovascularisation: '#a259c4',
}

export const LESION_ORDER: LesionType[] = [
  'microaneurysm',
  'haemorrhage',
  'hard_exudate',
  'neovascularisation',
]

/** Below this the field worker is never shown a grade — the case is escalated. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7

export function confidenceBand(c: number): AnalysisResult['confidenceBand'] {
  if (c >= 0.85) return 'high'
  if (c >= LOW_CONFIDENCE_THRESHOLD) return 'moderate'
  return 'low'
}

export function confidenceNote(c: number, lesionCount: number): string {
  const band = confidenceBand(c)
  if (band === 'high') {
    return lesionCount > 0
      ? 'High — consistent with visible lesions'
      : 'High — no lesions found on a clean image'
  }
  if (band === 'moderate') return 'Moderate — some features are borderline'
  return 'Low — the model could not settle on a grade'
}

/** Queue ordering: referable, then low confidence, then ungradable, then rest. */
export const PRIORITY_ORDER: Priority[] = [
  'referable',
  'low_confidence',
  'ungradable',
  'routine',
]

export const PRIORITY_LABELS: Record<Priority, string> = {
  referable: 'Referable',
  low_confidence: 'Low confidence',
  ungradable: 'Ungradable',
  routine: 'Routine',
}

export function priorityOf(screening: Screening): Priority {
  const analyses = Object.values(screening.eyes)
    .map((e) => e?.analysis)
    .filter(Boolean) as AnalysisResult[]
  if (analyses.length === 0) return 'routine'
  // Low confidence is decided first: when the model is unsure, its own grade is
  // not the thing to file the case under — and the worker was never shown one.
  if (analyses.some((a) => !a.ungradable && a.confidence < LOW_CONFIDENCE_THRESHOLD))
    return 'low_confidence'
  if (analyses.some((a) => a.referralSuggested && !a.ungradable)) return 'referable'
  if (analyses.every((a) => a.ungradable)) return 'ungradable'
  if (analyses.some((a) => a.ungradable)) return 'ungradable'
  return 'routine'
}

/** Worst-eye rule: the programme acts on the worse of the two eyes. */
export function summarise(screening: Screening) {
  const analyses = Object.values(screening.eyes)
    .map((e) => e?.analysis)
    .filter(Boolean) as AnalysisResult[]
  const gradeable = analyses.filter((a) => !a.ungradable && a.grade !== null)
  const worstGrade = gradeable.length
    ? (Math.max(...gradeable.map((a) => a.grade as number)) as Grade)
    : null
  const lowestConfidence = analyses.length
    ? Math.min(...analyses.map((a) => a.confidence))
    : null
  return {
    worstGrade,
    lowestConfidence,
    referralSuggested: analyses.some((a) => a.referralSuggested),
    bothUngradable: analyses.length === 2 && analyses.every((a) => a.ungradable),
  }
}

export function elapsedLabel(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ${mins % 60} min`
  return `${Math.floor(hours / 24)} d`
}

export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`

/* --- diabetic macular oedema --------------------------------------------- */

export const DME_LABELS: Record<DmeGrade, string> = {
  none: 'No apparent macular oedema',
  mild: 'Mild — exudate in the posterior pole, distant from the fovea',
  moderate: 'Moderate — exudate approaching the central subfield',
  severe: 'Severe — exudate involving the central subfield',
}

export const DME_SHORT: Record<DmeGrade, string> = {
  none: 'None',
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
}

export const DME_COLOR: Record<DmeGrade, string> = {
  none: 'var(--color-g0)',
  mild: 'var(--color-g1)',
  moderate: 'var(--color-g2)',
  severe: 'var(--color-g4)',
}

const FOVEA = { x: 500, y: 500 }

/**
 * Grade macular oedema from exudate geometry. Distance to the fovea is what
 * separates an incidental peripheral fleck from a sight-threatening one, so
 * the nearest hard exudate decides the grade.
 */
export function gradeDme(lesions: Lesion[]): { dme: DmeGrade; maculaInvolved: boolean } {
  const exudates = lesions.filter((l) => l.type === 'hard_exudate')
  if (exudates.length === 0) return { dme: 'none', maculaInvolved: false }
  const nearest = Math.min(
    ...exudates.map((l) => Math.hypot(l.x - FOVEA.x, l.y - FOVEA.y)),
  )
  if (nearest < 110) return { dme: 'severe', maculaInvolved: true }
  if (nearest < 230) return { dme: 'moderate', maculaInvolved: false }
  return { dme: 'mild', maculaInvolved: false }
}

/* --- follow-up ------------------------------------------------------------ */

export interface FollowUp {
  urgency: string
  within: string
  nextScreening: string
}

/** What happens next, from the worst gradeable eye plus macular status. */
export function followUp(
  worstGrade: Grade | null,
  dme: DmeGrade,
  from = new Date(),
): FollowUp {
  const plus = (months: number) => {
    const d = new Date(from)
    d.setMonth(d.getMonth() + months)
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  }

  if (worstGrade === null) {
    return {
      urgency: 'Manual examination',
      within: 'Next available slit-lamp clinic',
      nextScreening: 'On examination',
    }
  }
  if (dme === 'severe' || worstGrade === 4) {
    return { urgency: 'Urgent', within: 'Same week', nextScreening: 'Under specialist care' }
  }
  if (worstGrade === 3 || dme === 'moderate') {
    return { urgency: 'Priority', within: '4 weeks', nextScreening: 'Under specialist care' }
  }
  if (worstGrade === 2) {
    return { urgency: 'Routine referral', within: '12 weeks', nextScreening: 'Under specialist care' }
  }
  return {
    urgency: 'No referral',
    within: '—',
    nextScreening: plus(12),
  }
}

/** Snellen acuity, deterministic per eye and loosely tracking severity. */
const SNELLEN = ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36']
export function visualAcuityFor(grade: Grade | null, seed: number): string {
  if (grade === null) return '6/36'
  const drift = seed % 2
  return SNELLEN[Math.min(SNELLEN.length - 1, grade + drift)]
}
