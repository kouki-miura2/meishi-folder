export interface CompanyRecord {
  id: string
  user_id: string
  name: string
}

/** A listed company with how many cards and departments refer to it. */
export interface CompanyListRecord extends CompanyRecord {
  card_count: number
  department_count: number
}

export interface CompanyDao {
  /** Ordered by name. */
  listByUser: (userId: string) => Promise<CompanyListRecord[]>
  findById: (userId: string, id: string) => Promise<CompanyRecord | null>
  findByName: (userId: string, name: string) => Promise<CompanyRecord | null>
  insert: (record: CompanyRecord) => Promise<void>
  rename: (userId: string, id: string, name: string) => Promise<void>
  /** Deletes the company together with its departments. */
  delete: (userId: string, id: string) => Promise<void>
  /** Whether a card or a user affiliation refers to the company. */
  isReferenced: (userId: string, id: string) => Promise<boolean>
  /**
   * Atomically re-points everything that refers to `sourceIds` (cards, user affiliations,
   * departments) to `targetId`, then deletes the sources. A moved department whose name already
   * exists under the target is merged into that department.
   */
  merge: (userId: string, targetId: string, sourceIds: string[]) => Promise<void>
}
