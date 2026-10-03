import { QueryClient } from '@tanstack/vue-query'
import { afterEach, expect, test, vi } from 'vite-plus/test'
import { effectScope, ref } from 'vue'

vi.mock('../api/client.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client.ts')>()),
  apiClient: {
    cards: {
      $get: vi.fn(),
      $post: vi.fn(),
      extract: { $post: vi.fn() },
      export: { $get: vi.fn() },
    },
    images: { ':id': { $get: vi.fn() } },
  },
}))

import { apiClient } from '../api/client.ts'
import { CardLimitError } from '../api/errors.ts'
import { type CardFilter, emptyCardFilter } from '../domain/card-filter.ts'
import {
  fetchCardCount,
  useCardQuery,
  useCardImageUrl,
  useCreateCardMutation,
  useCardsQuery,
  useExportCardsMutation,
  useExtractCardMutation,
} from './useCards.ts'

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

test('useCardsQuery fetches every card once and narrows them on screen as the filter changes', async () => {
  vi.mocked(apiClient.cards.$get).mockResolvedValue(
    respond(200, [
      { id: 'a', projects: [], groups: [] },
      { id: 'b', projects: [{ id: 't-1', name: 'Apollo' }], groups: [] },
    ]),
  )
  const filter = ref<CardFilter>({ q: '', topicIds: [], match: 'any', sort: 'name' })
  const { result, dispose } = run((client) => useCardsQuery(filter, client))

  await vi.waitFor(() => expect(result.data.value).toHaveLength(2))

  filter.value = { ...filter.value, topicIds: ['t-1'] }
  expect(result.data.value?.map((card) => card.id)).toEqual(['b'])
  expect(apiClient.cards.$get).toHaveBeenCalledOnce()
  dispose()
})

test('useCardQuery reads the card out of the list cache, null once it is gone', async () => {
  vi.mocked(apiClient.cards.$get).mockResolvedValue(respond(200, [{ id: 'a' }, { id: 'b' }]))
  const id = ref('b')
  const { client, result, dispose } = run((c) => {
    // As in the app (plugins/query.ts): cached data stays until it is invalidated.
    c.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } })
    return useCardsQuery(ref(emptyCardFilter()), c)
  })
  await vi.waitFor(() => expect(result.data.value).toHaveLength(2))

  const scope = effectScope()
  const card = scope.run(() => useCardQuery(id, client))!
  await vi.waitFor(() => expect(card.data.value).toEqual({ id: 'b' }))
  id.value = 'missing'
  await vi.waitFor(() => expect(card.data.value).toBeNull())

  expect(apiClient.cards.$get).toHaveBeenCalledOnce()
  scope.stop()
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

test('useExportCardsMutation resolves the CSV as a blob and fails on an error status', async () => {
  vi.mocked(apiClient.cards.export.$get).mockResolvedValueOnce(respond(200))
  const { result, dispose } = run((client) => useExportCardsMutation(client))

  await expect(result.mutateAsync()).resolves.toBeInstanceOf(Blob)

  vi.mocked(apiClient.cards.export.$get).mockResolvedValueOnce(respond(500))
  await expect(result.mutateAsync()).rejects.toMatchObject({ status: 500 })
  dispose()
})

test('fetchCardCount counts the cards, sharing the card list cache', async () => {
  vi.mocked(apiClient.cards.$get).mockResolvedValue(respond(200, [{ id: 'a' }, { id: 'b' }]))
  const { client, dispose } = run((c) => c)

  await expect(fetchCardCount(client)).resolves.toBe(2)
  expect(client.getQueryData(['cards'])).toHaveLength(2)
  dispose()
})

test('useCreateCardMutation reports a 409 as the card limit', async () => {
  vi.mocked(apiClient.cards.$post).mockResolvedValue(respond(409))
  const { result, dispose } = run((client) => useCreateCardMutation(client))

  await expect(result.mutateAsync({ name: '佐藤' })).rejects.toBeInstanceOf(CardLimitError)
  dispose()
})
