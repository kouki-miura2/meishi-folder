import { cardRecord } from 'backend/src/dao/fixtures.ts'
import { afterAll, beforeAll, expect, test } from 'vite-plus/test'

import { createCardDao } from './card.d1.ts'
import { createCompanyDao } from './company.d1.ts'
import { createDepartmentDao } from './department.d1.ts'
import { createTestEnv } from './test-env.ts'
import { createUserDao } from './user.d1.ts'

let testEnv: Awaited<ReturnType<typeof createTestEnv>>
beforeAll(async () => {
  testEnv = await createTestEnv()
})
afterAll(() => testEnv.dispose())

const setup = async () => {
  await testEnv.reset()
  const { DB } = testEnv.env
  const dao = createCompanyDao(DB)
  await dao.insert({ id: 'c-b', user_id: 'user-1', name: 'B社' })
  await dao.insert({ id: 'c-a', user_id: 'user-1', name: 'A社' })
  await dao.insert({ id: 'c-other', user_id: 'user-2', name: 'A社' })
  return {
    dao,
    departments: createDepartmentDao(DB),
    cards: createCardDao(DB),
    users: createUserDao(DB),
  }
}

test('listByUser returns only the user’s companies, ordered by name', async () => {
  const { dao } = await setup()

  const companies = await dao.listByUser('user-1')

  expect(companies.map((c) => c.id)).toEqual(['c-a', 'c-b'])
})

test('findById and findByName never cross users', async () => {
  const { dao } = await setup()

  await expect(dao.findById('user-1', 'c-other')).resolves.toBeNull()
  await expect(dao.findByName('user-2', 'A社')).resolves.toEqual({
    id: 'c-other',
    user_id: 'user-2',
    name: 'A社',
  })
})

test('rename and delete, which also removes the company’s departments', async () => {
  const { dao, departments } = await setup()
  await departments.insert({ id: 'd-1', user_id: 'user-1', company_id: 'c-a', name: '営業部' })

  await dao.rename('user-1', 'c-a', 'A株式会社')
  await expect(dao.findById('user-1', 'c-a')).resolves.toMatchObject({ name: 'A株式会社' })

  await dao.delete('user-1', 'c-a')
  await expect(dao.findById('user-1', 'c-a')).resolves.toBeNull()
  await expect(departments.findById('user-1', 'd-1')).resolves.toBeNull()
})

test('isReferenced checks cards and user affiliations', async () => {
  const { dao, cards, users } = await setup()
  await cards.insert(cardRecord({ company_id: 'c-a' }))
  await users.save({
    id: 'user-1',
    name: '山田',
    name_kana: null,
    created_at: '',
    updated_at: '',
    affiliations: [{ company_id: 'c-b', department_id: null }],
  })

  await expect(dao.isReferenced('user-1', 'c-a')).resolves.toBe(true)
  await expect(dao.isReferenced('user-1', 'c-b')).resolves.toBe(true)
  await expect(dao.isReferenced('user-2', 'c-other')).resolves.toBe(false)
})

test('merge re-points cards, affiliations and departments, folding same-named departments', async () => {
  const { dao, departments, cards, users } = await setup()
  await dao.insert({ id: 'c-c', user_id: 'user-1', name: 'C社' })
  await departments.insert({
    id: 'd-a-sales',
    user_id: 'user-1',
    company_id: 'c-a',
    name: '営業部',
  })
  await departments.insert({
    id: 'd-b-sales',
    user_id: 'user-1',
    company_id: 'c-b',
    name: '営業部',
  })
  await departments.insert({ id: 'd-b-dev', user_id: 'user-1', company_id: 'c-b', name: '開発部' })
  // Both sources hold a 開発部 the target lacks: the second must fold into the first.
  await departments.insert({ id: 'd-c-dev', user_id: 'user-1', company_id: 'c-c', name: '開発部' })
  await cards.insert(cardRecord({ company_id: 'c-b', department_ids: ['d-b-sales', 'd-b-dev'] }))
  await cards.insert(cardRecord({ id: 'card-2', company_id: 'c-c', department_ids: ['d-c-dev'] }))
  await users.save({
    id: 'user-1',
    name: '山田',
    name_kana: null,
    created_at: '',
    updated_at: '',
    affiliations: [
      { company_id: 'c-a', department_id: 'd-a-sales' },
      { company_id: 'c-b', department_id: 'd-b-sales' },
      { company_id: 'c-c', department_id: 'd-c-dev' },
    ],
  })

  await dao.merge('user-1', 'c-a', ['c-b', 'c-c'])

  await expect(dao.listByUser('user-1')).resolves.toEqual([
    { id: 'c-a', user_id: 'user-1', name: 'A社', card_count: 2, department_count: 2 },
  ])
  await expect(departments.listByUser('user-1')).resolves.toEqual([
    { id: 'd-a-sales', user_id: 'user-1', company_id: 'c-a', name: '営業部' },
    { id: 'd-b-dev', user_id: 'user-1', company_id: 'c-a', name: '開発部' },
  ])
  await expect(cards.findById('user-1', 'card-1')).resolves.toMatchObject({
    company_id: 'c-a',
    department_ids: expect.arrayContaining(['d-a-sales', 'd-b-dev']),
  })
  await expect(cards.findById('user-1', 'card-2')).resolves.toMatchObject({
    company_id: 'c-a',
    department_ids: ['d-b-dev'],
  })
  await expect(users.findById('user-1')).resolves.toMatchObject({
    affiliations: [
      { company_id: 'c-a', department_id: 'd-a-sales' },
      { company_id: 'c-a', department_id: 'd-b-dev' },
    ],
  })
})

test('listByUser counts the cards and departments of each company', async () => {
  const { dao, departments, cards } = await setup()
  await departments.insert({ id: 'd-1', user_id: 'user-1', company_id: 'c-a', name: '営業部' })
  await cards.insert(cardRecord({ company_id: 'c-a' }))
  await cards.insert(cardRecord({ id: 'card-2', company_id: 'c-a' }))

  const companies = await dao.listByUser('user-1')

  expect(companies).toEqual([
    { id: 'c-a', user_id: 'user-1', name: 'A社', card_count: 2, department_count: 1 },
    { id: 'c-b', user_id: 'user-1', name: 'B社', card_count: 0, department_count: 0 },
  ])
})
