import { expect, test } from 'vite-plus/test'

import { createDepartmentDao } from './department.memory.ts'
import { cardRecord } from './fixtures.ts'
import { createMemoryStore } from './memory-store.ts'

const setup = () => {
  const store = createMemoryStore()
  store.departments.push(
    { id: 'd-2', user_id: 'user-1', company_id: 'c-1', name: '開発部' },
    { id: 'd-1', user_id: 'user-1', company_id: 'c-1', name: '営業部' },
    { id: 'd-3', user_id: 'user-1', company_id: 'c-2', name: '営業部' },
    { id: 'd-other', user_id: 'user-2', company_id: 'c-9', name: '営業部' },
  )
  return { store, dao: createDepartmentDao(store) }
}

test('listByCompany returns the company’s departments ordered by name', async () => {
  const { dao } = setup()

  const departments = await dao.listByCompany('user-1', 'c-1')

  expect(departments.map((d) => d.id)).toEqual(['d-1', 'd-2'])
})

test('listByUser returns every department of the user', async () => {
  const { dao } = setup()

  const departments = await dao.listByUser('user-1')

  expect(departments).toHaveLength(3)
})

test('findByName is scoped to the company', async () => {
  const { dao } = setup()

  await expect(dao.findByName('user-1', 'c-2', '営業部')).resolves.toMatchObject({ id: 'd-3' })
  await expect(dao.findByName('user-1', 'c-2', '開発部')).resolves.toBeNull()
})

test('insert, rename and delete', async () => {
  const { dao } = setup()

  await dao.insert({ id: 'd-new', user_id: 'user-1', company_id: 'c-1', name: '総務部' })
  await dao.rename('user-1', 'd-new', '総務課')
  await expect(dao.findById('user-1', 'd-new')).resolves.toMatchObject({ name: '総務課' })

  await dao.delete('user-1', 'd-new')
  await expect(dao.findById('user-1', 'd-new')).resolves.toBeNull()
})

test('isReferenced checks cards and user affiliations', async () => {
  const { store, dao } = setup()
  store.cards.push(cardRecord({ department_ids: ['d-1'] }))

  await expect(dao.isReferenced('user-1', 'd-1')).resolves.toBe(true)
  await expect(dao.isReferenced('user-1', 'd-2')).resolves.toBe(false)
})

test('merge re-points cards and affiliations without duplicates, then deletes the sources', async () => {
  const { store, dao } = setup()
  store.cards.push(cardRecord({ department_ids: ['d-1', 'd-2'] }))
  store.users.push({
    id: 'user-1',
    name: '山田',
    name_kana: null,
    terms_version: null,
    terms_agreed_at: null,
    created_at: '',
    updated_at: '',
    affiliations: [{ company_id: 'c-1', department_id: 'd-2' }],
  })

  await dao.merge('user-1', 'd-1', ['d-2'])

  expect(store.cards[0]?.department_ids).toEqual(['d-1'])
  expect(store.users[0]?.affiliations).toEqual([{ company_id: 'c-1', department_id: 'd-1' }])
  await expect(dao.findById('user-1', 'd-2')).resolves.toBeNull()
})

test('listByCompany counts the cards of each department', async () => {
  const { store, dao } = setup()
  store.cards.push(cardRecord({ department_ids: ['d-1'] }))

  const departments = await dao.listByCompany('user-1', 'c-1')

  expect(departments.map((d) => [d.id, d.card_count])).toEqual([
    ['d-1', 1],
    ['d-2', 0],
  ])
})
