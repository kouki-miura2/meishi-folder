import { expect, test } from 'vite-plus/test'

import { createCardDao } from './card.memory.ts'
import { cardRecord } from './fixtures.ts'
import { createMemoryStore } from './memory-store.ts'

const setup = () => {
  const store = createMemoryStore()
  store.companies.push({ id: 'c-1', user_id: 'user-1', name: 'Acme' })
  store.topics.push({ id: 't-1', user_id: 'user-1', kind: 'project', name: 'Apollo' })
  store.cards.push(
    cardRecord({ id: 'kana', name: '山田 太郎', name_kana: 'ヤマダ タロウ', memo: 'Demo day' }),
    cardRecord({ id: 'handle', handle_name: 'アルファ', company_id: 'c-1' }),
    cardRecord({
      id: 'name-only',
      name: '佐藤',
      topic_ids: ['t-1'],
      emails: '["sato@example.com"]',
    }),
    cardRecord({ id: 'other-user', user_id: 'user-2', name: '山田 太郎' }),
  )
  return { store, dao: createCardDao(store) }
}

test('list orders by kana, falling back to handle name, then name', async () => {
  const { dao } = setup()

  const cards = await dao.list('user-1', {})

  expect(cards.map((c) => c.id)).toEqual(['handle', 'kana', 'name-only'])
})

test('list filters by text across columns and master names', async () => {
  const { dao } = setup()

  const byEmail = await dao.list('user-1', { q: 'SATO@' })
  const byCompany = await dao.list('user-1', { q: 'acme' })
  const byTopic = await dao.list('user-1', { q: 'apollo' })
  const byMemo = await dao.list('user-1', { q: 'demo' })

  expect(byEmail.map((c) => c.id)).toEqual(['name-only'])
  expect(byCompany.map((c) => c.id)).toEqual(['handle'])
  expect(byTopic.map((c) => c.id)).toEqual(['name-only'])
  expect(byMemo.map((c) => c.id)).toEqual(['kana'])
})

test('list requires every requested topic', async () => {
  const { dao } = setup()

  await expect(dao.list('user-1', { topicIds: ['t-1'] })).resolves.toHaveLength(1)
  await expect(dao.list('user-1', { topicIds: ['t-1', 't-2'] })).resolves.toEqual([])
})

test('findByName ignores half- and full-width spaces and never crosses users', async () => {
  const { dao } = setup()

  const cards = await dao.findByName('user-1', '山田　太郎')

  expect(cards.map((c) => c.id)).toEqual(['kana'])
})

test('insert, update and delete', async () => {
  const { dao } = setup()

  await dao.insert(cardRecord({ id: 'new', name: '鈴木' }))
  await dao.update(cardRecord({ id: 'new', name: '鈴木 一郎' }))
  await expect(dao.findById('user-1', 'new')).resolves.toMatchObject({ name: '鈴木 一郎' })

  await dao.delete('user-1', 'new')
  await expect(dao.findById('user-1', 'new')).resolves.toBeNull()
})

test('findById never crosses users', async () => {
  const { dao } = setup()

  await expect(dao.findById('user-1', 'other-user')).resolves.toBeNull()
})

test('list with match any requires at least one requested topic', async () => {
  const { dao } = setup()

  const cards = await dao.list('user-1', { topicIds: ['t-1', 't-2'], match: 'any' })

  expect(cards.map((c) => c.id)).toEqual(['name-only'])
})

test('count counts only the given user', async () => {
  const { dao } = setup()

  await expect(dao.count('user-1')).resolves.toBe(3)
  await expect(dao.count('user-2')).resolves.toBe(1)
  await expect(dao.count('user-3')).resolves.toBe(0)
})
