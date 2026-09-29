import { QueryClient } from '@tanstack/vue-query'
import { afterEach, expect, test, vi } from 'vite-plus/test'
import { effectScope, ref } from 'vue'

vi.mock('../api/client.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client.ts')>()),
  apiClient: {
    cards: { $get: vi.fn(), extract: { $post: vi.fn() } },
    images: { ':id': { $get: vi.fn() } },
  },
}))

import { apiClient } from '../api/client.ts'
import type { CardFilter } from '../domain/card-filter.ts'
import { useCardImageUrl, useCardsQuery, useExtractCardMutation } from './useCards.ts'

const respond = (status: number, body: unknown = {}) =>
  ({ ok: status < 400, status, json: async () => body, blob: async () => new Blob(['x']) }) as never

const run = <T>(fn: (client: QueryClient) => T) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const scope = effectScope()
  const result = scope.run(() => fn(client)) as T
  return { client, result, dispose: () => scope.stop() }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

test('useCardsQuery sends only the filters in use, and refetches when they change', async () => {
  vi.mocked(apiClient.cards.$get).mockResolvedValue(respond(200, []))
  const filter = ref<CardFilter>({ q: '  ', topicIds: [], match: 'any' })
  const { result, dispose } = run((client) => useCardsQuery(filter, client))

  await vi.waitFor(() => expect(result.isSuccess.value).toBe(true))
  expect(apiClient.cards.$get).toHaveBeenLastCalledWith({ query: {} })

  filter.value = { q: ' 展示会 ', topicIds: ['t-1', 't-2'], match: 'any' }
  await vi.waitFor(() => expect(apiClient.cards.$get).toHaveBeenCalledTimes(2))
  expect(apiClient.cards.$get).toHaveBeenLastCalledWith({
    query: { q: '展示会', topicIds: 't-1,t-2', match: 'any' },
  })
  dispose()
})

test('useExtractCardMutation allows the slow AI call a long timeout', async () => {
  vi.mocked(apiClient.cards.extract.$post).mockResolvedValue(respond(200, { name: '佐藤' }))
  const { result, dispose } = run((client) => useExtractCardMutation(client))

  await expect(result.mutateAsync({ frontImageId: 'img-1' })).resolves.toEqual({ name: '佐藤' })

  const [, options] = vi.mocked(apiClient.cards.extract.$post).mock.calls[0] as unknown as [
    unknown,
    { init: RequestInit },
  ]
  expect(options.init.signal).toBeInstanceOf(AbortSignal)
  dispose()
})

test('useCardImageUrl turns the photo into an object URL and revokes it on dispose', async () => {
  vi.mocked(apiClient.images[':id'].$get).mockResolvedValue(respond(200))
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:photo')
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const { result, dispose } = run((client) => useCardImageUrl('img-1', client))

  await vi.waitFor(() => expect(result.url.value).toBe('blob:photo'))
  expect(create).toHaveBeenCalledOnce()

  dispose()
  expect(revoke).toHaveBeenCalledWith('blob:photo')
})

test('useCardImageUrl stays idle without an image', () => {
  const { result, dispose } = run((client) => useCardImageUrl(null, client))

  expect(result.url.value).toBeNull()
  expect(apiClient.images[':id'].$get).not.toHaveBeenCalled()
  dispose()
})
