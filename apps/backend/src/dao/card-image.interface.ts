export interface CardImageObject {
  body: ArrayBuffer
  content_type: string
}

/** Stores card photos keyed by owner, so one user can never read another user's image. */
export interface CardImageDao {
  put: (userId: string, id: string, object: CardImageObject) => Promise<void>
  get: (userId: string, id: string) => Promise<CardImageObject | null>
  exists: (userId: string, id: string) => Promise<boolean>
  delete: (userId: string, ids: string[]) => Promise<void>
}
