import type { Findings, Grade, QualityVerdict, Site } from '../types'
import type { QualityFlavour } from './fundus'

export interface DemoCase {
  id: string
  title: string
  blurb: string
  seed: number
  counts: Findings
  grade: Grade | null
  confidence: number
  flavour: QualityFlavour
  quality: { focus: number; illumination: number; fieldOfView: number }
  qualityVerdict: QualityVerdict
  qualityMessage: string
  /** Simulates the inference service being unreachable. */
  serviceDown?: boolean
  /** The fellow eye fails too — the "both eyes ungradable" pathway. */
  bothEyesUngradable?: boolean
  /** Surfaced in the judge-facing demo control. */
  quickAction?: string
}

const none: Findings = {
  microaneurysm: 0,
  haemorrhage: 0,
  hard_exudate: 0,
  neovascularisation: 0,
}

export const DEMO_CASES: DemoCase[] = [
  {
    id: 'g0',
    title: 'Grade 0 — no apparent retinopathy',
    blurb: 'Clean image, high confidence, no referral.',
    seed: 1041,
    counts: none,
    grade: 0,
    confidence: 0.94,
    flavour: 'clean',
    quality: { focus: 0.92, illumination: 0.88, fieldOfView: 0.95 },
    qualityVerdict: 'good',
    qualityMessage: 'Image looks usable.',
    quickAction: 'Demo: Good image',
  },
  {
    id: 'g1',
    title: 'Grade 1 — mild',
    blurb: 'A few microaneurysms. Rescreen rather than refer.',
    seed: 2213,
    counts: { ...none, microaneurysm: 4 },
    grade: 1,
    confidence: 0.89,
    flavour: 'clean',
    quality: { focus: 0.87, illumination: 0.84, fieldOfView: 0.9 },
    qualityVerdict: 'good',
    qualityMessage: 'Image looks usable.',
  },
  {
    id: 'g2',
    title: 'Grade 2 — moderate',
    blurb: 'The core referral story: lesions visible, model confident.',
    seed: 3307,
    counts: { microaneurysm: 12, haemorrhage: 3, hard_exudate: 5, neovascularisation: 0 },
    grade: 2,
    confidence: 0.87,
    flavour: 'clean',
    quality: { focus: 0.9, illumination: 0.82, fieldOfView: 0.93 },
    qualityVerdict: 'good',
    qualityMessage: 'Image looks usable.',
    quickAction: 'Demo: Grade 2',
  },
  {
    id: 'g3',
    title: 'Grade 3 — severe',
    blurb: 'Heavy haemorrhage load. Refer within four weeks.',
    seed: 4409,
    counts: { microaneurysm: 24, haemorrhage: 11, hard_exudate: 9, neovascularisation: 0 },
    grade: 3,
    confidence: 0.83,
    flavour: 'clean',
    quality: { focus: 0.85, illumination: 0.8, fieldOfView: 0.88 },
    qualityVerdict: 'good',
    qualityMessage: 'Image looks usable.',
  },
  {
    id: 'g4',
    title: 'Grade 4 — proliferative',
    blurb: 'New vessels at the disc. Urgent referral.',
    seed: 5501,
    counts: { microaneurysm: 19, haemorrhage: 8, hard_exudate: 6, neovascularisation: 3 },
    grade: 4,
    confidence: 0.91,
    flavour: 'clean',
    quality: { focus: 0.88, illumination: 0.86, fieldOfView: 0.91 },
    qualityVerdict: 'good',
    qualityMessage: 'Image looks usable.',
  },
  {
    id: 'lowconf',
    title: 'Low confidence — priority review',
    blurb: 'The worker is shown no grade. The case jumps the clinician queue.',
    seed: 6607,
    counts: { microaneurysm: 7, haemorrhage: 2, hard_exudate: 1, neovascularisation: 0 },
    grade: 2,
    confidence: 0.61,
    flavour: 'blurred',
    quality: { focus: 0.58, illumination: 0.74, fieldOfView: 0.86 },
    qualityVerdict: 'good',
    qualityMessage: 'Image is usable but slightly soft.',
    quickAction: 'Demo: Low confidence',
  },
  {
    id: 'poor',
    title: 'Poor image — retake prompted',
    blurb: 'Quality gate stops the capture before any analysis runs.',
    seed: 7703,
    counts: { ...none, microaneurysm: 3 },
    grade: 1,
    confidence: 0.66,
    flavour: 'dark',
    quality: { focus: 0.61, illumination: 0.27, fieldOfView: 0.72 },
    qualityVerdict: 'poor',
    qualityMessage: 'Image too dark — move the lamp closer and retake.',
    quickAction: 'Demo: Poor image',
  },
  {
    id: 'ungradable',
    title: 'Ungradable — media opacity',
    blurb: 'Cataract haze. The model declines to grade rather than guess.',
    seed: 8809,
    counts: none,
    grade: null,
    confidence: 0.44,
    flavour: 'occluded',
    quality: { focus: 0.34, illumination: 0.51, fieldOfView: 0.62 },
    qualityVerdict: 'ungradable',
    qualityMessage: 'Media opacity obscures the retina — this image cannot be graded.',
    quickAction: 'Demo: Ungradable',
  },
  {
    id: 'both_ungradable',
    title: 'Both eyes ungradable',
    blurb: 'No dead end — the pathway becomes manual examination.',
    seed: 9901,
    counts: none,
    grade: null,
    confidence: 0.39,
    flavour: 'occluded',
    quality: { focus: 0.29, illumination: 0.47, fieldOfView: 0.58 },
    qualityVerdict: 'ungradable',
    qualityMessage: 'Media opacity obscures the retina — this image cannot be graded.',
    bothEyesUngradable: true,
  },
  {
    id: 'service_down',
    title: 'Analysis unavailable',
    blurb: 'Inference is unreachable. Images are kept, nothing is lost.',
    seed: 10007,
    counts: { microaneurysm: 9, haemorrhage: 2, hard_exudate: 3, neovascularisation: 0 },
    grade: 2,
    confidence: 0.85,
    flavour: 'clean',
    quality: { focus: 0.89, illumination: 0.85, fieldOfView: 0.92 },
    qualityVerdict: 'good',
    qualityMessage: 'Image looks usable.',
    serviceDown: true,
    quickAction: 'Demo: Backend unavailable',
  },
]

export const demoCase = (id: string) => DEMO_CASES.find((c) => c.id === id)

/** The four demo images offered on the capture screen. */
export const CAPTURE_DEMO_IDS = ['g0', 'g2', 'lowconf', 'ungradable']

export const SITES: Site[] = [
  { id: 'vellore', name: 'Vellore PHC', volume: 342, rejectionRate: 0.042 },
  { id: 'katpadi', name: 'Katpadi Camp', volume: 218, rejectionRate: 0.098 },
  { id: 'ranipet', name: 'Ranipet PHC', volume: 187, rejectionRate: 0.121 },
  { id: 'gudiyatham', name: 'Gudiyatham Camp', volume: 154, rejectionRate: 0.154 },
  { id: 'arakkonam', name: 'Arakkonam PHC', volume: 131, rejectionRate: 0.067 },
  { id: 'ambur', name: 'Ambur Camp', volume: 96, rejectionRate: 0.111 },
]

export const FACILITY = 'Vellore District DR Screening Programme'
export const CLINICIAN_NAME = 'Dr. A. Ramanathan'
export const MODEL_VERSION = 'drishti-dr v0.4.1 (prototype)'
export const VALIDATION = {
  dataset: 'Held-out set, 4,812 images, 3 district camps',
  sensitivity: 0.902,
  specificity: 0.851,
}
