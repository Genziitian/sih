import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditEntry, EyeExam, EyeSide, Screening } from '../../types'
import type { ScreeningRepository } from './types'

/* Row shapes mirror supabase/migrations/0001_init.sql. */

interface ScreeningRow {
  id: string
  patient: Screening['patient']
  site: string
  created_at: string
  status: Screening['status']
  priority: Screening['priority']
  worst_grade: number | null
  lowest_confidence: number | null
  referral_suggested: boolean
  synced: boolean
  demo_case_id: string | null
  eye_exams?: EyeRow[]
  reviews?: ReviewRow[]
}

interface EyeRow {
  screening_id: string
  side: EyeSide
  image_src: string
  image_label: string
  quality: EyeExam['quality']
  analysis: EyeExam['analysis']
}

interface ReviewRow {
  screening_id: string
  decision: NonNullable<Screening['review']>['decision']
  disagreed_with_model: boolean
  reason: NonNullable<Screening['review']>['reason']
  clinician_name: string
  decided_at: string
}

function toScreening(row: ScreeningRow): Screening {
  const eyes: Screening['eyes'] = {}
  for (const e of row.eye_exams ?? []) {
    eyes[e.side] = {
      side: e.side,
      imageSrc: e.image_src,
      imageLabel: e.image_label,
      quality: e.quality,
      analysis: e.analysis,
    }
  }
  const r = (row.reviews ?? [])[0]
  return {
    id: row.id,
    patient: row.patient,
    site: row.site,
    createdAt: row.created_at,
    eyes,
    status: row.status,
    priority: row.priority,
    worstGrade: (row.worst_grade ?? null) as Screening['worstGrade'],
    lowestConfidence: row.lowest_confidence,
    referralSuggested: row.referral_suggested,
    review: r
      ? {
          decision: r.decision,
          disagreedWithModel: r.disagreed_with_model,
          reason: r.reason,
          clinicianName: r.clinician_name,
          decidedAt: r.decided_at,
        }
      : null,
    synced: row.synced,
    demoCaseId: row.demo_case_id ?? undefined,
  }
}

const SELECT = '*, eye_exams(*), reviews(*)'

export class SupabaseRepository implements ScreeningRepository {
  readonly kind = 'supabase' as const

  constructor(private readonly client: SupabaseClient) {}

  async init() {
    // Fails fast (and lets the factory fall back) if the schema is missing.
    const { error } = await this.client.from('screenings').select('id').limit(1)
    if (error) throw error
  }

  async listScreenings(): Promise<Screening[]> {
    const { data, error } = await this.client
      .from('screenings')
      .select(SELECT)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data as ScreeningRow[]).map(toScreening)
  }

  async getScreening(id: string) {
    const { data, error } = await this.client
      .from('screenings')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? toScreening(data as ScreeningRow) : null
  }

  async saveScreening(s: Screening) {
    const { error } = await this.client.from('screenings').upsert({
      id: s.id,
      patient: s.patient,
      site: s.site,
      created_at: s.createdAt,
      status: s.status,
      priority: s.priority,
      worst_grade: s.worstGrade,
      lowest_confidence: s.lowestConfidence,
      referral_suggested: s.referralSuggested,
      synced: s.synced,
      demo_case_id: s.demoCaseId ?? null,
    })
    if (error) throw error

    const eyeRows = (Object.values(s.eyes).filter(Boolean) as EyeExam[]).map((e) => ({
      screening_id: s.id,
      side: e.side,
      image_src: e.imageSrc,
      image_label: e.imageLabel,
      quality: e.quality,
      analysis: e.analysis,
    }))
    if (eyeRows.length) {
      const { error: eyeError } = await this.client
        .from('eye_exams')
        .upsert(eyeRows, { onConflict: 'screening_id,side' })
      if (eyeError) throw eyeError
    }

    if (s.review) {
      const { error: reviewError } = await this.client.from('reviews').upsert({
        screening_id: s.id,
        decision: s.review.decision,
        disagreed_with_model: s.review.disagreedWithModel,
        reason: s.review.reason,
        clinician_name: s.review.clinicianName,
        decided_at: s.review.decidedAt,
      })
      if (reviewError) throw reviewError
    }
  }

  async deleteScreening(id: string) {
    const { error } = await this.client.from('screenings').delete().eq('id', id)
    if (error) throw error
  }

  async listAudit(): Promise<AuditEntry[]> {
    const { data, error } = await this.client
      .from('audit_log')
      .select('*')
      .order('at', { ascending: false })
      .limit(500)
    if (error) throw error
    return (data ?? []).map((r: Record<string, string>) => ({
      id: r.id,
      screeningId: r.screening_id,
      at: r.at,
      actor: r.actor,
      event: r.event,
      detail: r.detail,
    }))
  }

  async appendAudit(entry: AuditEntry) {
    const { error } = await this.client.from('audit_log').insert({
      id: entry.id,
      screening_id: entry.screeningId,
      at: entry.at,
      actor: entry.actor,
      event: entry.event,
      detail: entry.detail,
    })
    if (error) throw error
  }

  async reset() {
    await this.client.from('audit_log').delete().neq('id', '')
    await this.client.from('screenings').delete().neq('id', '')
  }
}
