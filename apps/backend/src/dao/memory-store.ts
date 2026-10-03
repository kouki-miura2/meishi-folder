import type { CardImageObject } from './card-image.interface.ts'
import type { CardRecord } from './card.interface.ts'
import type { CompanyRecord } from './company.interface.ts'
import type { DepartmentRecord } from './department.interface.ts'
import type { TopicRecord } from './topic.interface.ts'
import type { UserRecord } from './user.interface.ts'

/**
 * Tables shared by the in-memory DAOs. Merges and reference checks span several tables, so the
 * DAOs read and write one store the way the datastore-backed DAOs share one database.
 */
export interface MemoryStore {
  users: UserRecord[]
  companies: CompanyRecord[]
  departments: DepartmentRecord[]
  topics: TopicRecord[]
  cards: CardRecord[]
  /** Keyed by `${userId}/${imageId}`. */
  images: Map<string, { object: CardImageObject; uploaded_at: string }>
  /** Keyed by user id. */
  dataVersions: Map<string, string>
}

export const createMemoryStore = (): MemoryStore => ({
  users: [],
  companies: [],
  departments: [],
  topics: [],
  cards: [],
  images: new Map(),
  dataVersions: new Map(),
})

export const byName = (a: { name: string }, b: { name: string }) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0
