import { QueryClient } from '@tanstack/vue-query'
import { afterEach, expect, test, vi } from 'vite-plus/test'
import { effectScope, ref } from 'vue'

vi.mock('../api/client.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client.ts')>()),
  apiClient: {
    companies: {
      $get: vi.fn(),
      ':id': { $delete: vi.fn(), merge: { $post: vi.fn() } },
      ':companyId': { departments: { $get: vi.fn() } },
    },
  },
}))

import { ApiError, apiClient } from '../api/client.ts'
import { useCompaniesQuery, useCompanyMutations, useDepartmentsQuery } from './useMasters.ts'

const respond = (status: number, body: unknown = {}) =>
  ({ ok: status < 400, status, json: async () => body }) as never

const run = <T>(fn: (client: QueryClient) => T) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const scope = effectScope()
  const result = scope.run(() => fn(client)) as T
  return { client, result, dispose: () => scope.stop() }
}

afterEach(() => {
  vi.clearAllMocks()
})

test('useCompaniesQuery resolves the companies with their counts', async () => {
  const companies = [{ id: 'c-1', name: 'Acme', cardCount: 2, departmentCount: 1 }]
  vi.mocked(apiClient.companies.$get).mockResolvedValue(respond(200, companies))
  const { result, dispose } = run((client) => useCompaniesQuery(client))

  await vi.waitFor(() => expect(result.isSuccess.value).toBe(true))

  expect(result.data.value).toEqual(companies)
  dispose()
})

test('useDepartmentsQuery waits for a company and fetches its departments', async () => {
  vi.mocked(apiClient.companies[':companyId'].departments.$get).mockResolvedValue(respond(200, []))
  const companyId = ref<string | null>(null)
  const { result, dispose } = run((client) => useDepartmentsQuery(companyId, client))

  expect(result.fetchStatus.value).toBe('idle')
  companyId.value = 'c-1'
  await vi.waitFor(() => expect(result.isSuccess.value).toBe(true))

  expect(apiClient.companies[':companyId'].departments.$get).toHaveBeenCalledWith({
    param: { companyId: 'c-1' },
  })
  dispose()
})

test('remove reports a company still in use as a 409 ApiError', async () => {
  vi.mocked(apiClient.companies[':id'].$delete).mockResolvedValue(respond(409))
  const { result, dispose } = run((client) => useCompanyMutations(client))

  const error = await result.remove.mutateAsync('c-1').catch((e: unknown) => e)

  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).status).toBe(409)
  dispose()
})

test('merge posts the sources to the target and refreshes every cached query', async () => {
  vi.mocked(apiClient.companies[':id'].merge.$post).mockResolvedValue(
    respond(200, { id: 'c-1', name: 'Acme' }),
  )
  const { client, result, dispose } = run((c) => useCompanyMutations(c))
  const invalidate = vi.spyOn(client, 'invalidateQueries')

  await result.merge.mutateAsync({ targetId: 'c-1', sourceIds: ['c-2'] })

  expect(apiClient.companies[':id'].merge.$post).toHaveBeenCalledWith({
    param: { id: 'c-1' },
    json: { sourceIds: ['c-2'] },
  })
  expect(invalidate).toHaveBeenCalledWith()
  dispose()
})
