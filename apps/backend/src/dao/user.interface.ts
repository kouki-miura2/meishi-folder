export interface UserAffiliationRecord {
  company_id: string
  department_id: string | null
}

/** Raw storage shape: the `users` row plus its `user_affiliations` rows. */
export interface UserRecord {
  id: string
  name: string
  name_kana: string | null
  created_at: string
  updated_at: string
  affiliations: UserAffiliationRecord[]
}

export interface UserDao {
  findById: (id: string) => Promise<UserRecord | null>
  /** Inserts or replaces the user, affiliations included. */
  save: (record: UserRecord) => Promise<void>
}
