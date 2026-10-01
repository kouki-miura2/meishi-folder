import { createRouter, createWebHistory } from 'vue-router'

import { meQueryOptions } from '../composables/useMe.ts'
import { queryClient } from '../plugins/query.ts'
import { useAuthStore } from '../stores/auth.ts'
import { createAuthGuard } from './guard.ts'
import { routes } from './routes.ts'

export const router = createRouter({
  history: createWebHistory(),
  routes,
  // Back to a list keeps its scroll position; a new screen starts at the top.
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

router.beforeEach(
  createAuthGuard({
    isSignedIn: () => useAuthStore().isSignedIn(),
    hasProfile: async () => (await queryClient.fetchQuery(meQueryOptions)) !== null,
  }),
)
