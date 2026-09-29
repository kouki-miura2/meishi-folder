import { expect, test, vi } from 'vite-plus/test'
import { createMemoryHistory, createRouter } from 'vue-router'

import { createAuthGuard } from './guard.ts'
import { routes } from './routes.ts'

const router = createRouter({ history: createMemoryHistory(), routes })
const to = (path: string) => router.resolve(path)

test('lets anyone reach a public route', async () => {
  const guard = createAuthGuard({ isSignedIn: () => false, hasProfile: async () => false })

  await expect(guard(to('/login'))).resolves.toBe(true)
})

test('sends a signed-out user to sign in, remembering where they were going', async () => {
  const guard = createAuthGuard({ isSignedIn: () => false, hasProfile: async () => true })

  await expect(guard(to('/cards/c-1'))).resolves.toEqual({
    name: 'login',
    query: { redirect: '/cards/c-1' },
  })
  await expect(guard(to('/'))).resolves.toEqual({ name: 'login', query: {} })
})

test('sends a signed-in user without a profile to the welcome screen', async () => {
  const guard = createAuthGuard({ isSignedIn: () => true, hasProfile: async () => false })

  await expect(guard(to('/'))).resolves.toEqual({ name: 'welcome' })
  await expect(guard(to('/welcome'))).resolves.toBe(true)
})

test('lets a signed-in user with a profile through, without re-checking on the welcome screen', async () => {
  const hasProfile = vi.fn(async () => true)
  const guard = createAuthGuard({ isSignedIn: () => true, hasProfile })

  await expect(guard(to('/settings/companies'))).resolves.toBe(true)
  await expect(guard(to('/welcome'))).resolves.toBe(true)
  expect(hasProfile).toHaveBeenCalledTimes(1)
})
