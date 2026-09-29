import type { CardImageDao } from './card-image.interface.ts'
import type { MemoryStore } from './memory-store.ts'

export const createCardImageDao = (store: MemoryStore): CardImageDao => ({
  put: async (userId, id, object) => {
    store.images.set(`${userId}/${id}`, object)
  },
  get: async (userId, id) => store.images.get(`${userId}/${id}`) ?? null,
  exists: async (userId, id) => store.images.has(`${userId}/${id}`),
  delete: async (userId, ids) => {
    for (const id of ids) store.images.delete(`${userId}/${id}`)
  },
})
