import { supabase, supabaseConfigured } from '../supabaseClient'
import { LocalRepository } from './local'
import { SupabaseRepository } from './supabase'
import type { ScreeningRepository } from './types'

export type { ScreeningRepository } from './types'

export interface BackendStatus {
  kind: 'local' | 'supabase'
  configured: boolean
  /** Set when Supabase was configured but unreachable and we fell back. */
  fallbackReason: string | null
}

let cached: { repo: ScreeningRepository; status: BackendStatus } | null = null

/**
 * Supabase when it is configured and answering; the browser store otherwise.
 * A demo must never die because a network is missing, so the fallback is
 * automatic and reported in the UI rather than thrown.
 */
export async function getRepository() {
  if (cached) return cached

  if (supabaseConfigured && supabase) {
    const repo = new SupabaseRepository(supabase)
    try {
      await repo.init()
      cached = {
        repo,
        status: { kind: 'supabase', configured: true, fallbackReason: null },
      }
      return cached
    } catch (err) {
      const local = new LocalRepository()
      await local.init()
      cached = {
        repo: local,
        status: {
          kind: 'local',
          configured: true,
          fallbackReason:
            err instanceof Error && err.message
              ? `Supabase unreachable (${err.message}). Running on the local store.`
              : 'Supabase unreachable. Running on the local store.',
        },
      }
      return cached
    }
  }

  const local = new LocalRepository()
  await local.init()
  cached = {
    repo: local,
    status: { kind: 'local', configured: false, fallbackReason: null },
  }
  return cached
}
