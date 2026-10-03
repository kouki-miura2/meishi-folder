import { DATA_VERSION_HEADER, LIMITS } from 'utils'
import { expect, test, vi } from 'vite-plus/test'

import { createApp, type AppDependencies } from './app.ts'
import type { AuthGuard } from './repository/auth-guard.interface.ts'
import type { CardImageService } from './service/card-image.service.ts'
import type { CardService, CardView } from './service/card.service.ts'
import type { CompanyService } from './service/company.service.ts'
import type { DataVersionService } from './service/data-version.service.ts'
import type { DepartmentService } from './service/department.service.ts'
import { ServiceError } from './service/errors.ts'
import type { SessionService } from './service/session.service.ts'
import type { TopicService } from './service/topic.service.ts'
import type { UserService } from './service/user.service.ts'

const allowAllGuard: AuthGuard = { authenticate: async () => ({ id: 'test-user' }) }
const denyAllGuard: AuthGuard = { authenticate: async () => null }

const notImplemented = () => {
  throw new Error('not expected in this test')
}
const sessionService: SessionService = { signIn: notImplemented }
const userService: UserService = {
  getMe: notImplemented,
  saveMe: notImplemented,
  deleteMe: notImplemented,
}
const companyService: CompanyService = {
  list: notImplemented,
  create: notImplemented,
  rename: notImplemented,
  remove: notImplemented,
  merge: notImplemented,
}
const departmentService: DepartmentService = {
  list: notImplemented,
  create: notImplemented,
  rename: notImplemented,
  remove: notImplemented,
  merge: notImplemented,
}
const topicService: TopicService = { list: notImplemented }
const cardImageService: CardImageService = { upload: notImplemented, get: notImplemented }
const cardService: CardService = {
  extract: notImplemented,
  candidates: notImplemented,
  list: notImplemented,
  create: notImplemented,
  update: notImplemented,
  remove: notImplemented,
  exportCsv: notImplemented,
}

// Unlike the others, every write reaches this one, so it works rather than throws.
const dataVersionService: DataVersionService = {
  get: async () => null,
  bump: async () => 'v-new',
}

/** An app whose services all throw unless a test overrides the ones it exercises. */
const appWith = (overrides: Partial<AppDependencies> = {}) =>
  createApp({
    sessionService,
    userService,
    companyService,
    departmentService,
    topicService,
    cardImageService,
    cardService,
    dataVersionService,
    auth: { guard: allowAllGuard, enabled: true, excludePaths: [] },
    ...overrides,
  })

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

/** What a browser sends with a request from the app's own page (see the CSRF check). */
const sameOrigin = { 'sec-fetch-site': 'same-origin' }

const topics = [{ id: 't-1', kind: 'project' as const, name: 'Apollo' }]
const topicServiceReturningTopics: TopicService = { list: async () => topics }

test('rejects unauthenticated requests once the auth guard is enabled', async () => {
  const app = appWith({ auth: { guard: denyAllGuard, enabled: true, excludePaths: [] } })

  const res = await app.request('/topics')

  expect(res.status).toBe(401)
})

test('allows authenticated requests once the auth guard is enabled', async () => {
  const app = appWith({ topicService: topicServiceReturningTopics })

  const res = await app.request('/topics', { headers: { authorization: 'token' } })

  expect(await res.json()).toEqual(topics)
})

test('skips the auth guard for excluded paths', async () => {
  const authenticate = vi.fn(async () => null)
  const app = appWith({
    auth: { guard: { authenticate }, enabled: true, excludePaths: ['/topics'] },
  })

  await app.request('/topics')

  expect(authenticate).not.toHaveBeenCalled()
})

test('data routes answer 401 without a signed-in user, even with the auth guard disabled', async () => {
  const app = appWith({
    auth: { guard: denyAllGuard, enabled: false, excludePaths: [] },
    companyService: { ...companyService, list: async () => [] },
  })

  const res = await app.request('/companies')

  expect(res.status).toBe(401)
  expect(await res.json()).toEqual({ error: 'Unauthorized' })
})

test('logs a matching started/completed pair, including for a rejected request', async () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  const app = appWith({ auth: { guard: denyAllGuard, enabled: true, excludePaths: [] } })

  const res = await app.request('/topics')
  expect(res.status).toBe(401)

  expect(info).toHaveBeenCalledTimes(2)
  const [startedLine] = info.mock.calls[0] as [string]
  const [completedLine] = info.mock.calls[1] as [string]
  const started = JSON.parse(startedLine)
  const completed = JSON.parse(completedLine)

  expect(started).toMatchObject({
    message: 'request started',
    method: 'GET',
    path: '/topics',
  })
  expect(completed).toMatchObject({
    message: 'request completed',
    method: 'GET',
    path: '/topics',
    user: 'anonymous',
    status: 401,
  })
  expect(completed.requestId).toBe(started.requestId)
  expect(typeof completed.durationMs).toBe('number')

  info.mockRestore()
})

test.each([
  ['not_found', 404],
  ['conflict', 409],
  ['invalid', 400],
] as const)('maps a %s service error to %i', async (code, status) => {
  const app = appWith({
    companyService: {
      ...companyService,
      list: async () => {
        throw new ServiceError(code, 'message')
      },
    },
  })

  const res = await app.request('/companies')

  expect(res.status).toBe(status)
  expect(await res.json()).toEqual({ error: 'message' })
})

test('answers 500 without leaking an unexpected error', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const app = appWith({
    companyService: {
      ...companyService,
      list: async () => {
        throw new Error('database exploded')
      },
    },
  })

  const res = await app.request('/companies')

  expect(res.status).toBe(500)
  expect(await res.json()).toEqual({ error: 'Internal Server Error' })
  expect(error).toHaveBeenCalledOnce()
  error.mockRestore()
})

test('POST /session sets the session cookie and returns the account', async () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 3600
  const signIn = vi.fn(async () => ({
    token: 'session-token',
    account: { email: 'a@example.com', name: '山田', picture: null },
    expiresAt,
  }))
  const app = appWith({
    sessionService: { signIn },
    auth: { guard: denyAllGuard, enabled: true, excludePaths: ['/session'] },
  })

  const res = await app.request('/session', json('POST', { idToken: 'google-token' }))

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({
    email: 'a@example.com',
    name: '山田',
    picture: null,
    expiresAt,
  })
  expect(signIn).toHaveBeenCalledWith('google-token')
  const cookie = res.headers.get('set-cookie') ?? ''
  expect(cookie).toMatch(/^__Host-session=session-token;/)
  expect(cookie).toContain('HttpOnly')
  expect(cookie).toContain('Secure')
  expect(cookie).toContain('SameSite=Strict')
  expect(cookie).toContain('Path=/')
  expect(cookie).toContain(`Expires=${new Date(expiresAt * 1000).toUTCString()}`)
})

test('POST /session answers 401 without a cookie for an invalid Google ID token', async () => {
  const app = appWith({ sessionService: { signIn: async () => null } })

  const res = await app.request('/session', json('POST', { idToken: 'forged' }))

  expect(res.status).toBe(401)
  expect(res.headers.has('set-cookie')).toBe(false)
})

test('DELETE /session clears the session cookie', async () => {
  const app = appWith({ auth: { guard: denyAllGuard, enabled: true, excludePaths: ['/session'] } })

  const res = await app.request('/session', { method: 'DELETE', headers: sameOrigin })

  expect(res.status).toBe(204)
  expect(res.headers.get('set-cookie')).toMatch(/^__Host-session=; Max-Age=0;/)
})

test('rejects a form-style request from another site (CSRF)', async () => {
  const deleteMe = vi.fn(async () => {})
  const app = appWith({ userService: { ...userService, deleteMe } })

  const crossSite = await app.request('/me', {
    method: 'DELETE',
    headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example.com' },
  })

  expect(crossSite.status).toBe(403)
  expect(deleteMe).not.toHaveBeenCalled()
})

test('GET /me and PUT /me pass the signed-in user to the service', async () => {
  const view = { name: '山田', nameKana: null, affiliations: [] }
  const saveMe = vi.fn(async () => view)
  const app = appWith({ userService: { ...userService, getMe: async () => view, saveMe } })

  const got = await app.request('/me')
  const put = await app.request('/me', json('PUT', { name: '山田', affiliations: [] }))

  expect(await got.json()).toEqual(view)
  expect(await put.json()).toEqual(view)
  expect(saveMe).toHaveBeenCalledWith('test-user', { name: '山田', affiliations: [] })
})

test('DELETE /me withdraws the signed-in user with 204', async () => {
  const deleteMe = vi.fn(async () => {})
  const app = appWith({ userService: { ...userService, deleteMe } })

  const res = await app.request('/me', { method: 'DELETE', headers: sameOrigin })

  expect(res.status).toBe(204)
  expect(deleteMe).toHaveBeenCalledWith('test-user')
})

test('GET /cards/export returns the CSV as text/csv, not a card lookup', async () => {
  const exportCsv = vi.fn(async () => '"ID"\r\n')
  const app = appWith({ cardService: { ...cardService, exportCsv } })

  const res = await app.request('/cards/export')

  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toMatch(/^text\/csv; charset=utf-8/)
  expect(res.headers.get('cache-control')).toBe('no-store')
  expect(await res.text()).toBe('"ID"\r\n')
  expect(exportCsv).toHaveBeenCalledWith('test-user')
})

test('PUT /me rejects a malformed body with 400 before reaching the service', async () => {
  const app = appWith()

  const res = await app.request('/me', json('PUT', { affiliations: 'nope' }))

  expect(res.status).toBe(400)
})

test('company routes map to the service with the right statuses', async () => {
  const company = { id: 'c-1', name: 'Acme' }
  const service: CompanyService = {
    list: async () => [{ ...company, cardCount: 2, departmentCount: 1 }],
    create: vi.fn(async () => company),
    rename: vi.fn(async () => company),
    remove: vi.fn(async () => {}),
    merge: vi.fn(async () => company),
  }
  const app = appWith({ companyService: service })

  expect(await (await app.request('/companies')).json()).toEqual([
    { ...company, cardCount: 2, departmentCount: 1 },
  ])
  expect((await app.request('/companies', json('POST', { name: 'Acme' }))).status).toBe(201)
  expect((await app.request('/companies/c-1', json('PATCH', { name: 'Acme' }))).status).toBe(200)
  expect(
    (await app.request('/companies/c-1', { method: 'DELETE', headers: sameOrigin })).status,
  ).toBe(204)
  expect(
    (await app.request('/companies/c-1/merge', json('POST', { sourceIds: ['c-2'] }))).status,
  ).toBe(200)

  expect(service.create).toHaveBeenCalledWith('test-user', 'Acme')
  expect(service.rename).toHaveBeenCalledWith('test-user', 'c-1', 'Acme')
  expect(service.remove).toHaveBeenCalledWith('test-user', 'c-1')
  expect(service.merge).toHaveBeenCalledWith('test-user', 'c-1', ['c-2'])
})

test('department routes map to the service with the right statuses', async () => {
  const department = { id: 'd-1', companyId: 'c-1', name: '営業部' }
  const service: DepartmentService = {
    list: vi.fn(async () => [{ ...department, cardCount: 0 }]),
    create: vi.fn(async () => department),
    rename: vi.fn(async () => department),
    remove: vi.fn(async () => {}),
    merge: vi.fn(async () => department),
  }
  const app = appWith({ departmentService: service })

  expect(await (await app.request('/companies/c-1/departments')).json()).toEqual([
    { ...department, cardCount: 0 },
  ])
  expect(
    (await app.request('/companies/c-1/departments', json('POST', { name: '営業部' }))).status,
  ).toBe(201)
  expect((await app.request('/departments/d-1', json('PATCH', { name: '営業' }))).status).toBe(200)
  expect(
    (await app.request('/departments/d-1', { method: 'DELETE', headers: sameOrigin })).status,
  ).toBe(204)
  expect(
    (await app.request('/departments/d-1/merge', json('POST', { sourceIds: ['d-2'] }))).status,
  ).toBe(200)

  expect(service.list).toHaveBeenCalledWith('test-user', 'c-1')
  expect(service.create).toHaveBeenCalledWith('test-user', 'c-1', '営業部')
  expect(service.merge).toHaveBeenCalledWith('test-user', 'd-1', ['d-2'])
})

test('POST /companies/:id/merge rejects an empty source list', async () => {
  const app = appWith()

  const res = await app.request('/companies/c-1/merge', json('POST', { sourceIds: [] }))

  expect(res.status).toBe(400)
})

test('GET /topics passes the optional kind filter', async () => {
  const list = vi.fn(async () => [])
  const app = appWith({ topicService: { list } })

  await app.request('/topics?kind=group')
  const invalid = await app.request('/topics?kind=other')

  expect(list).toHaveBeenCalledWith('test-user', 'group')
  expect(invalid.status).toBe(400)
})

test('POST /images uploads the file and GET /images/:id serves it back', async () => {
  const bytes = new Uint8Array([1, 2, 3])
  const upload = vi.fn(async () => ({ id: 'img-1' }))
  const app = appWith({
    cardImageService: {
      upload,
      get: async () => ({ body: bytes.buffer, contentType: 'image/png' }),
    },
  })
  const form = new FormData()
  form.append('file', new File([bytes], 'card.png', { type: 'image/png' }))

  const uploaded = await app.request('/images', { method: 'POST', headers: sameOrigin, body: form })
  const served = await app.request('/images/img-1')

  expect(uploaded.status).toBe(201)
  expect(await uploaded.json()).toEqual({ id: 'img-1' })
  expect(upload).toHaveBeenCalledWith('test-user', expect.any(ArrayBuffer))
  expect(served.headers.get('content-type')).toBe('image/png')
  expect(served.headers.get('x-content-type-options')).toBe('nosniff')
  expect(new Uint8Array(await served.arrayBuffer())).toEqual(bytes)
})

test('POST /images rejects a request without a file', async () => {
  const app = appWith()

  const res = await app.request('/images', {
    method: 'POST',
    headers: sameOrigin,
    body: new FormData(),
  })

  expect(res.status).toBe(400)
})

test('text values are capped by visible characters, not UTF-16 code units', async () => {
  const create = vi.fn(async (_userId: string, name: string) => ({ id: 'c-1', name }))
  const app = appWith({ companyService: { ...companyService, create } })
  const post = (name: string) =>
    app.request('/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })

  // Each family emoji is 8 UTF-16 code units but one character.
  expect((await post('👨‍👩‍👧'.repeat(LIMITS.textMaxLength))).status).toBe(201)
  expect((await post('あ'.repeat(LIMITS.textMaxLength + 1))).status).toBe(400)
  // One character by grapheme count, but megabytes of combining marks.
  expect((await post(`a${'́'.repeat(1_000_000)}`)).status).toBe(400)
})

test('requests with a body over the limit are rejected with 413 before reaching the service', async () => {
  const upload = vi.fn(async () => ({ id: 'img-1' }))
  const app = appWith({ cardImageService: { upload, get: vi.fn() } })
  const form = new FormData()
  form.append('file', new File([new Uint8Array(LIMITS.requestBodyBytes + 1)], 'card.png'))

  const res = await app.request('/images', { method: 'POST', headers: sameOrigin, body: form })

  expect(res.status).toBe(413)
  expect(await res.json()).toEqual({ error: 'Payload Too Large' })
  expect(upload).not.toHaveBeenCalled()
})

test('responses carry no CORS headers (frontend and API share one origin)', async () => {
  const app = appWith()

  const res = await app.request('/topics', { headers: { Origin: 'https://evil.example' } })

  expect(res.headers.get('access-control-allow-origin')).toBeNull()
})

test('card routes map to the service with the right statuses', async () => {
  const view = { id: 'card-1', name: '山田' } as CardView
  const service: CardService = {
    extract: vi.fn(async () => ({}) as never),
    candidates: vi.fn(async () => []),
    list: vi.fn(async () => []),
    create: vi.fn(async () => view),
    update: vi.fn(async () => view),
    remove: vi.fn(async () => {}),
    exportCsv: vi.fn(async () => ''),
  }
  const app = appWith({ cardService: service })

  expect(
    (await app.request('/cards/extract', json('POST', { frontImageId: 'img-1' }))).status,
  ).toBe(200)
  expect((await app.request('/cards/candidates?name=山田')).status).toBe(200)
  expect((await app.request('/cards')).status).toBe(200)
  expect((await app.request('/cards', json('POST', { name: '山田' }))).status).toBe(201)
  expect(
    (await app.request('/cards/card-1', json('PATCH', { visibility: 'company' }))).status,
  ).toBe(200)
  expect(
    (await app.request('/cards/card-1', { method: 'DELETE', headers: sameOrigin })).status,
  ).toBe(204)

  expect(service.extract).toHaveBeenCalledWith('test-user', { frontImageId: 'img-1' })
  expect(service.candidates).toHaveBeenCalledWith('test-user', '山田')
  expect(service.list).toHaveBeenCalledWith('test-user')
  expect(service.create).toHaveBeenCalledWith('test-user', { name: '山田' })
  expect(service.update).toHaveBeenCalledWith('test-user', 'card-1', { visibility: 'company' })
  expect(service.remove).toHaveBeenCalledWith('test-user', 'card-1')
})

test('card routes reject malformed input with 400', async () => {
  const app = appWith()

  const badDate = await app.request('/cards', json('POST', { name: '山田', metOn: '2026/01/01' }))
  const badVisibility = await app.request(
    '/cards/card-1',
    json('PATCH', { visibility: 'everyone' }),
  )

  expect(badDate.status).toBe(400)
  expect(badVisibility.status).toBe(400)
})

test("GET /data-version returns the signed-in user's data version", async () => {
  const get = vi.fn(async () => 'v-1')
  const app = appWith({ dataVersionService: { ...dataVersionService, get } })

  const res = await app.request('/data-version')

  expect(await res.json()).toEqual({ version: 'v-1' })
  expect(get).toHaveBeenCalledWith('test-user')
})

test('a successful write bumps the data version and returns it in a header', async () => {
  const bump = vi.fn(async () => 'v-2')
  const app = appWith({
    dataVersionService: { ...dataVersionService, bump },
    cardService: { ...cardService, remove: async () => {} },
  })

  const res = await app.request('/cards/card-1', { method: 'DELETE', headers: sameOrigin })

  expect(res.status).toBe(204)
  expect(res.headers.get(DATA_VERSION_HEADER)).toBe('v-2')
  expect(bump).toHaveBeenCalledWith('test-user')
})

test('reads, failed writes and writes that change no data keep the data version', async () => {
  const bump = vi.fn(async () => 'v-2')
  const app = appWith({
    dataVersionService: { ...dataVersionService, bump },
    topicService: topicServiceReturningTopics,
    userService: { ...userService, deleteMe: async () => {} },
    cardService: {
      ...cardService,
      remove: async () => {
        throw new ServiceError('not_found', 'Card card-1 not found')
      },
      extract: async () => ({}) as Awaited<ReturnType<CardService['extract']>>,
    },
  })

  const responses = [
    await app.request('/topics'),
    await app.request('/cards/card-1', { method: 'DELETE', headers: sameOrigin }),
    await app.request('/cards/extract', json('POST', { frontImageId: 'img-1' })),
    await app.request('/me', { method: 'DELETE', headers: sameOrigin }),
  ]

  expect(responses.map((res) => res.status)).toEqual([200, 404, 200, 204])
  expect(responses.map((res) => res.headers.get(DATA_VERSION_HEADER))).toEqual([
    null,
    null,
    null,
    null,
  ])
  expect(bump).not.toHaveBeenCalled()
})

test('a failed version bump still answers the write with its own result', async () => {
  const app = appWith({
    dataVersionService: {
      ...dataVersionService,
      bump: async () => {
        throw new Error('D1 unavailable')
      },
    },
    cardService: { ...cardService, remove: async () => {} },
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})

  const res = await app.request('/cards/card-1', { method: 'DELETE', headers: sameOrigin })

  expect(res.status).toBe(204)
  expect(res.headers.get(DATA_VERSION_HEADER)).toBeNull()
})
