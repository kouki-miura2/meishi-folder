import { expect, test } from 'vite-plus/test'

import type { CardImageDao, CardImageObject } from '../dao/card-image.interface.ts'
import { createCardImageRepository } from './card-image.repository.ts'

const body = new Uint8Array([1, 2, 3]).buffer

test('put and get map the content type between storage and domain shapes', async () => {
  const stored = new Map<string, CardImageObject>()
  const dao: CardImageDao = {
    put: async (userId, id, object) => void stored.set(`${userId}/${id}`, object),
    get: async (userId, id) => stored.get(`${userId}/${id}`) ?? null,
    exists: async () => false,
    delete: async () => {},
  }
  const repository = createCardImageRepository(dao)

  await repository.put('user-1', 'img-1', { body, contentType: 'image/png' })

  expect(stored.get('user-1/img-1')).toEqual({ body, content_type: 'image/png' })
  await expect(repository.get('user-1', 'img-1')).resolves.toEqual({
    body,
    contentType: 'image/png',
  })
  await expect(repository.get('user-1', 'missing')).resolves.toBeNull()
})
