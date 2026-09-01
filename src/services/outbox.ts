import { createStore, get, set } from 'idb-keyval'
import type { Screening } from '../types'

/* The offline queue. Independent of the backend: a screening captured with no
   connectivity lands here first and is pushed when the worker goes online. */

const store = createStore('drishti-dr', 'kv')
const KEY = 'outbox'

export async function readOutbox(): Promise<Screening[]> {
  return (await get<Screening[]>(KEY, store)) ?? []
}

export async function writeOutbox(items: Screening[]) {
  await set(KEY, items, store)
}

export async function enqueue(screening: Screening) {
  const items = await readOutbox()
  const next = items.filter((s) => s.id !== screening.id)
  next.push({ ...screening, synced: false, status: 'pending_sync' })
  await writeOutbox(next)
  return next
}

export async function dequeue(id: string) {
  const items = await readOutbox()
  const next = items.filter((s) => s.id !== id)
  await writeOutbox(next)
  return next
}
