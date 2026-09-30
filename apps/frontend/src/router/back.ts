import type { RouteLocationRaw, Router } from 'vue-router'

/**
 * Goes back when the previous history entry is the `to` screen (same route and params; the query,
 * such as the list's filter, may differ), so it isn't stacked twice and keeps its scroll and filter.
 * Otherwise — opened directly, reloaded, or reached from elsewhere — replaces the current screen
 * with `to`, since going back would leave the app or land somewhere unexpected.
 */
export const backTo = (router: Router, to: RouteLocationRaw) => {
  const back: unknown = router.options.history.state.back
  const target = router.resolve(to)
  const previous = typeof back === 'string' ? router.resolve(back) : null
  if (
    previous &&
    previous.name === target.name &&
    JSON.stringify(previous.params) === JSON.stringify(target.params)
  ) {
    router.back()
    return Promise.resolve()
  }
  return router.replace(to)
}
