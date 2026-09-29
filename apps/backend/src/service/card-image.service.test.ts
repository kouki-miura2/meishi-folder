import { expect, test } from 'vite-plus/test'

import { MAX_IMAGE_BYTES, createCardImageService } from './card-image.service.ts'
import { fakeCardImageRepository } from './fakes.ts'

test('upload stores an accepted image under a new id that get then resolves', async () => {
  const repository = fakeCardImageRepository()
  const service = createCardImageService(repository)
  const image = { body: new ArrayBuffer(10), contentType: 'image/jpeg' }

  const { id } = await service.upload('user-1', image)

  expect(repository.images.get(id)).toEqual(image)
  await expect(service.get('user-1', id)).resolves.toEqual(image)
})

test('upload rejects unsupported types and oversized images', async () => {
  const service = createCardImageService(fakeCardImageRepository())

  await expect(
    service.upload('user-1', { body: new ArrayBuffer(10), contentType: 'image/gif' }),
  ).rejects.toMatchObject({ code: 'invalid' })
  await expect(
    service.upload('user-1', {
      body: new ArrayBuffer(MAX_IMAGE_BYTES + 1),
      contentType: 'image/png',
    }),
  ).rejects.toMatchObject({ code: 'invalid' })
})

test('get reports not_found for an unknown image', async () => {
  const service = createCardImageService(fakeCardImageRepository())

  await expect(service.get('user-1', 'missing')).rejects.toMatchObject({ code: 'not_found' })
})
