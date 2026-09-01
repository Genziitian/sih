/* ---------------------------------------------------------------------------
   District workflow simulation.

   The officer never sees a raw model threshold — a probability cut-off is not
   a decision anyone can make. They see the two numbers that follow from it,
   sensitivity and specificity, and the queue those numbers produce.
--------------------------------------------------------------------------- */

export interface OperatingPoint {
  sensitivity: number
  specificity: number
}

/** Eleven points along the validation ROC curve. Index 6 is the default. */
export const OPERATING_POINTS: OperatingPoint[] = [
  { sensitivity: 0.72, specificity: 0.96 },
  { sensitivity: 0.76, specificity: 0.945 },
  { sensitivity: 0.8, specificity: 0.93 },
  { sensitivity: 0.83, specificity: 0.915 },
  { sensitivity: 0.86, specificity: 0.895 },
  { sensitivity: 0.88, specificity: 0.875 },
  { sensitivity: 0.9, specificity: 0.85 },
  { sensitivity: 0.92, specificity: 0.82 },
  { sensitivity: 0.94, specificity: 0.78 },
  { sensitivity: 0.96, specificity: 0.72 },
  { sensitivity: 0.98, specificity: 0.62 },
]

export const DEFAULT_THRESHOLD_INDEX = 6

/** Referable disease among screened people with diabetes. */
export const PREVALENCE = 0.12
export const MINUTES_PER_REVIEW = 4
export const SCREENING_DAYS_PER_WEEK = 7
export const SIM_WEEKS = 12

export interface SimInputs {
  arrivalsPerDay: number
  reviewsPerDay: number
  thresholdIndex: number
}

export interface SimOutput {
  point: OperatingPoint
  arrivalsPerWeek: number
  referralsPerWeek: number
  truePositivesPerWeek: number
  falsePositivesPerWeek: number
  missedPerWeek: number
  missedPer100: number
  capacityPerWeek: number
  clinicianHoursPerWeek: number
  backlog: { week: string; backlog: number; referrals: number; capacity: number }[]
  finalBacklog: number
  clears: boolean
}

export function simulate(inputs: SimInputs): SimOutput {
  const point = OPERATING_POINTS[inputs.thresholdIndex] ?? OPERATING_POINTS[DEFAULT_THRESHOLD_INDEX]
  const arrivalsPerWeek = inputs.arrivalsPerDay * SCREENING_DAYS_PER_WEEK
  const diseased = arrivalsPerWeek * PREVALENCE
  const healthy = arrivalsPerWeek * (1 - PREVALENCE)

  const truePositivesPerWeek = diseased * point.sensitivity
  const falsePositivesPerWeek = healthy * (1 - point.specificity)
  const referralsPerWeek = truePositivesPerWeek + falsePositivesPerWeek
  const missedPerWeek = diseased * (1 - point.sensitivity)
  const capacityPerWeek = inputs.reviewsPerDay * SCREENING_DAYS_PER_WEEK

  let backlog = 0
  const series: SimOutput['backlog'] = []
  for (let w = 1; w <= SIM_WEEKS; w++) {
    backlog = Math.max(0, backlog + referralsPerWeek - capacityPerWeek)
    series.push({
      week: `W${w}`,
      backlog: Math.round(backlog),
      referrals: Math.round(referralsPerWeek),
      capacity: Math.round(capacityPerWeek),
    })
  }

  return {
    point,
    arrivalsPerWeek,
    referralsPerWeek: Math.round(referralsPerWeek),
    truePositivesPerWeek: Math.round(truePositivesPerWeek),
    falsePositivesPerWeek: Math.round(falsePositivesPerWeek),
    missedPerWeek: Math.round(missedPerWeek * 10) / 10,
    missedPer100: Math.round((1 - point.sensitivity) * 100),
    capacityPerWeek,
    clinicianHoursPerWeek:
      Math.round(((referralsPerWeek * MINUTES_PER_REVIEW) / 60) * 10) / 10,
    backlog: series,
    finalBacklog: Math.round(backlog),
    clears: backlog === 0,
  }
}
