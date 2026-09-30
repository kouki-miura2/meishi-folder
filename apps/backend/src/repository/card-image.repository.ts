import type { CardImageDao, CardImageObject } from '../dao/card-image.interface.ts'

export interface CardImage {
  body: ArrayBuffer
  contentType: string
}

export interface CardImageEntry {
  userId: string
  id: string
  uploadedAt: Date
}

export interface CardImageRepository {
  put: (userId: string, id: string, image: CardImage) => Promise<void>
  get: (userId: string, id: string) => Promise<CardImage | null>
  exists: (userId: string, id: string) => Promise<boolean>
  delete: (userId: string, ids: string[]) => Promise<void>
  /** Every stored photo of every user: only for sweeping out photos no card uses. */
  list: () => Promise<CardImageEntry[]>
}

const toCardImage = (object: CardImageObject): CardImage => ({
  body: object.body,
  contentType: object.content_type,
})

export const createCardImageRepository = (dao: CardImageDao): CardImageRepository => ({
  put: (userId, id, image) =>
    dao.put(userId, id, { body: image.body, content_type: image.contentType }),
  get: async (userId, id) => {
    const object = await dao.get(userId, id)
    return object ? toCardImage(object) : null
  },
  exists: dao.exists,
  delete: dao.delete,
  list: async () =>
    (await dao.list()).map((entry) => ({
      userId: entry.user_id,
      id: entry.id,
      uploadedAt: new Date(entry.uploaded_at),
    })),
})
