import type { CardDao, CardRecord } from './card.interface.ts'
import type { MemoryStore } from './memory-store.ts'

const TEXT_COLUMNS = [
  'name',
  'name_kana',
  'name_romaji',
  'titles',
  'job_types',
  'mobile',
  'emails',
  'other_contacts',
  'url',
  'offices',
  'met_on',
  'met_at',
  'met_occasion',
  'handle_name',
] as const satisfies (keyof CardRecord)[]

const sortKey = (card: CardRecord) => card.name_kana ?? card.handle_name ?? card.name ?? ''
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const withoutSpaces = (value: string) => value.replace(/[ 　]/g, '')

export const createCardDao = (store: MemoryStore): CardDao => {
  const masterNames = (card: CardRecord) => [
    ...store.companies.filter((c) => c.id === card.company_id).map((c) => c.name),
    ...store.departments.filter((d) => card.department_ids.includes(d.id)).map((d) => d.name),
    ...store.topics.filter((t) => card.topic_ids.includes(t.id)).map((t) => t.name),
  ]
  const matches = (card: CardRecord, q: string) =>
    [...TEXT_COLUMNS.map((column) => card[column]), ...masterNames(card)].some((value) =>
      value?.toLowerCase().includes(q.toLowerCase()),
    )

  return {
    list: async (userId, { q, topicIds = [], match = 'all' }) =>
      structuredClone(
        store.cards
          .filter((card) => card.user_id === userId)
          .filter((card) => !q || matches(card, q))
          .filter(
            (card) =>
              topicIds.length === 0 ||
              topicIds[match === 'any' ? 'some' : 'every']((id) => card.topic_ids.includes(id)),
          )
          .sort((a, b) => compare(sortKey(a), sortKey(b)) || compare(a.created_at, b.created_at)),
      ),
    findById: async (userId, id) =>
      structuredClone(store.cards.find((c) => c.user_id === userId && c.id === id) ?? null),
    findByName: async (userId, name) =>
      structuredClone(
        store.cards.filter(
          (c) =>
            c.user_id === userId &&
            c.name !== null &&
            withoutSpaces(c.name) === withoutSpaces(name),
        ),
      ),
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
  }
}
