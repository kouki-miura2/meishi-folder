export interface CompanyRecord {
  id: string
  user_id: string
  name: string
}

export interface CompanyDao {
  /** Ordered by name. */
  listByUser: (userId: string) => Promise<CompanyRecord[]>
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
