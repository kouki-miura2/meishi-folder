import type { MemoryStore } from './memory-store.ts'
import type { UserDao } from './user.interface.ts'

export const createUserDao = (store: MemoryStore): UserDao => ({
  findById: async (id) => structuredClone(store.users.find((user) => user.id === id) ?? null),
  save: async (record) => {
    store.users = [...store.users.filter((user) => user.id !== record.id), structuredClone(record)]
  },
})
