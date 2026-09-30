import { expect, test } from 'vite-plus/test'

import { MAX_IMAGE_BYTES, createCardImageService } from './card-image.service.ts'
import { fakeCardImageRepository } from './fakes.ts'

const fileOf = (head: number[], size = 16): ArrayBuffer => {
  const bytes = new Uint8Array(size)
  bytes.set(head)
  return bytes.buffer
}

const jpeg = [0xff, 0xd8, 0xff, 0xe0]
const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const webp = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]

test('upload stores an accepted image under a new id that get then resolves', async () => {
  const repository = fakeCardImageRepository()
  const service = createCardImageService(repository)
  const body = fileOf(jpeg)

  const { id } = await service.upload('user-1', body)

  const image = { body, contentType: 'image/jpeg' }
  expect(repository.images.get(id)).toEqual(image)
  await expect(service.get('user-1', id)).resolves.toEqual(image)
})

test.each([
  [png, 'image/png'],
  [webp, 'image/webp'],
])('upload takes the content type from the file contents', async (head, contentType) => {
  const repository = fakeCardImageRepository()
  const { id } = await createCardImageService(repository).upload('user-1', fileOf(head))

  expect(repository.images.get(id)?.contentType).toBe(contentType)
})

test('upload rejects contents that are not JPEG, PNG or WebP, and oversized images', async () => {
  const service = createCardImageService(fakeCardImageRepository())
  const html = [...new TextEncoder().encode('<html><script>')]
  const gif = [...new TextEncoder().encode('GIF89a')]

  for (const head of [html, gif, [0xff, 0xd8]]) {
    await expect(service.upload('user-1', fileOf(head, head.length))).rejects.toMatchObject({
      code: 'invalid',
    })
  }
  await expect(service.upload('user-1', fileOf(png, MAX_IMAGE_BYTES + 1))).rejects.toMatchObject({
    code: 'invalid',
  })
})

test('get reports not_found for an unknown image', async () => {
  const service = createCardImageService(fakeCardImageRepository())

  await expect(service.get('user-1', 'missing')).rejects.toMatchObject({ code: 'not_found' })
})
