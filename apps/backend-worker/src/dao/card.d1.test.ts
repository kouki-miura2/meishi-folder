import { cardRecord } from 'backend/src/dao/fixtures.ts'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vite-plus/test'

import { createCardDao } from './card.d1.ts'
import { createCompanyDao } from './company.d1.ts'
import { createDepartmentDao } from './department.d1.ts'
import { createTestEnv } from './test-env.ts'
import { createTopicDao } from './topic.d1.ts'

let testEnv: Awaited<ReturnType<typeof createTestEnv>>
beforeAll(async () => {
  testEnv = await createTestEnv()
})
afterAll(() => testEnv.dispose())
beforeEach(async () => {
  await testEnv.reset()
  const { DB } = testEnv.env
  await createCompanyDao(DB).insert({ id: 'c-1', user_id: 'user-1', name: 'Acme' })
  await createDepartmentDao(DB).insert({
    id: 'd-1',
    user_id: 'user-1',
    company_id: 'c-1',
    name: 'Research_Lab',
  })
  const topics = createTopicDao(DB)
  await topics.insert({ id: 't-1', user_id: 'user-1', kind: 'project', name: 'Apollo' })
  await topics.insert({ id: 't-2', user_id: 'user-1', kind: 'group', name: 'Book club' })
  const dao = createCardDao(DB)
  await dao.insert(cardRecord({ id: 'kana', name: '山田 太郎', name_kana: 'ヤマダ タロウ' }))
  await dao.insert(
    cardRecord({
      id: 'handle',
      handle_name: 'アルファ',
      company_id: 'c-1',
      department_ids: ['d-1'],
      topic_ids: ['t-1', 't-2'],
    }),
  )
  await dao.insert(
    cardRecord({
      id: 'name-only',
      name: '佐藤',
      topic_ids: ['t-1'],
      emails: '["sato@example.com"]',
    }),
  )
  await dao.insert(cardRecord({ id: 'other-user', user_id: 'user-2', name: '山田 太郎' }))
})

test('insert and findById round-trip the record, join-table ids included', async () => {
  const dao = createCardDao(testEnv.env.DB)

  await expect(dao.findById('user-1', 'handle')).resolves.toEqual(
    cardRecord({
      id: 'handle',
      handle_name: 'アルファ',
      company_id: 'c-1',
      department_ids: ['d-1'],
      topic_ids: ['t-1', 't-2'],
    }),
  )
  await expect(dao.findById('user-1', 'other-user')).resolves.toBeNull()
})

test('list orders by kana, falling back to handle name, then name', async () => {
  const cards = await createCardDao(testEnv.env.DB).list('user-1', {})

  expect(cards.map((c) => c.id)).toEqual(['handle', 'kana', 'name-only'])
})

test('list filters by text across columns and master names, case-insensitively', async () => {
  const dao = createCardDao(testEnv.env.DB)
  const ids = async (q: string) => (await dao.list('user-1', { q })).map((c) => c.id)

  await expect(ids('SATO@')).resolves.toEqual(['name-only'])
  await expect(ids('acme')).resolves.toEqual(['handle'])
  await expect(ids('research_lab')).resolves.toEqual(['handle'])
  await expect(ids('book')).resolves.toEqual(['handle'])
})

test('list treats LIKE wildcards in the query literally', async () => {
  const dao = createCardDao(testEnv.env.DB)

  await expect(dao.list('user-1', { q: '%' })).resolves.toEqual([])
  // As a wildcard, `_` would match the "e" in "Research".
  await expect(dao.list('user-1', { q: 'Res_arch' })).resolves.toEqual([])
})

test('list requires every requested topic', async () => {
  const dao = createCardDao(testEnv.env.DB)
  const ids = async (topicIds: string[]) =>
    (await dao.list('user-1', { topicIds })).map((c) => c.id)

  await expect(ids(['t-1'])).resolves.toEqual(['handle', 'name-only'])
  await expect(ids(['t-1', 't-2'])).resolves.toEqual(['handle'])
})

test('findByName ignores half- and full-width spaces and never crosses users', async () => {
  const cards = await createCardDao(testEnv.env.DB).findByName('user-1', '山田　太郎')

  expect(cards.map((c) => c.id)).toEqual(['kana'])
})

test('update replaces the columns and join-table ids', async () => {
  const dao = createCardDao(testEnv.env.DB)
  const updated = cardRecord({
    id: 'handle',
    name: '鈴木',
    company_id: null,
    topic_ids: ['t-2'],
    visibility: 'company',
    updated_at: '2026-02-01T00:00:00.000Z',
  })

  await dao.update(updated)

  await expect(dao.findById('user-1', 'handle')).resolves.toEqual(updated)
})

test('delete removes the card and its links, only for the owner', async () => {
  const { DB } = testEnv.env
  const dao = createCardDao(DB)

  await dao.delete('user-2', 'handle')
  await expect(dao.findById('user-1', 'handle')).resolves.not.toBeNull()

  await dao.delete('user-1', 'handle')
  await expect(dao.findById('user-1', 'handle')).resolves.toBeNull()
  const links = await DB.prepare(
    "SELECT (SELECT COUNT(*) FROM card_departments WHERE card_id = 'handle') + (SELECT COUNT(*) FROM card_topics WHERE card_id = 'handle') AS n",
  ).first<{ n: number }>()
  expect(links?.n).toBe(0)
})

test('list with match any requires at least one requested topic', async () => {
  const cards = await createCardDao(testEnv.env.DB).list('user-1', {
    topicIds: ['t-2', 'missing'],
    match: 'any',
  })

  expect(cards.map((c) => c.id)).toEqual(['handle'])
})
