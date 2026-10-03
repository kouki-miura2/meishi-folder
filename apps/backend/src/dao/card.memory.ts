import type { CardDao, CardRecord } from './card.interface.ts'
import type { MemoryStore } from './memory-store.ts'

const sortKey = (card: CardRecord) => card.name_kana ?? card.handle_name ?? card.name ?? ''
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const withoutSpaces = (value: string) => value.replace(/[ 　]/g, '')

export const createCardDao = (store: MemoryStore): CardDao => ({
  list: async (userId) =>
    structuredClone(
      store.cards
        .filter((card) => card.user_id === userId)
        .sort((a, b) => compare(sortKey(a), sortKey(b)) || compare(a.created_at, b.created_at)),
    ),
  findById: async (userId, id) =>
    structuredClone(store.cards.find((c) => c.user_id === userId && c.id === id) ?? null),
  findByName: async (userId, name) =>
    structuredClone(
      store.cards.filter(
        (c) =>
          c.user_id === userId && c.name !== null && withoutSpaces(c.name) === withoutSpaces(name),
      ),
    ),
  count: async (userId) => store.cards.filter((c) => c.user_id === userId).length,
  insert: async (record) => {
    store.cards.push(structuredClone(record))
  },
  update: async (record) => {
    store.cards = store.cards.map((c) =>
      c.user_id === record.user_id && c.id === record.id ? structuredClone(record) : c,
    )
  },
  delete: async (userId, id) => {
    store.cards = store.cards.filter((c) => !(c.user_id === userId && c.id === id))
  },
})
