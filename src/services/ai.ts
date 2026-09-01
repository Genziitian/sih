import type { AnalysisResult, EyeSide, Findings, ImageQuality } from '../types'
import { buildFundus, parseFundusUrl, syntheticOverlay } from '../demo/fundus'
import { DEMO_CASES, MODEL_VERSION, demoCase } from '../demo/cases'
import { confidenceBand, confidenceNote, gradeMeta } from '../lib/grading'

/* ---------------------------------------------------------------------------
   The model boundary.

   Everything the rest of the app knows about "AI" is this interface. Swapping
   the mock for a MATLAB bridge, a Python inference server or a hosted REST
   endpoint means writing one more implementation of FundusAnalyser — no screen
   changes, no state changes.
--------------------------------------------------------------------------- */

export interface AnalysisRequest {
  /** A `fundus://` seeded reference or a data URI from the camera. */
  image: string
  side: EyeSide
  /** Pins the outcome for a scripted demo case. */
  demoCaseId?: string
}

export interface FundusAnalyser {
  assessQuality(req: AnalysisRequest): Promise<ImageQuality>
  analyzeFundusImage(req: AnalysisRequest): Promise<AnalysisResult>
}

/** Thrown when inference is unreachable. Never shown raw to a user. */
export class AnalysisUnavailableError extends Error {
  constructor() {
    super('analysis-unavailable')
    this.name = 'AnalysisUnavailableError'
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Cheap stable hash over a sample of the string — data URIs can be huge. */
function hash(input: string): number {
  let h = 2166136261
  const step = Math.max(1, Math.floor(input.length / 512))
  for (let i = 0; i < input.length; i += step) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

const GRADED_CASE_IDS = ['g0', 'g1', 'g2', 'g3', 'g4']

/** An unseen upload still has to behave deterministically for the same file. */
function caseForUpload(image: string) {
  const h = hash(image)
  return demoCase(GRADED_CASE_IDS[h % GRADED_CASE_IDS.length])!
}

function resolveCase(req: AnalysisRequest) {
  if (req.demoCaseId) {
    const c = demoCase(req.demoCaseId)
    if (c) return c
  }
  const spec = parseFundusUrl(req.image)
  if (spec) {
    const match = DEMO_CASES.find((c) => c.seed === spec.seed)
    if (match) return match
  }
  return caseForUpload(req.image)
}

function geometryFor(req: AnalysisRequest, counts: Findings, seed: number) {
  const spec = parseFundusUrl(req.image)
  if (spec) {
    const built = buildFundus(spec)
    return { lesions: built.lesions, attention: built.attention }
  }
  // Uploaded photo: overlay geometry is illustrative and labelled as such.
  return syntheticOverlay(seed, counts, req.side)
}

export class MockFundusAnalyser implements FundusAnalyser {
  constructor(private readonly latency: [number, number] = [1500, 2500]) {}

  async assessQuality(req: AnalysisRequest): Promise<ImageQuality> {
    await wait(500 + Math.random() * 400)
    const c = resolveCase(req)
    const fromSpec = parseFundusUrl(req.image)
    if (req.demoCaseId || fromSpec) {
      return { ...c.quality, verdict: c.qualityVerdict, message: c.qualityMessage }
    }
    // Real uploads pass the gate with plausible, stable readings.
    const h = hash(req.image)
    const jitter = (n: number) => 0.78 + ((h >> n) % 18) / 100
    return {
      focus: jitter(2),
      illumination: jitter(7),
      fieldOfView: jitter(13),
      verdict: 'good',
      message: 'Image looks usable.',
    }
  }

  async analyzeFundusImage(req: AnalysisRequest): Promise<AnalysisResult> {
    const c = resolveCase(req)
    const [lo, hi] = this.latency
    await wait(lo + Math.random() * (hi - lo))
    if (c.serviceDown) throw new AnalysisUnavailableError()

    const quality: ImageQuality = {
      ...c.quality,
      verdict: c.qualityVerdict,
      message: c.qualityMessage,
    }

    if (c.grade === null || c.qualityVerdict === 'ungradable') {
      return {
        grade: null,
        gradeLabel: 'Ungradable',
        confidence: c.confidence,
        confidenceBand: 'low',
        confidenceNote: 'The image does not carry enough signal to grade.',
        referralSuggested: false,
        action: 'Retake, or refer for manual examination.',
        ungradable: true,
        quality,
        findings: {
          microaneurysm: 0,
          haemorrhage: 0,
          hard_exudate: 0,
          neovascularisation: 0,
        },
        lesions: [],
        attention: [{ x: 500, y: 500, r: 200, weight: 0.3 }],
        modelVersion: MODEL_VERSION,
        analysedAt: new Date().toISOString(),
      }
    }

    const meta = gradeMeta(c.grade)
    const { lesions, attention } = geometryFor(req, c.counts, c.seed)
    const lesionCount = Object.values(c.counts).reduce((a, b) => a + b, 0)

    return {
      grade: c.grade,
      gradeLabel: `${meta.short} — ${meta.label.toLowerCase()}`,
      confidence: c.confidence,
      confidenceBand: confidenceBand(c.confidence),
      confidenceNote: confidenceNote(c.confidence, lesionCount),
      referralSuggested: meta.referral,
      action: meta.action,
      ungradable: false,
      quality,
      findings: c.counts,
      lesions,
      attention,
      modelVersion: MODEL_VERSION,
      analysedAt: new Date().toISOString(),
    }
  }
}

/**
 * Drop-in replacement for a real inference service. Enable by setting
 * VITE_ANALYSIS_API_URL; the endpoint returns the same AnalysisResult shape.
 */
export class HttpFundusAnalyser implements FundusAnalyser {
  constructor(private readonly baseUrl: string) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      throw new AnalysisUnavailableError()
    }
    if (!res.ok) throw new AnalysisUnavailableError()
    return (await res.json()) as T
  }

  assessQuality(req: AnalysisRequest) {
    return this.post<ImageQuality>('/quality', req)
  }

  analyzeFundusImage(req: AnalysisRequest) {
    return this.post<AnalysisResult>('/analyse', req)
  }
}

const apiUrl = import.meta.env.VITE_ANALYSIS_API_URL as string | undefined

export const analyser: FundusAnalyser = apiUrl
  ? new HttpFundusAnalyser(apiUrl)
  : new MockFundusAnalyser()
