import type { CardImageDao } from 'backend/src/dao/card-image.interface.ts'

// Keys are prefixed with the owner, so an id alone never reaches another user's photo.
const keyOf = (userId: string, id: string) => `${userId}/${id}`

export const createCardImageDao = (bucket: R2Bucket): CardImageDao => ({
  put: async (userId, id, object) => {
    await bucket.put(keyOf(userId, id), object.body, {
      httpMetadata: { contentType: object.content_type },
    })
  },
  get: async (userId, id) => {
    const object = await bucket.get(keyOf(userId, id))
    if (!object) return null
    return {
      body: await object.arrayBuffer(),
      content_type: object.httpMetadata?.contentType ?? 'application/octet-stream',
    }
  },
  exists: async (userId, id) => (await bucket.head(keyOf(userId, id))) !== null,
  delete: async (userId, ids) => {
    if (ids.length > 0) await bucket.delete(ids.map((id) => keyOf(userId, id)))
  },
})
