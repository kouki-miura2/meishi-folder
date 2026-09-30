import { createApp } from 'backend/src/app.ts'
import { createGoogleAuthGuard } from 'backend/src/repository/auth-guard.google.ts'
import { createCardExtractorRepository } from 'backend/src/repository/card-extractor.repository.ts'
import { createCardImageRepository } from 'backend/src/repository/card-image.repository.ts'
import { createCardRepository } from 'backend/src/repository/card.repository.ts'
import { createCompanyRepository } from 'backend/src/repository/company.repository.ts'
import { createDepartmentRepository } from 'backend/src/repository/department.repository.ts'
import { createTopicRepository } from 'backend/src/repository/topic.repository.ts'
import { createUserRepository } from 'backend/src/repository/user.repository.ts'
import { createCardImageService } from 'backend/src/service/card-image.service.ts'
import { createCardService } from 'backend/src/service/card.service.ts'
import { createCompanyService } from 'backend/src/service/company.service.ts'
import { createDepartmentService } from 'backend/src/service/department.service.ts'
import { createImageCleanupService } from 'backend/src/service/image-cleanup.service.ts'
import { createMasterResolver } from 'backend/src/service/master-resolver.ts'
import { createTopicService } from 'backend/src/service/topic.service.ts'
import { createUserService } from 'backend/src/service/user.service.ts'
import { createLogger } from 'utils'

import { stripApiPrefix } from './api-path.ts'
import { createCardExtractorDao } from './dao/card-extractor.workers-ai.ts'
import { createCardImageDao } from './dao/card-image.r2.ts'
import { createCardDao } from './dao/card.d1.ts'
import { createCompanyDao } from './dao/company.d1.ts'
import { createDepartmentDao } from './dao/department.d1.ts'
import { createTopicDao } from './dao/topic.d1.ts'
import { createUserDao } from './dao/user.d1.ts'

/** `GOOGLE_CLIENT_ID` is a secret (`.dev.vars` / `wrangler secret put`), so `wrangler types` doesn't list it. */
type WorkerEnv = Env & { GOOGLE_CLIENT_ID?: string }

const createWorkerApp = (env: WorkerEnv) => {
  if (!env.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is not set')

  const { cardRepository, cardImageRepository } = createCardRepositories(env)
  const userRepository = createUserRepository(createUserDao(env.DB))
  const companyRepository = createCompanyRepository(createCompanyDao(env.DB))
  const departmentRepository = createDepartmentRepository(createDepartmentDao(env.DB))
  const topicRepository = createTopicRepository(createTopicDao(env.DB))
  const cardExtractorRepository = createCardExtractorRepository(createCardExtractorDao(env.AI))
  const masterResolver = createMasterResolver({
    companyRepository,
    departmentRepository,
    topicRepository,
  })

  return createApp({
    userService: createUserService({
      userRepository,
      companyRepository,
      departmentRepository,
      masterResolver,
    }),
    companyService: createCompanyService(companyRepository),
    departmentService: createDepartmentService({ departmentRepository, companyRepository }),
    topicService: createTopicService(topicRepository),
    cardImageService: createCardImageService(cardImageRepository),
    cardService: createCardService({
      cardRepository,
      cardImageRepository,
      cardExtractorRepository,
      companyRepository,
      departmentRepository,
      topicRepository,
      masterResolver,
    }),
    auth: {
      guard: createGoogleAuthGuard({ clientId: env.GOOGLE_CLIENT_ID }),
      enabled: true,
      excludePaths: [],
    },
  })
}

const createCardRepositories = (env: WorkerEnv) => ({
  cardRepository: createCardRepository(createCardDao(env.DB)),
  cardImageRepository: createCardImageRepository(createCardImageDao(env.IMAGES)),
})

// Bindings only exist per request, but they stay the same for the life of the isolate.
let app: ReturnType<typeof createWorkerApp> | undefined

// Only `/api/*` reaches this handler (`assets.run_worker_first` in wrangler.jsonc); every other
// path is the frontend, served from static assets on the same origin.
// The cron trigger (wrangler.jsonc) sweeps out photos uploaded but never saved to a card.
export default {
  fetch: (request, env, ctx) =>
    (app ??= createWorkerApp(env)).fetch(stripApiPrefix(request), env, ctx),
  scheduled: async (_controller, env) => {
    const deleted = await createImageCleanupService(createCardRepositories(env)).deleteOrphans()
    createLogger({ format: 'json' }).info('orphan images deleted', { count: deleted })
  },
} satisfies ExportedHandler<WorkerEnv>
