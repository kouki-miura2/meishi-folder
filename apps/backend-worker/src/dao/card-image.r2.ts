import type { CardImageDao } from 'backend/src/dao/card-image.interface.ts'

// Keys are prefixed with the owner, so an id alone never reaches another user's photo.
const keyOf = (userId: string, id: string) => `${userId}/${id}`
// R2 deletes at most 1000 keys per call.
const DELETE_BATCH = 1000

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
    for (let i = 0; i < ids.length; i += DELETE_BATCH) {
      await bucket.delete(ids.slice(i, i + DELETE_BATCH).map((id) => keyOf(userId, id)))
    }
  },
  list: async () => {
    const entries = []
    let cursor: string | undefined
    do {
      const page = await bucket.list({ cursor })
      for (const object of page.objects) {
        const [user_id = '', id = ''] = object.key.split('/')
        entries.push({ user_id, id, uploaded_at: object.uploaded.toISOString() })
      }
      cursor = page.truncated ? page.cursor : undefined
    } while (cursor)
    return entries
  },
})
