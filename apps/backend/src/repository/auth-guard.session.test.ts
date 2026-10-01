import { expect, test } from 'vite-plus/test'

import { SESSION_COOKIE, createSessionAuthGuard } from './auth-guard.session.ts'
import type { SessionTokenRepository } from './session-token.repository.ts'

const sessionTokens: SessionTokenRepository = {
  issue: async () => 'unused',
  verify: async (token) => (token === 'valid' ? 'user-1' : null),
}
const guard = createSessionAuthGuard(sessionTokens)

const requestWith = (cookie?: string) =>
  new Request('http://localhost/me', cookie ? { headers: { cookie } } : {})

test('identifies the user by the session cookie', async () => {
  await expect(
    guard.authenticate(requestWith(`theme=dark; ${SESSION_COOKIE}=valid`)),
  ).resolves.toEqual({ id: 'user-1' })
})

test('rejects a request without the cookie, or with an invalid one', async () => {
  await expect(guard.authenticate(requestWith())).resolves.toBeNull()
  await expect(guard.authenticate(requestWith('session=valid'))).resolves.toBeNull()
  await expect(guard.authenticate(requestWith(`${SESSION_COOKIE}=forged`))).resolves.toBeNull()
})
