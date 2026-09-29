import type { RouteLocationRaw, RouteLocationResolved } from 'vue-router'

export interface AuthGuardDependencies {
  isSignedIn: () => boolean
  /** Whether the signed-in user has saved a profile (the welcome screen). */
  hasProfile: () => Promise<boolean>
}

/**
 * Where a navigation may go: public routes always; everything else needs a signed-in user,
 * and until that user has a profile, only the welcome screen.
 */
export const createAuthGuard =
  ({ isSignedIn, hasProfile }: AuthGuardDependencies) =>
  async (
    to: Pick<RouteLocationResolved, 'meta' | 'fullPath' | 'name'>,
  ): Promise<true | RouteLocationRaw> => {
    if (to.meta.public) return true
    if (!isSignedIn()) {
      return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
    }
    if (to.name === 'welcome') return true
    return (await hasProfile()) ? true : { name: 'welcome' }
  }
