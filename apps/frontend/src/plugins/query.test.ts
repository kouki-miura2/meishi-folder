import { afterEach, expect, test, vi } from 'vite-plus/test'

vi.mock('../api/client.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client.ts')>()),
  apiClient: { 'data-version': { $get: vi.fn() } },
}))

import { apiClient } from '../api/client.ts'
import { adoptDataVersion, queryClient, syncDataVersion } from './query.ts'

const serverVersion = (version: string | null) =>
  vi
    .mocked(apiClient['data-version'].$get)
    .mockResolvedValue({ ok: true, status: 200, json: async () => ({ version }) } as never)

/** A cached response, as a list query leaves it. */
const cacheCards = () => queryClient.setQueryData(['cards', {}], [])
const cardsInvalidated = () => queryClient.getQueryState(['cards', {}])?.isInvalidated

afterEach(() => {
  queryClient.clear()
  vi.clearAllMocks()
})

test('the first check only records the version: the cache was just built', async () => {
  serverVersion('v-1')
  cacheCards()

  await syncDataVersion()

  expect(cardsInvalidated()).toBe(false)
})

test('cached data stays while the server version is unchanged', async () => {
  serverVersion('v-1')
  await syncDataVersion()
  cacheCards()

  await syncDataVersion()

  expect(cardsInvalidated()).toBe(false)
})

test('a version changed elsewhere invalidates the cached data', async () => {
  serverVersion('v-1')
  await syncDataVersion()
  cacheCards()

  serverVersion('v-2')
  await syncDataVersion()

  expect(cardsInvalidated()).toBe(true)
})

test("this device's own write is not taken for a change elsewhere", async () => {
  serverVersion('v-1')
  await syncDataVersion()
  adoptDataVersion('v-2')
  cacheCards()

  serverVersion('v-2')
  await syncDataVersion()

  expect(cardsInvalidated()).toBe(false)
})

test('checks made at the same time share one request', async () => {
  serverVersion('v-1')

  await Promise.all([syncDataVersion(), syncDataVersion()])

  expect(apiClient['data-version'].$get).toHaveBeenCalledOnce()
})
