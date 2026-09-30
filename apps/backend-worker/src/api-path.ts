/** Where the API lives on the shared origin; everything else is the frontend's static assets. */
export const API_PREFIX = '/api'

/**
 * The same request with `/api` taken off the path, so the backend app (whose routes are `/me`,
 * `/cards`, ...) serves `/api/me`, `/api/cards`, ... next to the frontend.
 */
export const stripApiPrefix = (request: Request): Request => {
  const url = new URL(request.url)
  if (url.pathname === API_PREFIX || url.pathname.startsWith(`${API_PREFIX}/`)) {
    url.pathname = url.pathname.slice(API_PREFIX.length) || '/'
  }
  return new Request(url, request)
}
