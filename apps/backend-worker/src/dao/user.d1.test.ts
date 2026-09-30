import { cardRecord } from 'backend/src/dao/fixtures.ts'
import type { UserRecord } from 'backend/src/dao/user.interface.ts'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vite-plus/test'

import { createCardDao } from './card.d1.ts'
import { createCompanyDao } from './company.d1.ts'
import { createDepartmentDao } from './department.d1.ts'
import { createTestEnv } from './test-env.ts'
import { createTopicDao } from './topic.d1.ts'
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

test('deleteAll removes every row the user owns and leaves other users alone', async () => {
  const { DB } = testEnv.env
  const dao = createUserDao(DB)
  await dao.save(user)
  for (const owner of ['user-1', 'user-2']) {
    await createCompanyDao(DB).insert({ id: `${owner}-c`, user_id: owner, name: 'Gamma' })
    await createDepartmentDao(DB).insert({
      id: `${owner}-d`,
      user_id: owner,
      company_id: `${owner}-c`,
      name: '営業部',
    })
    await createTopicDao(DB).insert({ id: `${owner}-t`, user_id: owner, kind: 'group', name: 'X' })
    await createCardDao(DB).insert(
      cardRecord({
        id: `${owner}-card`,
        user_id: owner,
        company_id: `${owner}-c`,
        department_ids: [`${owner}-d`],
        topic_ids: [`${owner}-t`],
      }),
    )
  }
  await dao.save({
    ...user,
    id: 'user-2',
    affiliations: [{ company_id: 'user-2-c', department_id: null }],
  })

  await dao.deleteAll('user-1')

  const count = async (sql: string, owner: string) =>
    (await DB.prepare(`SELECT COUNT(*) AS n FROM ${sql}`).bind(owner).first<{ n: number }>())?.n
  const tables = [
    'users WHERE id = ?',
    'user_affiliations WHERE user_id = ?',
    'companies WHERE user_id = ?',
    'departments WHERE user_id = ?',
    'topics WHERE user_id = ?',
    'cards WHERE user_id = ?',
    'card_departments WHERE card_id IN (SELECT id FROM cards WHERE user_id = ?)',
    'card_topics WHERE card_id IN (SELECT id FROM cards WHERE user_id = ?)',
  ]
  for (const table of tables) {
    expect(await count(table, 'user-1'), table).toBe(0)
    expect(await count(table, 'user-2'), table).toBeGreaterThan(0)
  }
  // Link rows of the deleted cards are gone too, not just unreachable.
  expect(await count('card_departments WHERE card_id = ?', 'user-1-card')).toBe(0)
  expect(await count('card_topics WHERE card_id = ?', 'user-1-card')).toBe(0)
})
