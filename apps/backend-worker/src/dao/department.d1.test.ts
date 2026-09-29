import { cardRecord } from 'backend/src/dao/fixtures.ts'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vite-plus/test'

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
beforeEach(async () => {
  await testEnv.reset()
  const { DB } = testEnv.env
  const companies = createCompanyDao(DB)
  await companies.insert({ id: 'c-1', user_id: 'user-1', name: 'Acme' })
  await companies.insert({ id: 'c-2', user_id: 'user-1', name: 'Beta' })
  const dao = createDepartmentDao(DB)
  await dao.insert({ id: 'd-2', user_id: 'user-1', company_id: 'c-1', name: '開発部' })
  await dao.insert({ id: 'd-1', user_id: 'user-1', company_id: 'c-1', name: '営業部' })
  await dao.insert({ id: 'd-3', user_id: 'user-1', company_id: 'c-2', name: '営業部' })
})

test('listByCompany and listByUser are ordered by name', async () => {
  const dao = createDepartmentDao(testEnv.env.DB)

  const byCompany = await dao.listByCompany('user-1', 'c-1')
  const byUser = await dao.listByUser('user-1')

  expect(byCompany.map((d) => d.id)).toEqual(['d-1', 'd-2'])
  expect(byUser).toHaveLength(3)
})

test('findByName is scoped to the company, findById to the user', async () => {
  const dao = createDepartmentDao(testEnv.env.DB)

  await expect(dao.findByName('user-1', 'c-2', '営業部')).resolves.toMatchObject({ id: 'd-3' })
  await expect(dao.findByName('user-1', 'c-2', '開発部')).resolves.toBeNull()
  await expect(dao.findById('user-2', 'd-1')).resolves.toBeNull()
})

test('rename and delete', async () => {
  const dao = createDepartmentDao(testEnv.env.DB)

  await dao.rename('user-1', 'd-2', '開発本部')
  await expect(dao.findById('user-1', 'd-2')).resolves.toMatchObject({ name: '開発本部' })

  await dao.delete('user-1', 'd-2')
  await expect(dao.findById('user-1', 'd-2')).resolves.toBeNull()
})

test('isReferenced checks cards and user affiliations', async () => {
  const { DB } = testEnv.env
  const dao = createDepartmentDao(DB)
  await createCardDao(DB).insert(cardRecord({ company_id: 'c-1', department_ids: ['d-1'] }))
  await createUserDao(DB).save({
    id: 'user-1',
    name: '山田',
    name_kana: null,
    created_at: '',
    updated_at: '',
    affiliations: [{ company_id: 'c-2', department_id: 'd-3' }],
  })

  await expect(dao.isReferenced('user-1', 'd-1')).resolves.toBe(true)
  await expect(dao.isReferenced('user-1', 'd-3')).resolves.toBe(true)
  await expect(dao.isReferenced('user-1', 'd-2')).resolves.toBe(false)
})

test('merge re-points cards and affiliations without duplicates, then deletes the sources', async () => {
  const { DB } = testEnv.env
  const dao = createDepartmentDao(DB)
  const cards = createCardDao(DB)
  const users = createUserDao(DB)
  await cards.insert(cardRecord({ company_id: 'c-1', department_ids: ['d-1', 'd-2'] }))
  await users.save({
    id: 'user-1',
    name: '山田',
    name_kana: null,
    created_at: '',
    updated_at: '',
    affiliations: [
      { company_id: 'c-1', department_id: 'd-1' },
      { company_id: 'c-1', department_id: 'd-2' },
    ],
  })

  await dao.merge('user-1', 'd-1', ['d-2'])

  await expect(cards.findById('user-1', 'card-1')).resolves.toMatchObject({
    department_ids: ['d-1'],
  })
  await expect(users.findById('user-1')).resolves.toMatchObject({
    affiliations: [{ company_id: 'c-1', department_id: 'd-1' }],
  })
  await expect(dao.findById('user-1', 'd-2')).resolves.toBeNull()
})

test('listByCompany counts the cards of each department', async () => {
  const { DB } = testEnv.env
  await createCardDao(DB).insert(cardRecord({ company_id: 'c-1', department_ids: ['d-1'] }))

  const departments = await createDepartmentDao(DB).listByCompany('user-1', 'c-1')

  expect(departments.map((d) => [d.id, d.card_count])).toEqual([
    ['d-1', 1],
    ['d-2', 0],
  ])
})
