export interface DataVersionDao {
  /** The user's current data version, or null before their first change. */
  get: (userId: string) => Promise<string | null>
  /** Inserts or replaces the user's data version. */
  save: (userId: string, version: string) => Promise<void>
}
