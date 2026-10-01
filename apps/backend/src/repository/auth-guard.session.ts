import { parse } from 'hono/utils/cookie'

import type { AuthGuard } from './auth-guard.interface.ts'
import type { SessionTokenRepository } from './session-token.repository.ts'

/**
 * The session cookie. The `__Host-` prefix makes the browser accept it only with `Secure`,
 * `Path=/` and no `Domain`, so no other (sub)domain can set or read it.
 */
export const SESSION_COOKIE = '__Host-session'

/** Identifies the user by the session token in the `SESSION_COOKIE` cookie. */
export const createSessionAuthGuard = (sessionTokens: SessionTokenRepository): AuthGuard => ({
  authenticate: async (request) => {
    const token = parse(request.headers.get('cookie') ?? '', SESSION_COOKIE)[SESSION_COOKIE]
    if (!token) return null
    const id = await sessionTokens.verify(token)
    return id ? { id } : null
  },
})
