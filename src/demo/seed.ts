import type { EyeExam, EyeSide, Screening } from '../types'
import { MockFundusAnalyser } from '../services/ai'
import { priorityOf, summarise, visualAcuityFor } from '../lib/grading'
import { DEMO_CASES, SITES, demoCase } from './cases'
import { specToUrl } from './fundus'

/* Seeded queue for the clinician workflow. Deterministic, so a judge sees the
   same 23 cases in the same order every time the prototype is opened. */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SURNAMES = [
  'Meena', 'Kumar', 'Devi', 'Raj', 'Selvam', 'Bai', 'Nair', 'Iyer', 'Reddy',
  'Bose', 'Pillai', 'Das', 'Sharma', 'Ali', 'Fernandes', 'Gowda', 'Patil',
  'Murugan', 'Lakshmi', 'Varghese', 'Chettiar', 'Naidu', 'Rathore',
]
const INITIALS = 'RSKMPAVNTGLDBJH'

/** Right eye archetype for each queue slot; left eye is derived from it. */
const QUEUE_PLAN = [
  'g3', 'lowconf', 'ungradable', 'g2', 'g4', 'g0', 'lowconf', 'g2', 'g1',
  'g3', 'both_ungradable', 'g2', 'lowconf', 'g0', 'g4', 'g1', 'g2', 'lowconf',
  'g0', 'g3', 'ungradable', 'g1', 'lowconf',
]

const analyser = new MockFundusAnalyser([0, 0])

async function buildEye(
  side: EyeSide,
  caseId: string,
  seedOffset: number,
): Promise<EyeExam> {
  const c = demoCase(caseId)!
  const image = specToUrl({
    seed: c.seed + seedOffset,
    side,
    flavour: c.flavour,
    counts: c.counts,
  })
  const req = { image, side, demoCaseId: c.id }
  const quality = await analyser.assessQuality(req)
  const analysis = await analyser.analyzeFundusImage(req)
  return {
    side,
    imageSrc: image,
    imageLabel: `${side === 'right' ? 'Right' : 'Left'} eye`,
    visualAcuity: visualAcuityFor(analysis.grade, c.seed + seedOffset),
    quality,
    analysis,
  }
}

export async function buildSeedScreenings(now = Date.now()): Promise<Screening[]> {
  const rand = mulberry32(20260901)
  const out: Screening[] = []

  for (let i = 0; i < QUEUE_PLAN.length; i++) {
    const rightCaseId = QUEUE_PLAN[i]
    const right = demoCase(rightCaseId)!
    // The fellow eye is usually quieter than the worse eye.
    const leftCaseId = right.bothEyesUngradable
      ? 'both_ungradable'
      : right.grade === null
        ? 'g1'
        : rand() < 0.35
          ? rightCaseId
          : DEMO_CASES[rand() < 0.5 ? 0 : 1].id

    const site = SITES[Math.floor(rand() * 4)]
    const waitMinutes = Math.round(4 + rand() * 96)
    const age = 41 + Math.floor(rand() * 34)

    const [rightEye, leftEye] = await Promise.all([
      buildEye('right', rightCaseId, i * 13),
      buildEye('left', leftCaseId, i * 13 + 5),
    ])

    const screening: Screening = {
      id: `SCR-2026-${String(421 + i).padStart(5, '0')}`,
      patient: {
        name: `${INITIALS[i % INITIALS.length]}. ${SURNAMES[i % SURNAMES.length]}`,
        age,
        sex: rand() < 0.52 ? 'F' : 'M',
        yearsSinceDiagnosis: 2 + Math.floor(rand() * 18),
        patientRef: `PT-${String(10240 + i * 7).padStart(6, '0')}`,
        hba1c: Math.round((6.4 + rand() * 4.2) * 10) / 10,
        systolic: 110 + Math.floor(rand() * 50),
        diastolic: 68 + Math.floor(rand() * 26),
        hypertension: rand() < 0.42,
        smoker: rand() < 0.24,
      },
      site: site.name,
      createdAt: new Date(now - waitMinutes * 60000).toISOString(),
      eyes: { right: rightEye, left: leftEye },
      status: 'awaiting_review',
      priority: 'routine',
      worstGrade: null,
      lowestConfidence: null,
      referralSuggested: false,
      review: null,
      synced: true,
      demoCaseId: rightCaseId,
    }

    const s = summarise(screening)
    screening.worstGrade = s.worstGrade
    screening.lowestConfidence = s.lowestConfidence
    screening.referralSuggested = s.referralSuggested
    screening.priority = priorityOf(screening)
    out.push(screening)
  }

  return out
}

/** Weekly programme aggregates behind the officer dashboard. */
export const PROGRAMME_STATS = {
  screeningsThisWeek: 1284,
  referralRate: 0.124,
  medianReviewMinutes: 18,
  imagesRejected: 0.078,
  weeklyVolume: [1042, 1118, 1197, 1150, 1226, 1284],
}
