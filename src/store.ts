import { create } from 'zustand'
import type {
  AnalysisResult,
  AuditEntry,
  ClinicianDecision,
  DisagreementReason,
  EyeExam,
  EyeSide,
  ImageQuality,
  Patient,
  Role,
  Screening,
} from './types'
import { AnalysisUnavailableError, analyser } from './services/ai'
import { getRepository, type BackendStatus, type ScreeningRepository } from './services/repo'
import { dequeue, enqueue, readOutbox, writeOutbox } from './services/outbox'
import { buildSeedScreenings } from './demo/seed'
import { CLINICIAN_NAME, SITES, demoCase } from './demo/cases'
import { specToUrl } from './demo/fundus'
import { PRIORITY_ORDER, priorityOf, summarise } from './lib/grading'

export type AnalysisState = 'idle' | 'running' | 'done' | 'unavailable'

export interface DraftEye {
  imageSrc: string
  imageLabel: string
  demoCaseId?: string
  quality: ImageQuality | null
  checkingQuality: boolean
  analysis: AnalysisResult | null
  analysisState: AnalysisState
  overridden: boolean
}

export interface Draft {
  id: string
  patient: Patient
  site: string
  activeEye: EyeSide
  eyes: Partial<Record<EyeSide, DraftEye>>
}

const newDraftId = (existing: Screening[]) => {
  const numbers = existing
    .map((s) => Number(s.id.split('-').pop()))
    .filter((n) => !Number.isNaN(n))
  const next = (numbers.length ? Math.max(...numbers) : 443) + 1
  return `SCR-2026-${String(next).padStart(5, '0')}`
}

const emptyPatient = (): Patient => ({
  name: 'Demo Patient',
  age: 56,
  sex: 'F',
  yearsSinceDiagnosis: 8,
  patientRef: `PT-${Math.floor(100000 + Math.random() * 899999)}`,
})

const makeDraft = (existing: Screening[]): Draft => ({
  id: newDraftId(existing),
  patient: emptyPatient(),
  site: SITES[0].name,
  activeEye: 'right',
  eyes: {},
})

interface State {
  ready: boolean
  repo: ScreeningRepository | null
  backend: BackendStatus | null
  role: Role
  online: boolean
  syncing: boolean
  demoMode: boolean
  /** Forces the next captured image down a scripted path. */
  pinnedDemoCase: string | null
  screenings: Screening[]
  outbox: Screening[]
  audit: AuditEntry[]
  draft: Draft
  lastSubmittedId: string | null

  bootstrap: () => Promise<void>
  setRole: (role: Role) => void
  setDemoMode: (on: boolean) => void
  pinDemoCase: (id: string | null) => void

  setPatient: (patch: Partial<Patient>) => void
  setSite: (site: string) => void
  setActiveEye: (side: EyeSide) => void
  attachImage: (
    side: EyeSide,
    imageSrc: string,
    imageLabel: string,
    demoCaseId?: string,
  ) => Promise<void>
  clearEye: (side: EyeSide) => void
  overrideQuality: (side: EyeSide) => void
  runAnalysis: (side: EyeSide) => Promise<void>
  loadDemoCase: (caseId: string) => Promise<void>
  resetDraft: () => void

  submitForReview: () => Promise<string>
  goOnline: () => Promise<void>
  goOffline: () => void
  syncNow: () => Promise<void>

  recordDecision: (
    screeningId: string,
    decision: ClinicianDecision,
    reason: DisagreementReason | null,
  ) => Promise<void>
  resetPrototype: () => Promise<void>
}

const nowIso = () => new Date().toISOString()

let auditSeq = 0
const audit = (
  screeningId: string,
  actor: string,
  event: string,
  detail: string,
): AuditEntry => ({
  id: `AUD-${Date.now().toString(36)}-${auditSeq++}`,
  screeningId,
  at: nowIso(),
  actor,
  event,
  detail,
})

export const useStore = create<State>((set, get) => ({
  ready: false,
  repo: null,
  backend: null,
  role: 'field_worker',
  online: true,
  syncing: false,
  demoMode: false,
  pinnedDemoCase: null,
  screenings: [],
  outbox: [],
  audit: [],
  draft: makeDraft([]),
  lastSubmittedId: null,

  async bootstrap() {
    const { repo, status } = await getRepository()
    let screenings = await repo.listScreenings()

    if (screenings.length === 0) {
      screenings = await buildSeedScreenings()
      for (const s of screenings) await repo.saveScreening(s)
    }

    let outbox = await readOutbox()
    if (outbox.length === 0) {
      // Three captures already waiting when the worker opens the app.
      const pending = (await buildSeedScreenings(Date.now() - 3 * 3600_000))
        .slice(0, 3)
        .map((s, i) => ({
          ...s,
          id: `SCR-2026-00${401 + i}`,
          status: 'pending_sync' as const,
          synced: false,
        }))
      outbox = pending
      await writeOutbox(outbox)
    }

    set({
      ready: true,
      repo,
      backend: status,
      screenings,
      outbox,
      audit: await repo.listAudit(),
      draft: makeDraft(screenings),
    })
  },

  setRole: (role) => set({ role }),
  setDemoMode: (demoMode) => set({ demoMode }),
  pinDemoCase: (pinnedDemoCase) => set({ pinnedDemoCase }),

  setPatient: (patch) =>
    set((s) => ({ draft: { ...s.draft, patient: { ...s.draft.patient, ...patch } } })),
  setSite: (site) => set((s) => ({ draft: { ...s.draft, site } })),
  setActiveEye: (activeEye) => set((s) => ({ draft: { ...s.draft, activeEye } })),

  clearEye: (side) =>
    set((s) => {
      const eyes = { ...s.draft.eyes }
      delete eyes[side]
      return { draft: { ...s.draft, eyes } }
    }),

  overrideQuality: (side) =>
    set((s) => {
      const eye = s.draft.eyes[side]
      if (!eye || !eye.quality) return {}
      return {
        draft: {
          ...s.draft,
          eyes: {
            ...s.draft.eyes,
            [side]: { ...eye, overridden: true, quality: { ...eye.quality, overridden: true } },
          },
        },
      }
    }),

  async attachImage(side, imageSrc, imageLabel, demoCaseId) {
    const pinned = get().pinnedDemoCase
    const caseId = demoCaseId ?? pinned ?? undefined

    set((s) => ({
      draft: {
        ...s.draft,
        activeEye: side,
        eyes: {
          ...s.draft.eyes,
          [side]: {
            imageSrc,
            imageLabel,
            demoCaseId: caseId,
            quality: null,
            checkingQuality: true,
            analysis: null,
            analysisState: 'idle',
            overridden: false,
          },
        },
      },
    }))

    const quality = await analyser.assessQuality({ image: imageSrc, side, demoCaseId: caseId })

    set((s) => {
      const eye = s.draft.eyes[side]
      if (!eye || eye.imageSrc !== imageSrc) return {}
      return {
        draft: {
          ...s.draft,
          eyes: { ...s.draft.eyes, [side]: { ...eye, quality, checkingQuality: false } },
        },
      }
    })
  },

  async loadDemoCase(caseId) {
    const c = demoCase(caseId)
    if (!c) return
    const side = get().draft.activeEye
    const image = specToUrl({ seed: c.seed, side, flavour: c.flavour, counts: c.counts })
    set({ pinnedDemoCase: caseId })
    await get().attachImage(side, image, `Demo — ${c.title}`, caseId)

    // "Both eyes ungradable" only reads as a pathway if the fellow eye is loaded too.
    if (c.bothEyesUngradable) {
      const other: EyeSide = side === 'right' ? 'left' : 'right'
      const otherImage = specToUrl({
        seed: c.seed + 3,
        side: other,
        flavour: c.flavour,
        counts: c.counts,
      })
      await get().attachImage(other, otherImage, `Demo — ${c.title}`, caseId)
      set((s) => ({ draft: { ...s.draft, activeEye: side } }))
    }
  },

  async runAnalysis(side) {
    const eye = get().draft.eyes[side]
    if (!eye) return

    set((s) => ({
      draft: {
        ...s.draft,
        eyes: { ...s.draft.eyes, [side]: { ...eye, analysisState: 'running' } },
      },
    }))

    try {
      const analysis = await analyser.analyzeFundusImage({
        image: eye.imageSrc,
        side,
        demoCaseId: eye.demoCaseId,
      })
      set((s) => {
        const current = s.draft.eyes[side]
        if (!current) return {}
        return {
          draft: {
            ...s.draft,
            eyes: {
              ...s.draft.eyes,
              [side]: { ...current, analysis, analysisState: 'done' },
            },
          },
        }
      })
    } catch (err) {
      if (!(err instanceof AnalysisUnavailableError)) throw err
      set((s) => {
        const current = s.draft.eyes[side]
        if (!current) return {}
        return {
          draft: {
            ...s.draft,
            eyes: { ...s.draft.eyes, [side]: { ...current, analysisState: 'unavailable' } },
          },
        }
      })
    }
  },

  resetDraft: () => set((s) => ({ draft: makeDraft(s.screenings), pinnedDemoCase: null })),

  async submitForReview() {
    const { draft, repo, online, screenings } = get()
    const eyes: Screening['eyes'] = {}
    for (const side of ['right', 'left'] as EyeSide[]) {
      const e = draft.eyes[side]
      if (!e) continue
      const exam: EyeExam = {
        side,
        imageSrc: e.imageSrc,
        imageLabel: e.imageLabel,
        quality: e.quality ?? {
          focus: 0,
          illumination: 0,
          fieldOfView: 0,
          verdict: 'poor',
          message: 'Quality check did not complete.',
        },
        analysis: e.analysis,
      }
      eyes[side] = exam
    }

    const anyUnavailable = Object.values(draft.eyes).some(
      (e) => e?.analysisState === 'unavailable',
    )

    const screening: Screening = {
      id: draft.id,
      patient: draft.patient,
      site: draft.site,
      createdAt: nowIso(),
      eyes,
      status: anyUnavailable ? 'analysis_pending' : online ? 'awaiting_review' : 'pending_sync',
      priority: 'routine',
      worstGrade: null,
      lowestConfidence: null,
      referralSuggested: false,
      review: null,
      synced: online && !anyUnavailable,
      demoCaseId: Object.values(draft.eyes)[0]?.demoCaseId,
    }

    const s = summarise(screening)
    screening.worstGrade = s.worstGrade
    screening.lowestConfidence = s.lowestConfidence
    screening.referralSuggested = s.referralSuggested
    screening.priority = priorityOf(screening)

    if (online && !anyUnavailable) {
      await repo?.saveScreening(screening)
      const entry = audit(
        screening.id,
        'Field worker',
        'Sent for review',
        `${screening.site} · priority ${screening.priority}`,
      )
      await repo?.appendAudit(entry)
      set((state) => ({
        screenings: [screening, ...state.screenings.filter((x) => x.id !== screening.id)],
        audit: [entry, ...state.audit],
        draft: makeDraft([screening, ...screenings]),
        pinnedDemoCase: null,
        lastSubmittedId: screening.id,
      }))
    } else {
      const outbox = await enqueue(screening)
      set((state) => ({
        outbox,
        draft: makeDraft([screening, ...state.screenings]),
        pinnedDemoCase: null,
        lastSubmittedId: screening.id,
      }))
    }

    return screening.id
  },

  goOffline: () => set({ online: false }),

  async goOnline() {
    set({ online: true })
    await get().syncNow()
  },

  async syncNow() {
    const { repo, outbox } = get()
    if (!repo || outbox.length === 0) return
    set({ syncing: true })
    for (const item of outbox) {
      await new Promise((r) => setTimeout(r, 650))
      const synced: Screening = {
        ...item,
        synced: true,
        status: item.status === 'analysis_pending' ? 'awaiting_review' : 'awaiting_review',
      }
      // A screening held offline still needs its analysis before a clinician sees it.
      if (!Object.values(synced.eyes).some((e) => e?.analysis)) {
        synced.status = 'analysis_pending'
      }
      await repo.saveScreening(synced)
      const entry = audit(synced.id, 'Sync', 'Uploaded', `Captured offline at ${synced.site}`)
      await repo.appendAudit(entry)
      const remaining = await dequeue(item.id)
      set((state) => ({
        outbox: remaining,
        screenings: [synced, ...state.screenings.filter((x) => x.id !== synced.id)],
        audit: [entry, ...state.audit],
      }))
    }
    set({ syncing: false })
  },

  async recordDecision(screeningId, decision, reason) {
    const { repo, screenings } = get()
    const target = screenings.find((s) => s.id === screeningId)
    if (!target || !repo) return

    const disagreed =
      (target.referralSuggested && decision === 'no_refer') ||
      (!target.referralSuggested && decision === 'refer')

    const updated: Screening = {
      ...target,
      status: 'completed',
      review: {
        decision,
        disagreedWithModel: disagreed,
        reason,
        clinicianName: CLINICIAN_NAME,
        decidedAt: nowIso(),
      },
    }

    await repo.saveScreening(updated)
    const label =
      decision === 'refer'
        ? 'Referral confirmed'
        : decision === 'no_refer'
          ? 'No referral'
          : 'Marked ungradable'
    const entry = audit(
      screeningId,
      CLINICIAN_NAME,
      label,
      disagreed ? `Differs from model · reason: ${reason}` : 'Agrees with model suggestion',
    )
    await repo.appendAudit(entry)

    set((state) => ({
      screenings: state.screenings.map((s) => (s.id === screeningId ? updated : s)),
      audit: [entry, ...state.audit],
    }))
  },

  async resetPrototype() {
    const { repo } = get()
    await repo?.reset()
    await writeOutbox([])
    set({ ready: false, screenings: [], outbox: [], audit: [] })
    await get().bootstrap()
  },
}))

/* --- selectors ----------------------------------------------------------- */

export const reviewQueue = (screenings: Screening[]) =>
  screenings
    .filter((s) => s.status === 'awaiting_review')
    .sort((a, b) => {
      const p = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
      if (p !== 0) return p
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

export const completedCases = (screenings: Screening[]) =>
  screenings.filter((s) => s.status === 'completed')
