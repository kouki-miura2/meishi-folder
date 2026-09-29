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
