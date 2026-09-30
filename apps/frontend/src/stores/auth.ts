import { defineStore } from 'pinia'
import { LIMITS } from 'utils'
import { computed, ref } from 'vue'

/** What the app shows about the signed-in Google account (from the ID token's claims). */
export interface GoogleProfile {
  email: string
  name: string
  picture: string | null
  /** Seconds since the epoch. */
  expiresAt: number
}

const STORAGE_KEY = 'meishi-folder.idToken'

/** Decodes a JWT's payload (base64url JSON, UTF-8 so Japanese names survive). No signature check: the backend does that. */
export const decodeIdToken = (token: string): GoogleProfile | null => {
  try {
    const payload = token.split('.')[1] ?? ''
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
    if (typeof claims.exp !== 'number') return null
    return {
      email: typeof claims.email === 'string' ? claims.email : '',
      name: typeof claims.name === 'string' ? claims.name : '',
      picture: typeof claims.picture === 'string' ? claims.picture : null,
      expiresAt: claims.exp,
    }
  } catch {
    return null
  }
}

// sessionStorage keeps the token across a reload of the tab, not across tabs or restarts. It can
// be missing (tests run in Node) or throw (storage blocked), so every access is guarded.
const readStored = () => {
  try {
    return globalThis.sessionStorage?.getItem(STORAGE_KEY) ?? null
  } catch {
    return null
  }
}
const writeStored = (token: string | null) => {
  try {
    if (token) globalThis.sessionStorage?.setItem(STORAGE_KEY, token)
    else globalThis.sessionStorage?.removeItem(STORAGE_KEY)
  } catch {
    // Storage blocked: the session just won't survive a reload.
  }
}

/** Global auth state: the Google ID token the API client sends, and the profile it carries. */
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(readStored())
  const profile = computed(() => (token.value ? decodeIdToken(token.value) : null))

  /**
   * A time check, not a computed: it has to be re-evaluated at the moment of each request. Treats a
   * token as gone a little early, so a request never leaves with one about to expire.
   */
  const hasValidToken = (now = Date.now()) =>
    !!profile.value && profile.value.expiresAt - LIMITS.tokenExpiryMarginSeconds > now / 1000

  const signIn = (idToken: string) => {
    if (!decodeIdToken(idToken)) return false
    token.value = idToken
    writeStored(idToken)
    return true
  }

  const signOut = () => {
    token.value = null
    writeStored(null)
  }

  const validToken = () => (hasValidToken() ? token.value : null)

  return { token, profile, hasValidToken, validToken, signIn, signOut }
})
