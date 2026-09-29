import type { UserRecord } from 'backend/src/dao/user.interface.ts'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vite-plus/test'

import { createCompanyDao } from './company.d1.ts'
import { createTestEnv } from './test-env.ts'
import { createUserDao } from './user.d1.ts'

let testEnv: Awaited<ReturnType<typeof createTestEnv>>
beforeAll(async () => {
  testEnv = await createTestEnv()
})
afterAll(() => testEnv.dispose())
beforeEach(async () => {
  await testEnv.reset()
  const companies = createCompanyDao(testEnv.env.DB)
  await companies.insert({ id: 'c-1', user_id: 'user-1', name: 'Acme' })
  await companies.insert({ id: 'c-2', user_id: 'user-1', name: 'Beta' })
})

const user: UserRecord = {
  id: 'user-1',
  name: '山田 太郎',
  name_kana: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  affiliations: [
    { company_id: 'c-2', department_id: null },
    { company_id: 'c-1', department_id: null },
  ],
}

test('save inserts a user that findById resolves, affiliations in saved order', async () => {
  const dao = createUserDao(testEnv.env.DB)

  await dao.save(user)

  await expect(dao.findById('user-1')).resolves.toEqual(user)
})

test('save replaces the profile and affiliations but keeps created_at', async () => {
  const dao = createUserDao(testEnv.env.DB)
  await dao.save(user)

  await dao.save({
    ...user,
    name: '山田 花子',
    created_at: '2030-01-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    affiliations: [],
  })

  await expect(dao.findById('user-1')).resolves.toEqual({
    ...user,
    name: '山田 花子',
    updated_at: '2026-02-01T00:00:00.000Z',
    affiliations: [],
  })
})

test('findById resolves null for an unknown user', async () => {
  await expect(createUserDao(testEnv.env.DB).findById('missing')).resolves.toBeNull()
})
