import { sign, verify } from 'hono/jwt'

export interface SessionTokenRepository {
  /** A token naming the user until `expiresAt` (seconds since the epoch). */
  issue: (userId: string, expiresAt: number) => Promise<string>
  /** The user id of a valid, unexpired token, or `null`. */
  verify: (token: string) => Promise<string | null>
}

/**
 * The app's own sign-in, an HS256 JWT signed with a server secret. Stateless: nothing is stored,
 * so a token can't be revoked before it expires — keep its lifetime short (`LIMITS.sessionHours`).
 */
export const createSessionTokenRepository = ({
  secret,
}: {
  secret: string
}): SessionTokenRepository => ({
  issue: (userId, expiresAt) => sign({ sub: userId, exp: expiresAt }, secret, 'HS256'),
  verify: async (token) => {
    try {
      const payload = await verify(token, secret, 'HS256')
      return typeof payload.sub === 'string' ? payload.sub : null
    } catch {
      return null
    }
  },
})
