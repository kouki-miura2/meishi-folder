export interface DepartmentRecord {
  id: string
  user_id: string
  company_id: string
  name: string
}

export interface DepartmentDao {
  /** Ordered by name. */
  listByUser: (userId: string) => Promise<DepartmentRecord[]>
  /** Ordered by name. */
  listByCompany: (userId: string, companyId: string) => Promise<DepartmentRecord[]>
  findById: (userId: string, id: string) => Promise<DepartmentRecord | null>
  findByName: (userId: string, companyId: string, name: string) => Promise<DepartmentRecord | null>
  insert: (record: DepartmentRecord) => Promise<void>
  rename: (userId: string, id: string, name: string) => Promise<void>
  delete: (userId: string, id: string) => Promise<void>
  /** Whether a card or a user affiliation refers to the department. */
  isReferenced: (userId: string, id: string) => Promise<boolean>
  /** Atomically re-points cards and user affiliations from `sourceIds` to `targetId`, then deletes the sources. */
  merge: (userId: string, targetId: string, sourceIds: string[]) => Promise<void>
}
