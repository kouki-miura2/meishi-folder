import type { MemoryStore } from './memory-store.ts'
import type { UserDao } from './user.interface.ts'

export const createUserDao = (store: MemoryStore): UserDao => ({
  findById: async (id) => structuredClone(store.users.find((user) => user.id === id) ?? null),
  save: async (record) => {
    store.users = [...store.users.filter((user) => user.id !== record.id), structuredClone(record)]
  },
  deleteAll: async (id) => {
    store.users = store.users.filter((user) => user.id !== id)
    store.companies = store.companies.filter((company) => company.user_id !== id)
    store.departments = store.departments.filter((department) => department.user_id !== id)
    store.topics = store.topics.filter((topic) => topic.user_id !== id)
    store.cards = store.cards.filter((card) => card.user_id !== id)
  },
})
