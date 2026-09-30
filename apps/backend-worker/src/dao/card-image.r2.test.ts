import { afterAll, beforeAll, expect, test } from 'vite-plus/test'

import { createCardImageDao } from './card-image.r2.ts'
import { createTestEnv } from './test-env.ts'

let testEnv: Awaited<ReturnType<typeof createTestEnv>>
beforeAll(async () => {
  testEnv = await createTestEnv()
})
afterAll(() => testEnv.dispose())

test('put, get, exists and delete are scoped to the owner', async () => {
  const dao = createCardImageDao(testEnv.env.IMAGES)
  const body = new Uint8Array([1, 2, 3]).buffer

  await dao.put('user-1', 'img-1', { body, content_type: 'image/png' })

  const stored = await dao.get('user-1', 'img-1')
  expect(stored?.content_type).toBe('image/png')
  expect(new Uint8Array(stored?.body ?? new ArrayBuffer(0))).toEqual(new Uint8Array([1, 2, 3]))
  await expect(dao.exists('user-1', 'img-1')).resolves.toBe(true)
  await expect(dao.get('user-2', 'img-1')).resolves.toBeNull()
  await expect(dao.exists('user-2', 'img-1')).resolves.toBe(false)

  await dao.delete('user-1', ['img-1'])
  await expect(dao.exists('user-1', 'img-1')).resolves.toBe(false)
  await dao.delete('user-1', [])
})

test('list returns every stored photo with its owner and upload time', async () => {
  const dao = createCardImageDao(testEnv.env.IMAGES)
  const body = new Uint8Array([1]).buffer
  await dao.put('user-1', 'img-a', { body, content_type: 'image/jpeg' })
  await dao.put('user-2', 'img-b', { body, content_type: 'image/jpeg' })

  const entries = await dao.list()

  expect(entries.map(({ user_id, id }) => ({ user_id, id }))).toEqual([
    { user_id: 'user-1', id: 'img-a' },
    { user_id: 'user-2', id: 'img-b' },
  ])
  expect(Number.isNaN(Date.parse(entries[0]?.uploaded_at ?? ''))).toBe(false)

  await dao.delete('user-1', ['img-a'])
  await dao.delete('user-2', ['img-b'])
})
