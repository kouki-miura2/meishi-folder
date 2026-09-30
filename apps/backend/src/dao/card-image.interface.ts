export interface CardImageObject {
  body: ArrayBuffer
  content_type: string
}

/** A stored photo as listed: whose it is, and when it was uploaded (ISO 8601). */
export interface CardImageEntry {
  user_id: string
  id: string
  uploaded_at: string
}

/** Stores card photos keyed by owner, so one user can never read another user's image. */
export interface CardImageDao {
  put: (userId: string, id: string, object: CardImageObject) => Promise<void>
  get: (userId: string, id: string) => Promise<CardImageObject | null>
  exists: (userId: string, id: string) => Promise<boolean>
  delete: (userId: string, ids: string[]) => Promise<void>
  /** Withdrawal: deletes every photo of the user. */
  deleteAll: (userId: string) => Promise<void>
  /** Every stored photo of every user: only for sweeping out photos no card uses. */
  list: () => Promise<CardImageEntry[]>
}
