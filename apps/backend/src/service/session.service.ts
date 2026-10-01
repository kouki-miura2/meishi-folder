import { LIMITS } from 'utils'

import type { GoogleIdTokenRepository } from '../repository/google-id-token.repository.ts'
import type { SessionTokenRepository } from '../repository/session-token.repository.ts'

export interface Session {
  /** Goes into the session cookie; never shown to the page's scripts. */
  token: string
  /** What the app shows about the signed-in Google account. */
  account: { email: string; name: string; picture: string | null }
  /** Seconds since the epoch. */
  expiresAt: number
}

export interface SessionService {
  /** Trades a Google ID token for a session of `LIMITS.sessionHours`, or `null` if it's invalid. */
  signIn: (idToken: string) => Promise<Session | null>
}

export interface SessionServiceDependencies {
  googleIdTokenRepository: GoogleIdTokenRepository
  sessionTokenRepository: SessionTokenRepository
  /** Current time in milliseconds; only tests replace it. */
  now?: () => number
}

export const createSessionService = ({
  googleIdTokenRepository,
  sessionTokenRepository,
  now = Date.now,
}: SessionServiceDependencies): SessionService => ({
  signIn: async (idToken) => {
    const google = await googleIdTokenRepository.verify(idToken)
    if (!google) return null
    const expiresAt = Math.floor(now() / 1000) + LIMITS.sessionHours * 60 * 60
    const { id, ...account } = google
    return { token: await sessionTokenRepository.issue(id, expiresAt), account, expiresAt }
  },
})
