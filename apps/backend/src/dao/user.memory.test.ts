import { expect, test } from 'vite-plus/test'

import { cardRecord } from './fixtures.ts'
import { createMemoryStore } from './memory-store.ts'
import type { UserRecord } from './user.interface.ts'
import { createUserDao } from './user.memory.ts'

const user: UserRecord = {
  id: 'user-1',
  name: '山田 太郎',
  name_kana: null,
  terms_version: null,
  terms_agreed_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  affiliations: [{ company_id: 'company-1', department_id: null }],
}

test('save inserts a user that findById then resolves', async () => {
  const dao = createUserDao(createMemoryStore())

  await dao.save(user)

  await expect(dao.findById('user-1')).resolves.toEqual(user)
})

test('save replaces an existing user', async () => {
  const dao = createUserDao(createMemoryStore())
  await dao.save(user)

  await dao.save({ ...user, name: '山田 花子', affiliations: [] })

  await expect(dao.findById('user-1')).resolves.toMatchObject({
    name: '山田 花子',
    affiliations: [],
  })
})

test('findById resolves null for an unknown user', async () => {
  const dao = createUserDao(createMemoryStore())

  await expect(dao.findById('missing')).resolves.toBeNull()
})

test('deleteAll removes the user and every row they own, leaving other users alone', async () => {
  const store = createMemoryStore()
  const dao = createUserDao(store)
  for (const owner of ['user-1', 'user-2']) {
    await dao.save({ ...user, id: owner })
    store.companies.push({ id: `${owner}-c`, user_id: owner, name: 'Acme' })
    store.departments.push({
      id: `${owner}-d`,
      user_id: owner,
      company_id: `${owner}-c`,
      name: '営業部',
    })
    store.topics.push({ id: `${owner}-t`, user_id: owner, kind: 'project', name: 'Apollo' })
    store.cards.push(cardRecord({ id: `${owner}-card`, user_id: owner }))
    store.dataVersions.set(owner, 'v1')
  }

  await dao.deleteAll('user-1')

  await expect(dao.findById('user-1')).resolves.toBeNull()
  await expect(dao.findById('user-2')).resolves.not.toBeNull()
  for (const table of [store.companies, store.departments, store.topics, store.cards]) {
    expect(table.map((row) => row.user_id)).toEqual(['user-2'])
  }
  expect([...store.dataVersions.keys()]).toEqual(['user-2'])
})
