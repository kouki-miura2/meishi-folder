import { verifyWithJwks } from 'hono/jwt'

import type { AuthGuard } from './auth-guard.interface.ts'

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

export interface GoogleAuthGuardOptions {
  /** OAuth client id the ID token must be issued for (`aud`). */
  clientId: string
  /** Signing keys to verify against; defaults to Google's published JWKS. */
  loadKeys?: () => Promise<Jwk[]>
}

/**
 * Verifies a Google ID token sent as `Authorization: Bearer <token>` (signature, issuer,
 * audience, expiry) and identifies the user by the token's `sub`.
 */
export const createGoogleAuthGuard = ({
  clientId,
  loadKeys = loadGoogleKeys,
}: GoogleAuthGuardOptions): AuthGuard => ({
  authenticate: async (request) => {
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]
    if (!token) return null
    try {
      const payload = await verifyWithJwks(token, {
        keys: await loadKeys(),
        allowedAlgorithms: ['RS256'],
        verification: { iss: GOOGLE_ISSUER, aud: clientId },
      })
      return typeof payload.sub === 'string' ? { id: payload.sub } : null
    } catch {
      return null
    }
  },
})
