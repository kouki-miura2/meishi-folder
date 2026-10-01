import { expect, test } from 'vite-plus/test'

import { createSessionTokenRepository } from './session-token.repository.ts'

const SECRET = 'a-test-secret-that-is-long-enough-123'
const repository = createSessionTokenRepository({ secret: SECRET })
const inOneHour = () => Math.floor(Date.now() / 1000) + 3600

test('a token it issued verifies back to the user id', async () => {
  const token = await repository.issue('user-1', inOneHour())

  await expect(repository.verify(token)).resolves.toBe('user-1')
})

test('rejects an expired token', async () => {
  const token = await repository.issue('user-1', Math.floor(Date.now() / 1000) - 60)

  await expect(repository.verify(token)).resolves.toBeNull()
})

test('rejects a token signed with another secret, and a tampered one', async () => {
  const other = createSessionTokenRepository({ secret: 'another-secret-that-is-long-enough-456' })
  const forged = await other.issue('user-1', inOneHour())
  const [header, , signature] = (await repository.issue('user-1', inOneHour())).split('.')
  const payload = btoa(JSON.stringify({ sub: 'user-2', exp: inOneHour() })).replace(/=+$/, '')

  await expect(repository.verify(forged)).resolves.toBeNull()
  await expect(repository.verify(`${header}.${payload}.${signature}`)).resolves.toBeNull()
  await expect(repository.verify('garbage')).resolves.toBeNull()
})
