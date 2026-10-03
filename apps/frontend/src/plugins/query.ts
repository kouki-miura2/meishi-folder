import { MutationCache, QueryCache, QueryClient } from '@tanstack/vue-query'

import { ApiError, apiClient, unwrap } from '../api/client.ts'
import { errorMessage } from '../api/errors.ts'
import { useNotificationStore } from '../stores/notification.ts'

// A 401 is handled by sending the user back to sign in (see main.ts), not by a snackbar.
const notify = (error: unknown) => {
  if (error instanceof ApiError && error.status === 401) return
  useNotificationStore().show(errorMessage(error))
}

/**
 * The app-wide query client. It lives outside components because the router guard also reads
 * through it (whether the signed-in user has a profile yet). Errors surface once, here, as a
 * snackbar; a mutation that handles its own errors sets `meta: { silent: true }`.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // `retry: false`: without it, TanStack Query's default of 3 retries with exponential backoff
      // turns one 3s-timeout request into ~20s before the error surfaces.
      retry: false,
      // Cached responses stay current until the user's data changes: this device's own writes
      // invalidate what they touch, and `syncDataVersion` catches writes from other devices. This
      // keeps the D1 reads behind the lists to the times something actually changed.
      staleTime: Infinity,
      gcTime: Infinity,
    },
  },
  queryCache: new QueryCache({ onError: notify }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!mutation.options.meta?.silent) notify(error)
    },
  }),
})

// Photos are large, and the browser's HTTP cache keeps them anyway (an id never changes content).
queryClient.setQueryDefaults(['image'], { gcTime: 5 * 60_000 })

// Kept in the query cache, so signing out (`queryClient.clear()`) forgets it with the data.
const dataVersionKey = ['dataVersion']

/** Records the version a write of this device's own produced; the write refreshes what it changed. */
export const adoptDataVersion = (version: string) => {
  queryClient.setQueryData(dataVersionKey, version)
}

let pendingSync: Promise<void> | undefined

/**
 * Asks the API for the user's data version (a single-row read) and refetches cached data only if
 * it differs from the version the cache was built against, i.e. another device changed something.
 * The first check after signing in just records the version: the cache starts empty then.
 */
export const syncDataVersion = () =>
  (pendingSync ??= (async () => {
    const known = queryClient.getQueryData<string | null>(dataVersionKey)
    const { version } = await unwrap(await apiClient['data-version'].$get())
    queryClient.setQueryData(dataVersionKey, version)
    if (known !== undefined && known !== version) await queryClient.invalidateQueries()
  })().finally(() => {
    pendingSync = undefined
  }))
