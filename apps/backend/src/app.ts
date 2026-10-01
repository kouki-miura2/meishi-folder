import { zValidator } from '@hono/zod-validator'
import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { deleteCookie, setCookie } from 'hono/cookie'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { LIMITS, charLength, createLogger } from 'utils'
import { z } from 'zod'

import type { AuthGuard, AuthenticatedUser } from './repository/auth-guard.interface.ts'
import { SESSION_COOKIE } from './repository/auth-guard.session.ts'
import type { CardImageService } from './service/card-image.service.ts'
import type { CardService } from './service/card.service.ts'
import type { CompanyService } from './service/company.service.ts'
import type { DepartmentService } from './service/department.service.ts'
import { ServiceError, type ServiceErrorCode } from './service/errors.ts'
import type { SessionService } from './service/session.service.ts'
import type { TopicService } from './service/topic.service.ts'
import type { UserService } from './service/user.service.ts'

export interface AuthConfig {
  guard: AuthGuard
  /** Off by default (free access). When on, applies to every route except `excludePaths`. */
  enabled: boolean
  excludePaths: string[]
}

export interface AppDependencies {
  sessionService: SessionService
  userService: UserService
  companyService: CompanyService
  departmentService: DepartmentService
  topicService: TopicService
  cardImageService: CardImageService
  cardService: CardService
  auth: AuthConfig
}

type Variables = { user: AuthenticatedUser | null; requestId: string }

// 4 random bytes as hex: short enough to scan by eye in logs, still ~4 billion values so
// collisions within one log stream are practically a non-issue.
const generateRequestId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

const statusOf = { not_found: 404, conflict: 409, invalid: 400 } as const satisfies Record<
  ServiceErrorCode,
  number
>

/**
 * The signed-in user's id. Every data route is per user, so it answers 401 without one — even
 * while the auth guard is switched off, rather than letting requests share an anonymous owner.
 */
const userIdOf = (c: Context<{ Variables: Variables }>): string => {
  const id = c.get('user')?.id
  if (!id) {
    throw new HTTPException(401, {
      res: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    })
  }
  return id
}

// Counted as a person sees characters (`charLength`), not UTF-16 code units, to match the UI. A
// single character has no size bound of its own (combining marks can pile up without end), so a
// hard cap on code units comes first — room for the longest emoji sequences — and also keeps huge
// input away from the segmenter.
const MAX_CODE_UNITS_PER_CHAR = 16
const text = z
  .string()
  .max(LIMITS.textMaxLength * MAX_CODE_UNITS_PER_CHAR)
  .refine((value) => charLength(value) <= LIMITS.textMaxLength, {
    message: `Must be at most ${LIMITS.textMaxLength} characters`,
  })
const optionalText = text.nullish()
// A Google ID token is about 1 KB; anything far larger is not one.
const ID_TOKEN_MAX_LENGTH = 8 * 1024
const texts = z.array(text).max(LIMITS.valuesPerField).optional()
const nameSchema = z.object({ name: text })
const mergeSchema = z.object({
  sourceIds: z.array(z.string()).min(1).max(LIMITS.mergeSourcesPerRequest),
})
const cardFields = {
  name: optionalText,
  nameKana: optionalText,
  nameRomaji: optionalText,
  companyName: optionalText,
  departmentNames: texts,
  titles: texts,
  jobTypes: texts,
  mobile: optionalText,
  emails: texts,
  otherContacts: texts,
  url: optionalText,
  offices: z
    .array(
      z.object({
        postalCode: optionalText,
        address: optionalText,
        tel: optionalText,
        fax: optionalText,
      }),
    )
    .max(LIMITS.officesPerCard)
    .optional(),
  metOn: z.iso.date().nullish(),
  metAt: optionalText,
  metOccasion: optionalText,
  handleName: optionalText,
  memo: optionalText,
  projectNames: texts,
  groupNames: texts,
  frontImageId: z.string().nullish(),
  backImageId: z.string().nullish(),
}

/** Runtime-agnostic app: no Cloudflare Workers or Node-specific APIs here. Entrypoints live in the runtime package (`apps/backend-*`). */
export const createApp = (deps: AppDependencies) => {
  const logger = createLogger({ format: 'json' })

  return (
    new Hono<{ Variables: Variables }>()
      // Audit trail: start/end pair per request, joined by requestId (needed since concurrent
      // requests to the same method+path would otherwise be indistinguishable in the log stream).
      // Wraps the auth guard so a rejected (401) request is still logged, not just successful ones.
      .use('*', async (c, next) => {
        const requestId = generateRequestId()
        c.set('requestId', requestId)
        const startedAt = Date.now()

        logger.info('request started', { requestId, method: c.req.method, path: c.req.path })

        try {
          await next()
        } finally {
          logger.info('request completed', {
            requestId,
            method: c.req.method,
            path: c.req.path,
            user: c.get('user')?.id ?? 'anonymous',
            status: c.res.status,
            durationMs: Date.now() - startedAt,
          })
        }
      })
      // Sign-in rides on a cookie, so refuse what a form on another site could send. SameSite=Strict
      // already keeps the cookie off such requests; this covers browsers that ignore it.
      .use('*', csrf())
      .use('*', async (c, next) => {
        if (deps.auth.enabled && !deps.auth.excludePaths.includes(c.req.path)) {
          const user = await deps.auth.guard.authenticate(c.req.raw)
          if (!user) return c.json({ error: 'Unauthorized' }, 401)
          c.set('user', user)
        } else {
          c.set('user', null)
        }
        await next()
      })
      // Photos have their own, smaller cap (checked in the service); anything past this is
      // rejected before it is read into memory.
      .use(
        '*',
        bodyLimit({
          maxSize: LIMITS.requestBodyBytes,
          onError: (c) => c.json({ error: 'Payload Too Large' }, 413),
        }),
      )
      .onError((error, c) => {
        if (error instanceof ServiceError) {
          return c.json({ error: error.message }, statusOf[error.code])
        }
        if (error instanceof HTTPException) return error.getResponse()
        logger.error('unhandled error', {
          requestId: c.get('requestId'),
          error: error instanceof Error ? error.stack : String(error),
        })
        return c.json({ error: 'Internal Server Error' }, 500)
      })
      // Each route only talks to its service; the runtime entrypoints wire the concrete
      // dao -> repository -> service chain.

      // Sign-in (login screen) and sign-out. Not behind the auth guard.
      .post(
        '/session',
        zValidator('json', z.object({ idToken: z.string().max(ID_TOKEN_MAX_LENGTH) })),
        async (c) => {
          const session = await deps.sessionService.signIn(c.req.valid('json').idToken)
          if (!session) return c.json({ error: 'Unauthorized' }, 401)
          setCookie(c, SESSION_COOKIE, session.token, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            path: '/',
            expires: new Date(session.expiresAt * 1000),
          })
          return c.json({ ...session.account, expiresAt: session.expiresAt })
        },
      )
      .delete('/session', (c) => {
        deleteCookie(c, SESSION_COOKIE, { secure: true, path: '/' })
        return c.body(null, 204)
      })

      // User profile (welcome screen)
      .get('/me', async (c) => c.json(await deps.userService.getMe(userIdOf(c))))
      .put(
        '/me',
        zValidator(
          'json',
          z.object({
            name: text,
            nameKana: optionalText,
            affiliations: z
              .array(z.object({ companyName: text, departmentName: optionalText }))
              .max(LIMITS.affiliationsPerUser),
            agreedTermsVersion: z.string().max(100).optional(),
          }),
        ),
        async (c) => c.json(await deps.userService.saveMe(userIdOf(c), c.req.valid('json'))),
      )
      // Withdrawal (settings screen)
      .delete('/me', async (c) => {
        await deps.userService.deleteMe(userIdOf(c))
        return c.body(null, 204)
      })

      // Companies (company settings screen)
      .get('/companies', async (c) => c.json(await deps.companyService.list(userIdOf(c))))
      .post('/companies', zValidator('json', nameSchema), async (c) =>
        c.json(await deps.companyService.create(userIdOf(c), c.req.valid('json').name), 201),
      )
      .patch('/companies/:id', zValidator('json', nameSchema), async (c) =>
        c.json(
          await deps.companyService.rename(
            userIdOf(c),
            c.req.param('id'),
            c.req.valid('json').name,
          ),
        ),
      )
      .delete('/companies/:id', async (c) => {
        await deps.companyService.remove(userIdOf(c), c.req.param('id'))
        return c.body(null, 204)
      })
      .post('/companies/:id/merge', zValidator('json', mergeSchema), async (c) =>
        c.json(
          await deps.companyService.merge(
            userIdOf(c),
            c.req.param('id'),
            c.req.valid('json').sourceIds,
          ),
        ),
      )

      // Departments (department settings screen)
      .get('/companies/:companyId/departments', async (c) =>
        c.json(await deps.departmentService.list(userIdOf(c), c.req.param('companyId'))),
      )
      .post('/companies/:companyId/departments', zValidator('json', nameSchema), async (c) =>
        c.json(
          await deps.departmentService.create(
            userIdOf(c),
            c.req.param('companyId'),
            c.req.valid('json').name,
          ),
          201,
        ),
      )
      .patch('/departments/:id', zValidator('json', nameSchema), async (c) =>
        c.json(
          await deps.departmentService.rename(
            userIdOf(c),
            c.req.param('id'),
            c.req.valid('json').name,
          ),
        ),
      )
      .delete('/departments/:id', async (c) => {
        await deps.departmentService.remove(userIdOf(c), c.req.param('id'))
        return c.body(null, 204)
      })
      .post('/departments/:id/merge', zValidator('json', mergeSchema), async (c) =>
        c.json(
          await deps.departmentService.merge(
            userIdOf(c),
            c.req.param('id'),
            c.req.valid('json').sourceIds,
          ),
        ),
      )

      // Related projects / groups
      .get(
        '/topics',
        zValidator('query', z.object({ kind: z.enum(['project', 'group']).optional() })),
        async (c) => c.json(await deps.topicService.list(userIdOf(c), c.req.valid('query').kind)),
      )

      // Card photos
      .post('/images', zValidator('form', z.object({ file: z.instanceof(File) })), async (c) => {
        const { file } = c.req.valid('form')
        return c.json(
          await deps.cardImageService.upload(userIdOf(c), await file.arrayBuffer()),
          201,
        )
      })
      .get('/images/:id', async (c) => {
        const image = await deps.cardImageService.get(userIdOf(c), c.req.param('id'))
        // An image id is never reused for different content, so the browser may keep it.
        return c.body(image.body, 200, {
          'Content-Type': image.contentType,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, max-age=31536000, immutable',
        })
      })

      // Cards
      .post(
        '/cards/extract',
        zValidator(
          'json',
          z.object({ frontImageId: z.string(), backImageId: z.string().nullish() }),
        ),
        async (c) => c.json(await deps.cardService.extract(userIdOf(c), c.req.valid('json'))),
      )
      .get('/cards/export', async (c) =>
        c.body(await deps.cardService.exportCsv(userIdOf(c)), 200, {
          'Content-Type': 'text/csv; charset=utf-8; header=present',
          'Cache-Control': 'no-store',
        }),
      )
      .get('/cards/candidates', zValidator('query', z.object({ name: text })), async (c) =>
        c.json(await deps.cardService.candidates(userIdOf(c), c.req.valid('query').name)),
      )
      .get(
        '/cards',
        zValidator(
          'query',
          // topicIds: comma-separated; match: whether a card needs all of them (default) or any.
          z.object({
            q: text.optional(),
            topicIds: z.string().optional(),
            match: z.enum(['any', 'all']).optional(),
          }),
        ),
        async (c) => {
          const { q, topicIds, match } = c.req.valid('query')
          return c.json(
            await deps.cardService.list(userIdOf(c), {
              q,
              topicIds: topicIds?.split(',').filter(Boolean),
              match,
            }),
          )
        },
      )
      .get('/cards/:id', async (c) =>
        c.json(await deps.cardService.get(userIdOf(c), c.req.param('id'))),
      )
      .post('/cards', zValidator('json', z.object(cardFields)), async (c) =>
        c.json(await deps.cardService.create(userIdOf(c), c.req.valid('json')), 201),
      )
      .patch(
        '/cards/:id',
        zValidator(
          'json',
          z.object({
            ...cardFields,
            visibility: z.enum(['private', 'company', 'department']).optional(),
          }),
        ),
        async (c) =>
          c.json(
            await deps.cardService.update(userIdOf(c), c.req.param('id'), c.req.valid('json')),
          ),
      )
      .delete('/cards/:id', async (c) => {
        await deps.cardService.remove(userIdOf(c), c.req.param('id'))
        return c.body(null, 204)
      })
  )
}

/** Hono RPC contract consumed by `apps/frontend` via `hc<AppType>()`. */
export type AppType = ReturnType<typeof createApp>
