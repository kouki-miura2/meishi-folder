import type { CardImage, CardImageRepository } from '../repository/card-image.repository.ts'
import { ServiceError } from './errors.ts'

/** Photos are expected to be downscaled on the client first; this only stops accidental originals. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const signatures: { type: string; bytes: (number | null)[] }[] = [
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // "RIFF", 4-byte size, "WEBP"
  {
    type: 'image/webp',
    bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  },
]

/**
 * The image type read from the file's leading bytes, not from what the client declared — so
 * arbitrary content (HTML, SVG, ...) can't be stored and served back as a photo.
 */
const imageTypeOf = (body: ArrayBuffer): string | undefined => {
  const head = new Uint8Array(body, 0, Math.min(body.byteLength, 12))
  return signatures.find(({ bytes }) =>
    bytes.every((byte, i) => i < head.length && (byte === null || head[i] === byte)),
  )?.type
}

export interface CardImageService {
  upload: (userId: string, body: ArrayBuffer) => Promise<{ id: string }>
  get: (userId: string, id: string) => Promise<CardImage>
}

export const createCardImageService = (repository: CardImageRepository): CardImageService => ({
  upload: async (userId, body) => {
    const contentType = imageTypeOf(body)
    if (!contentType) {
      throw new ServiceError('invalid', 'Unsupported image type: only JPEG, PNG and WebP')
    }
    if (body.byteLength > MAX_IMAGE_BYTES) {
      throw new ServiceError('invalid', 'Image is too large')
    }
    const id = crypto.randomUUID()
    await repository.put(userId, id, { body, contentType })
    return { id }
  },
  get: async (userId, id) => {
    const image = await repository.get(userId, id)
    if (!image) throw new ServiceError('not_found', `Image ${id} not found`)
    return image
  },
})
