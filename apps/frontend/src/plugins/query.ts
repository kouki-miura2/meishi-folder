import { MutationCache, QueryCache, QueryClient } from '@tanstack/vue-query'

import { ApiError } from '../api/client.ts'
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
  // `retry: false`: without it, TanStack Query's default of 3 retries with exponential backoff
  // turns one 3s-timeout request into ~20s before the error surfaces.
  defaultOptions: { queries: { retry: false } },
  queryCache: new QueryCache({ onError: notify }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!mutation.options.meta?.silent) notify(error)
    },
  }),
})
