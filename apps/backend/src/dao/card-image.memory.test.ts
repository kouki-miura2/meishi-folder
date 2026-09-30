import { expect, test } from 'vite-plus/test'

import { createCardImageDao } from './card-image.memory.ts'
import { createMemoryStore } from './memory-store.ts'

const image = { body: new Uint8Array([1, 2, 3]).buffer, content_type: 'image/jpeg' }

test('put, get, exists and delete are scoped to the owner', async () => {
  const dao = createCardImageDao(createMemoryStore())

  await dao.put('user-1', 'img-1', image)

  await expect(dao.get('user-1', 'img-1')).resolves.toEqual(image)
  await expect(dao.exists('user-1', 'img-1')).resolves.toBe(true)
  await expect(dao.get('user-2', 'img-1')).resolves.toBeNull()
  await expect(dao.exists('user-2', 'img-1')).resolves.toBe(false)

  await dao.delete('user-1', ['img-1'])
  await expect(dao.exists('user-1', 'img-1')).resolves.toBe(false)
})

test('list returns every stored photo with its owner and upload time', async () => {
  const dao = createCardImageDao(createMemoryStore())
  await dao.put('user-1', 'img-1', image)
  await dao.put('user-2', 'img-2', image)

  const entries = await dao.list()

  expect(entries.map(({ user_id, id }) => ({ user_id, id }))).toEqual([
    { user_id: 'user-1', id: 'img-1' },
    { user_id: 'user-2', id: 'img-2' },
  ])
  expect(Number.isNaN(Date.parse(entries[0]?.uploaded_at ?? ''))).toBe(false)
})
