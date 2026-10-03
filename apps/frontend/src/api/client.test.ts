import { afterEach, expect, test, vi } from 'vite-plus/test'

import { ApiError, apiClient, configureApiClient, longRequest, unwrap } from './client.ts'

const fetchReturning = (response: Response) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)

const initOf = (fetchSpy: ReturnType<typeof fetchReturning>) =>
  (fetchSpy.mock.calls[0] as [RequestInfo, RequestInit])[1]

afterEach(() => {
  vi.restoreAllMocks()
  configureApiClient({ onUnauthorized: () => {}, onDataVersion: () => {} })
})

test('exposes a typed RPC method for each backend route', () => {
  expect(apiClient.me.$get).toBeTypeOf('function')
  expect(apiClient.cards[':id'].$patch).toBeTypeOf('function')
  expect(apiClient.companies[':id'].merge.$post).toBeTypeOf('function')
})

test('sends requests with an abort signal so they time out', async () => {
  const fetchSpy = fetchReturning(new Response('{}'))

  await apiClient.me.$get()

  expect(initOf(fetchSpy).signal).toBeInstanceOf(AbortSignal)
})

test('sends no Authorization header: the session is a cookie', async () => {
  const fetchSpy = fetchReturning(new Response('{}'))

  await apiClient.me.$get()

  expect(new Headers(initOf(fetchSpy).headers).has('authorization')).toBe(false)
})

test('reports a 401 so the app can send the user back to sign in', async () => {
  fetchReturning(new Response('{}', { status: 401 }))
  const onUnauthorized = vi.fn()
  configureApiClient({ onUnauthorized, onDataVersion: () => {} })

  await apiClient.me.$get()

  expect(onUnauthorized).toHaveBeenCalledOnce()
})

test('reports the data version a write returns, and nothing for a response without one', async () => {
  const onDataVersion = vi.fn()
  configureApiClient({ onUnauthorized: () => {}, onDataVersion })
  fetchReturning(new Response(null, { status: 204, headers: { 'X-Data-Version': 'v-2' } }))

  await apiClient.cards[':id'].$delete({ param: { id: 'card-1' } })
  vi.mocked(globalThis.fetch).mockResolvedValue(new Response('{}'))
  await apiClient.me.$get()

  expect(onDataVersion.mock.calls).toEqual([['v-2']])
})

test('longRequest keeps its own signal instead of the default timeout', async () => {
  const fetchSpy = fetchReturning(new Response('{}'))
  const options = longRequest()

  await apiClient.cards.extract.$post({ json: { frontImageId: 'img-1' } }, options)

  expect(initOf(fetchSpy).signal).toBe(options.init.signal)
})

test('unwrap resolves the body of a success and throws an ApiError otherwise', async () => {
  await expect(unwrap(new Response('{"a":1}'))).resolves.toEqual({ a: 1 })

  const error = await unwrap(new Response('{}', { status: 409 })).catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).status).toBe(409)
})
