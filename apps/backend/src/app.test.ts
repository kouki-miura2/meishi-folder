import { LIMITS } from 'utils'
import { expect, test, vi } from 'vite-plus/test'

import { createApp, type AppDependencies } from './app.ts'
import type { AuthGuard } from './repository/auth-guard.interface.ts'
import type { CardImageService } from './service/card-image.service.ts'
import type { CardService, CardView } from './service/card.service.ts'
import type { CompanyService } from './service/company.service.ts'
import type { DepartmentService } from './service/department.service.ts'
import { ServiceError } from './service/errors.ts'
import type { TopicService } from './service/topic.service.ts'
import type { UserService } from './service/user.service.ts'

const allowAllGuard: AuthGuard = { authenticate: async () => ({ id: 'test-user' }) }
const denyAllGuard: AuthGuard = { authenticate: async () => null }

const notImplemented = () => {
  throw new Error('not expected in this test')
}
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
  get: notImplemented,
  create: notImplemented,
  update: notImplemented,
  remove: notImplemented,
  exportCsv: notImplemented,
}

/** An app whose services all throw unless a test overrides the ones it exercises. */
const appWith = (overrides: Partial<AppDependencies> = {}) =>
  createApp({
    userService,
    companyService,
    departmentService,
    topicService,
    cardImageService,
    cardService,
    auth: { guard: allowAllGuard, enabled: true, excludePaths: [] },
    ...overrides,
  })

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

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

  const res = await app.request('/me', { method: 'DELETE' })

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
  expect((await app.request('/companies/c-1', { method: 'DELETE' })).status).toBe(204)
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
  expect((await app.request('/departments/d-1', { method: 'DELETE' })).status).toBe(204)
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

  const uploaded = await app.request('/images', { method: 'POST', body: form })
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

  const res = await app.request('/images', { method: 'POST', body: new FormData() })

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
})

test('requests with a body over the limit are rejected with 413 before reaching the service', async () => {
  const upload = vi.fn(async () => ({ id: 'img-1' }))
  const app = appWith({ cardImageService: { upload, get: vi.fn() } })
  const form = new FormData()
  form.append('file', new File([new Uint8Array(LIMITS.requestBodyBytes + 1)], 'card.png'))

  const res = await app.request('/images', { method: 'POST', body: form })

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
    get: vi.fn(async () => view),
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
  expect((await app.request('/cards?q=acme&topicIds=t-1,t-2')).status).toBe(200)
  expect((await app.request('/cards/card-1')).status).toBe(200)
  expect((await app.request('/cards', json('POST', { name: '山田' }))).status).toBe(201)
  expect(
    (await app.request('/cards/card-1', json('PATCH', { visibility: 'company' }))).status,
  ).toBe(200)
  expect((await app.request('/cards/card-1', { method: 'DELETE' })).status).toBe(204)

  expect(service.extract).toHaveBeenCalledWith('test-user', { frontImageId: 'img-1' })
  expect(service.candidates).toHaveBeenCalledWith('test-user', '山田')
  expect(service.list).toHaveBeenCalledWith('test-user', { q: 'acme', topicIds: ['t-1', 't-2'] })
  expect(service.get).toHaveBeenCalledWith('test-user', 'card-1')
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
