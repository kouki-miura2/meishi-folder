import { useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'

import { disableGoogleAutoSelect } from '../lib/google-identity.ts'
import { forgetLastScene } from '../lib/last-scene.ts'
import { useAuthStore } from '../stores/auth.ts'
import { endSession } from './useSession.ts'

/**
 * Signs out for good (no automatic sign-in back), drops every cached response and returns to the
 * login screen: an explicit sign-out and a withdrawal both end this way.
 */
export const useSignOut = () => {
  const auth = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()
  return async () => {
    await endSession()
    disableGoogleAutoSelect()
    auth.signOut()
    forgetLastScene()
    queryClient.clear()
    await router.replace({ name: 'login' })
  }
}
