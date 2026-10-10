import type { QueryClient } from '@tanstack/vue-query'
import { useMutation, useQueryClient } from '@tanstack/vue-query'

import { apiClient, unwrap } from '../api/client.ts'
import { forgetLastScene } from '../lib/last-scene.ts'
import { useAuthStore } from '../stores/auth.ts'

/**
 * Trades the Google ID token from "Sign in with Google" for the app's own session (an HttpOnly
 * cookie of `LIMITS.sessionHours`), then remembers the account it belongs to.
 *
 * Cached responses are dropped first: a session that ran out on a shared device never hit a 401
 * (nothing cleared them), and the next person to sign in must not see the previous one's cards.
 */
export const useSignInMutation = (queryClient?: QueryClient) => {
  const auth = useAuthStore()
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async (idToken: string) =>
        unwrap(await apiClient.session.$post({ json: { idToken } })),
      onSuccess: (profile) => {
        client.clear()
        if (auth.profile && auth.profile.email !== profile.email) forgetLastScene()
        auth.signIn(profile)
      },
    },
    client,
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
