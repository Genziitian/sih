import { createStore, del, get, set } from 'idb-keyval'
import type { AuditEntry, Screening } from '../../types'
import type { ScreeningRepository } from './types'

const store = createStore('drishti-dr', 'kv')
const SCREENINGS = 'screenings'
const AUDIT = 'audit'

/** Browser-only persistence. This is what runs when Supabase is not configured. */
export class LocalRepository implements ScreeningRepository {
  readonly kind = 'local' as const

  async init() {
    /* IndexedDB needs no migration. */
  }

  async listScreenings(): Promise<Screening[]> {
    return (await get<Screening[]>(SCREENINGS, store)) ?? []
  }

  async getScreening(id: string) {
    const all = await this.listScreenings()
    return all.find((s) => s.id === id) ?? null
  }

  async saveScreening(screening: Screening) {
    const all = await this.listScreenings()
    const idx = all.findIndex((s) => s.id === screening.id)
    if (idx >= 0) all[idx] = screening
    else all.unshift(screening)
    await set(SCREENINGS, all, store)
  }

  async deleteScreening(id: string) {
    const all = await this.listScreenings()
    await set(
      SCREENINGS,
      all.filter((s) => s.id !== id),
      store,
    )
  }

  async listAudit(): Promise<AuditEntry[]> {
    return (await get<AuditEntry[]>(AUDIT, store)) ?? []
  }

  async appendAudit(entry: AuditEntry) {
    const all = await this.listAudit()
    all.unshift(entry)
    await set(AUDIT, all.slice(0, 500), store)
  }

  async reset() {
    await del(SCREENINGS, store)
    await del(AUDIT, store)
  }
}
