import type { AuditEntry, Screening } from '../../types'

/**
 * Persistence boundary. The app never talks to IndexedDB or Supabase directly;
 * it talks to this. Swapping backends is a factory change, not a screen change.
 */
export interface ScreeningRepository {
  readonly kind: 'local' | 'supabase'
  init(): Promise<void>
  listScreenings(): Promise<Screening[]>
  getScreening(id: string): Promise<Screening | null>
  saveScreening(screening: Screening): Promise<void>
  deleteScreening(id: string): Promise<void>
  listAudit(): Promise<AuditEntry[]>
  appendAudit(entry: AuditEntry): Promise<void>
  reset(): Promise<void>
}
