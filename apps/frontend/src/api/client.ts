import type { AppType } from 'backend/src/app.ts'
import { hc } from 'hono/client'

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'
const REQUEST_TIMEOUT_MS = 3_000
/** AI extraction and photo upload take several seconds, far past the default timeout. */
const LONG_REQUEST_TIMEOUT_MS = 60_000

interface ApiClientConfig {
  /** The Google ID token to send, or null when signed out. */
  getToken: () => string | null
  /** Called when the backend rejects the token (expired or revoked). */
  onUnauthorized: () => void
}

let config: ApiClientConfig = { getToken: () => null, onUnauthorized: () => {} }

/** Wires the client to the auth state; called once from `main.ts`. */
export const configureApiClient = (next: ApiClientConfig) => {
  config = next
}

/** Hono RPC client. Request/response types are inferred from `AppType`, never hand-written. */
export const apiClient = hc<AppType>(baseUrl, {
  headers: (): Record<string, string> => {
    const token = config.getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  },
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await fetch(input, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (res.status === 401) config.onUnauthorized()
    return res
  },
})

/** Per-request options for the slow endpoints (`POST /images`, `POST /cards/extract`). */
export const longRequest = () => ({
  init: { signal: AbortSignal.timeout(LONG_REQUEST_TIMEOUT_MS) },
})

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface JsonResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

/** The body type of the success response(s) in a typed Hono RPC response union (the validators' 400 dropped). */
type SuccessBody<R extends JsonResponse> = Awaited<ReturnType<Exclude<R, { status: 400 }>['json']>>

/** Resolves the JSON body of a successful response, or throws an `ApiError` carrying the status. */
export const unwrap = async <R extends JsonResponse>(res: R): Promise<SuccessBody<R>> => {
  if (!res.ok) throw new ApiError(res.status, `Request failed: ${res.status}`)
  return (await res.json()) as SuccessBody<R>
}
