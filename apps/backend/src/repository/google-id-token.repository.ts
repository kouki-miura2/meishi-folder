import { verifyWithJwks } from 'hono/jwt'

type Jwk = NonNullable<Parameters<typeof verifyWithJwks>[1]['keys']>[number]

const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISSUER = /^(https:\/\/)?accounts\.google\.com$/
// Google rotates its signing keys well ahead of using them, so an hour-old copy stays valid.
const KEYS_TTL_MS = 60 * 60 * 1000

let cachedKeys: { keys: Jwk[]; expiresAt: number } | null = null

const loadGoogleKeys = async (): Promise<Jwk[]> => {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys
  const response = await fetch(GOOGLE_JWKS_URI)
  if (!response.ok) throw new Error(`failed to fetch Google JWKS: ${response.status}`)
  const { keys } = (await response.json()) as { keys: Jwk[] }
  cachedKeys = { keys, expiresAt: Date.now() + KEYS_TTL_MS }
  return keys
}

/** The Google account an ID token was issued to. */
export interface GoogleAccount {
  /** The account's `sub`: the app's user id. */
  id: string
  email: string
  name: string
  picture: string | null
}

export interface GoogleIdTokenRepository {
  /** The account of a valid ID token (signature, issuer, audience, expiry), or `null`. */
  verify: (idToken: string) => Promise<GoogleAccount | null>
}

export interface GoogleIdTokenRepositoryOptions {
  /** OAuth client id the ID token must be issued for (`aud`). */
  clientId: string
  /** Signing keys to verify against; defaults to Google's published JWKS. */
  loadKeys?: () => Promise<Jwk[]>
}

const stringClaim = (value: unknown) => (typeof value === 'string' ? value : null)

export const createGoogleIdTokenRepository = ({
  clientId,
  loadKeys = loadGoogleKeys,
}: GoogleIdTokenRepositoryOptions): GoogleIdTokenRepository => ({
  verify: async (idToken) => {
    try {
      const payload = await verifyWithJwks(idToken, {
        keys: await loadKeys(),
        allowedAlgorithms: ['RS256'],
        verification: { iss: GOOGLE_ISSUER, aud: clientId },
      })
      const id = stringClaim(payload.sub)
      if (!id) return null
      return {
        id,
        email: stringClaim(payload.email) ?? '',
        name: stringClaim(payload.name) ?? '',
        picture: stringClaim(payload.picture),
      }
    } catch {
      return null
    }
  },
})
