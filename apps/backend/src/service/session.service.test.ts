import { LIMITS } from 'utils'
import { expect, test } from 'vite-plus/test'

import type { GoogleIdTokenRepository } from '../repository/google-id-token.repository.ts'
import type { SessionTokenRepository } from '../repository/session-token.repository.ts'
import { createSessionService } from './session.service.ts'

const googleIdTokenRepository: GoogleIdTokenRepository = {
  verify: async (idToken) =>
    idToken === 'google-token'
      ? { id: 'user-1', email: 'a@example.com', name: '山田', picture: null }
      : null,
}
const sessionTokenRepository: SessionTokenRepository = {
  issue: async (userId, expiresAt) => `${userId}@${expiresAt}`,
  verify: async () => null,
}
const NOW_MS = 1_800_000_000_000

const service = createSessionService({
  googleIdTokenRepository,
  sessionTokenRepository,
  now: () => NOW_MS,
})

test('signIn trades a valid Google ID token for a session of LIMITS.sessionHours', async () => {
  const expiresAt = NOW_MS / 1000 + LIMITS.sessionHours * 3600

  await expect(service.signIn('google-token')).resolves.toEqual({
    token: `user-1@${expiresAt}`,
    account: { email: 'a@example.com', name: '山田', picture: null },
    expiresAt,
  })
})

test('signIn refuses an invalid Google ID token', async () => {
  await expect(service.signIn('forged')).resolves.toBeNull()
})
