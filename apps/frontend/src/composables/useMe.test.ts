import { QueryClient } from '@tanstack/vue-query'
import { afterEach, expect, test, vi } from 'vite-plus/test'
import { effectScope } from 'vue'

vi.mock('../api/client.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client.ts')>()),
  apiClient: { me: { $get: vi.fn(), $put: vi.fn() } },
}))

import { apiClient } from '../api/client.ts'
import { useMeQuery, useSaveMeMutation } from './useMe.ts'

const respond = (status: number, body: unknown = {}) =>
  ({ ok: status < 400, status, json: async () => body }) as never

const me = { name: '山田 陽子', nameKana: null, affiliations: [] }

const run = <T>(fn: (client: QueryClient) => T) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const scope = effectScope()
  const result = scope.run(() => fn(client)) as T
  return { client, result, dispose: () => scope.stop() }
}

afterEach(() => {
  vi.clearAllMocks()
})

test('useMeQuery resolves the profile', async () => {
  vi.mocked(apiClient.me.$get).mockResolvedValue(respond(200, me))
  const { result, dispose } = run((client) => useMeQuery(client))

  await vi.waitFor(() => expect(result.isSuccess.value).toBe(true))

  expect(result.data.value).toEqual(me)
  dispose()
})

test('useMeQuery resolves null, not an error, before the profile exists', async () => {
  vi.mocked(apiClient.me.$get).mockResolvedValue(respond(404, { error: 'Not Found' }))
  const { result, dispose } = run((client) => useMeQuery(client))

  await vi.waitFor(() => expect(result.isSuccess.value).toBe(true))

  expect(result.data.value).toBeNull()
  dispose()
})

test('useSaveMeMutation caches the saved profile and refreshes the masters', async () => {
  vi.mocked(apiClient.me.$put).mockResolvedValue(respond(200, me))
  const { client, result, dispose } = run((c) => useSaveMeMutation(c))
  const invalidate = vi.spyOn(client, 'invalidateQueries')

  await result.mutateAsync({ name: '山田 陽子', affiliations: [] })

  expect(client.getQueryData(['me'])).toEqual(me)
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['companies'] })
  dispose()
})
