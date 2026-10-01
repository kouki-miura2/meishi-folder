import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * What the app shows about the signed-in Google account, and when the sign-in ends. The session
 * itself is an HttpOnly cookie the page's scripts can't read; this is only its public side.
 */
export interface GoogleProfile {
  email: string
  name: string
  picture: string | null
  /** Seconds since the epoch. */
  expiresAt: number
}

const STORAGE_KEY = 'meishi-folder.profile'

const isProfile = (value: unknown): value is GoogleProfile => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.email === 'string' &&
    typeof v.name === 'string' &&
    (typeof v.picture === 'string' || v.picture === null) &&
    typeof v.expiresAt === 'number'
  )
}

// localStorage keeps the profile as long as the session cookie lasts, across tabs and restarts.
// It can be missing (tests run in Node) or throw (storage blocked), so every access is guarded.
const readStored = (): GoogleProfile | null => {
  try {
    const value: unknown = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null')
    return isProfile(value) ? value : null
  } catch {
    return null
  }
}
const writeStored = (profile: GoogleProfile | null) => {
  try {
    if (profile) globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(profile))
    else globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    // Storage blocked: the sign-in just won't be remembered across a reload.
  }
}

/** Global auth state: who is signed in (per the last `POST /session`) and until when. */
export const useAuthStore = defineStore('auth', () => {
  const stored = ref<GoogleProfile | null>(readStored())
  const profile = computed(() => stored.value)

  /**
   * A time check, not a computed: it has to be re-evaluated at each navigation. The API is the
   * authority (a 401 signs out); this only saves a round trip once the session has run out.
   */
  const isSignedIn = (now = Date.now()) => !!stored.value && stored.value.expiresAt > now / 1000

  const signIn = (next: GoogleProfile) => {
    stored.value = next
    writeStored(next)
  }

  const signOut = () => {
    stored.value = null
    writeStored(null)
  }

  return { profile, isSignedIn, signIn, signOut }
})
