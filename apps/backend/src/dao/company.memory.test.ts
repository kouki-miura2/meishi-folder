import { expect, test } from 'vite-plus/test'

import { createCompanyDao } from './company.memory.ts'
import { cardRecord } from './fixtures.ts'
import { createMemoryStore } from './memory-store.ts'

const setup = () => {
  const store = createMemoryStore()
  store.companies.push(
    { id: 'c-b', user_id: 'user-1', name: 'B社' },
    { id: 'c-a', user_id: 'user-1', name: 'A社' },
    { id: 'c-other', user_id: 'user-2', name: 'A社' },
  )
  return { store, dao: createCompanyDao(store) }
}

test('listByUser returns only the user’s companies, ordered by name', async () => {
  const { dao } = setup()

  const companies = await dao.listByUser('user-1')

  expect(companies.map((c) => c.id)).toEqual(['c-a', 'c-b'])
})

test('findById and findByName never cross users', async () => {
  const { dao } = setup()

  await expect(dao.findById('user-1', 'c-other')).resolves.toBeNull()
  await expect(dao.findByName('user-2', 'A社')).resolves.toMatchObject({ id: 'c-other' })
})

test('insert and rename', async () => {
  const { dao } = setup()

  await dao.insert({ id: 'c-new', user_id: 'user-1', name: 'C社' })
  await dao.rename('user-1', 'c-new', 'C株式会社')

  await expect(dao.findById('user-1', 'c-new')).resolves.toMatchObject({ name: 'C株式会社' })
})

test('delete removes the company and its departments', async () => {
  const { store, dao } = setup()
  store.departments.push({ id: 'd-1', user_id: 'user-1', company_id: 'c-a', name: '営業部' })

  await dao.delete('user-1', 'c-a')

  await expect(dao.findById('user-1', 'c-a')).resolves.toBeNull()
  expect(store.departments).toEqual([])
})

test('isReferenced checks cards and user affiliations', async () => {
  const { store, dao } = setup()
  store.cards.push(cardRecord({ company_id: 'c-a' }))
  store.users.push({
    id: 'user-1',
    name: '山田',
    name_kana: null,
    created_at: '',
    updated_at: '',
    affiliations: [{ company_id: 'c-b', department_id: null }],
  })

  await expect(dao.isReferenced('user-1', 'c-a')).resolves.toBe(true)
  await expect(dao.isReferenced('user-1', 'c-b')).resolves.toBe(true)
  await expect(dao.isReferenced('user-1', 'c-other')).resolves.toBe(false)
})

test('merge re-points cards, affiliations and departments, folding same-named departments', async () => {
  const { store, dao } = setup()
  store.departments.push(
    { id: 'd-a-sales', user_id: 'user-1', company_id: 'c-a', name: '営業部' },
    { id: 'd-b-sales', user_id: 'user-1', company_id: 'c-b', name: '営業部' },
    { id: 'd-b-dev', user_id: 'user-1', company_id: 'c-b', name: '開発部' },
  )
  store.cards.push(cardRecord({ company_id: 'c-b', department_ids: ['d-b-sales', 'd-b-dev'] }))
  store.users.push({
    id: 'user-1',
    name: '山田',
    name_kana: null,
    created_at: '',
    updated_at: '',
    affiliations: [
      { company_id: 'c-a', department_id: 'd-a-sales' },
      { company_id: 'c-b', department_id: 'd-b-sales' },
    ],
  })

  await dao.merge('user-1', 'c-a', ['c-b'])

  expect(store.companies.map((c) => c.id)).toEqual(['c-a', 'c-other'])
  expect(store.departments).toEqual([
    { id: 'd-a-sales', user_id: 'user-1', company_id: 'c-a', name: '営業部' },
    { id: 'd-b-dev', user_id: 'user-1', company_id: 'c-a', name: '開発部' },
  ])
  expect(store.cards[0]).toMatchObject({
    company_id: 'c-a',
    department_ids: ['d-a-sales', 'd-b-dev'],
  })
  expect(store.users[0]?.affiliations).toEqual([{ company_id: 'c-a', department_id: 'd-a-sales' }])
})
