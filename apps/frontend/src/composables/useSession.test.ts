import { QueryClient } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test'
import { effectScope } from 'vue'

vi.mock('../api/client.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client.ts')>()),
  apiClient: { session: { $post: vi.fn(), $delete: vi.fn() } },
}))

import { apiClient } from '../api/client.ts'
import { useAuthStore } from '../stores/auth.ts'
import { endSession, useSignInMutation } from './useSession.ts'

const respond = (status: number, body: unknown = {}) =>
  ({ ok: status < 400, status, json: async () => body }) as never

const profile = {
  email: 'a@example.com',
  name: '山田',
  picture: null,
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
}

const run = <T>(fn: (client: QueryClient) => T) => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const scope = effectScope()
  const result = scope.run(() => fn(client)) as T
  return { result, dispose: () => scope.stop() }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.clearAllMocks()
})

test('useSignInMutation sends the ID token and signs in with the returned profile', async () => {
  vi.mocked(apiClient.session.$post).mockResolvedValue(respond(200, profile))
  const { result, dispose } = run((client) => useSignInMutation(client))

  await result.mutateAsync('google-token')

  expect(apiClient.session.$post).toHaveBeenCalledWith({ json: { idToken: 'google-token' } })
  expect(useAuthStore().profile).toEqual(profile)
  dispose()
})

test('useSignInMutation stays signed out when the API refuses the ID token', async () => {
  vi.mocked(apiClient.session.$post).mockResolvedValue(respond(401))
  const { result, dispose } = run((client) => useSignInMutation(client))

  await expect(result.mutateAsync('forged')).rejects.toMatchObject({ status: 401 })

  expect(useAuthStore().isSignedIn()).toBe(false)
  dispose()
})

test('endSession clears the cookie and does not throw when offline', async () => {
  vi.mocked(apiClient.session.$delete).mockRejectedValue(new TypeError('Failed to fetch'))

  await expect(endSession()).resolves.toBeUndefined()
  expect(apiClient.session.$delete).toHaveBeenCalledOnce()
})
