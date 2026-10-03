import type { DataVersionDao } from './data-version.interface.ts'
import type { MemoryStore } from './memory-store.ts'

export const createDataVersionDao = (store: MemoryStore): DataVersionDao => ({
  get: async (userId) => store.dataVersions.get(userId) ?? null,
  save: async (userId, version) => {
    store.dataVersions.set(userId, version)
  },
})
