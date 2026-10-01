import type { QueryClient } from '@tanstack/vue-query'
import { useMutation, useQueryClient } from '@tanstack/vue-query'

import { apiClient, unwrap } from '../api/client.ts'
import { useAuthStore } from '../stores/auth.ts'

/**
 * Trades the Google ID token from "Sign in with Google" for the app's own session (an HttpOnly
 * cookie of `LIMITS.sessionHours`), then remembers the account it belongs to.
 */
export const useSignInMutation = (queryClient?: QueryClient) => {
  const auth = useAuthStore()
  return useMutation(
    {
      mutationFn: async (idToken: string) =>
        unwrap(await apiClient.session.$post({ json: { idToken } })),
      onSuccess: (profile) => auth.signIn(profile),
    },
    queryClient ?? useQueryClient(),
  )
}

/** Ends the session on the server (clears the cookie). Best effort: signing out goes on regardless. */
export const endSession = async () => {
  try {
    await apiClient.session.$delete()
  } catch {
    // Offline: the cookie still runs out on its own.
  }
}
