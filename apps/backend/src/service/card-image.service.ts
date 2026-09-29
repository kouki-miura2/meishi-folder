import type { CardImage, CardImageRepository } from '../repository/card-image.repository.ts'
import { ServiceError } from './errors.ts'

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
/** Photos are expected to be downscaled on the client first; this only stops accidental originals. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export interface CardImageService {
  upload: (userId: string, image: CardImage) => Promise<{ id: string }>
  get: (userId: string, id: string) => Promise<CardImage>
}

export const createCardImageService = (repository: CardImageRepository): CardImageService => ({
  upload: async (userId, image) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(image.contentType)) {
      throw new ServiceError('invalid', `Unsupported image type: ${image.contentType}`)
    }
    if (image.body.byteLength > MAX_IMAGE_BYTES) {
      throw new ServiceError('invalid', 'Image is too large')
    }
    const id = crypto.randomUUID()
    await repository.put(userId, id, image)
    return { id }
  },
  get: async (userId, id) => {
    const image = await repository.get(userId, id)
    if (!image) throw new ServiceError('not_found', `Image ${id} not found`)
    return image
  },
})
