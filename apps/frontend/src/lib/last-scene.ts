import type { CardForm } from '../domain/card-form.ts'

export type SceneField = 'metOn' | 'metAt' | 'metOccasion'
export type Scene = Partial<Record<SceneField, string>>

const KEY = 'meishi:last-scene'
const FIELDS: SceneField[] = ['metOn', 'metAt', 'metOccasion']

// The scene of the last saved card, kept on this device so the next card of a batch taken at the
// same place can reuse it. Storage can be missing or throw (private mode, blocked site data): then
// there's simply no suggestion.
const storage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export const loadLastScene = (store = storage()): Scene => {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(KEY) ?? '{}')
    if (typeof parsed !== 'object' || parsed === null) return {}
    const record = parsed as Record<string, unknown>
    return Object.fromEntries(
      FIELDS.flatMap((f) => (typeof record[f] === 'string' && record[f] ? [[f, record[f]]] : [])),
    )
  } catch {
    return {}
  }
}

/** Remembers the filled scene fields of a saved card; an empty field keeps the older value. */
export const rememberScene = (form: CardForm, store = storage()) => {
  const next: Scene = { ...loadLastScene(store) }
  for (const f of FIELDS) {
    const value = form[f].trim()
    if (value) next[f] = value
  }
  try {
    store?.setItem(KEY, JSON.stringify(next))
  } catch {
    // Not remembering is fine.
  }
}

/** Forgets it on sign-out, so the next person on this device doesn't see it. */
export const forgetLastScene = (store = storage()) => {
  try {
    store?.removeItem(KEY)
  } catch {
    // Nothing to forget.
  }
}
