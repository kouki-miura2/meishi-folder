import { byName, type MemoryStore } from './memory-store.ts'
import type { TopicDao } from './topic.interface.ts'

export const createTopicDao = (store: MemoryStore): TopicDao => ({
  listByUser: async (userId) =>
    store.topics
      .filter((t) => t.user_id === userId)
      .sort(byName)
      .map((t) => ({ ...t })),
  findByName: async (userId, kind, name) => {
    const topic = store.topics.find(
      (t) => t.user_id === userId && t.kind === kind && t.name === name,
    )
    return topic ? { ...topic } : null
  },
  insert: async (record) => {
    store.topics.push({ ...record })
  },
})
