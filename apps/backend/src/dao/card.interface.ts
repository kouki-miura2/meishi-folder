export type Visibility = 'private' | 'company' | 'department'

/** Raw storage shape: the `cards` row (list columns still JSON text) plus its join-table ids. */
export interface CardRecord {
  id: string
  user_id: string
  name: string | null
  name_kana: string | null
  name_romaji: string | null
  company_id: string | null
  titles: string
  job_types: string
  mobile: string | null
  emails: string
  other_contacts: string
  url: string | null
  offices: string
  met_on: string | null
  met_at: string | null
  met_occasion: string | null
  handle_name: string | null
  memo: string | null
  front_image_id: string | null
  back_image_id: string | null
  visibility: Visibility
  created_at: string
  updated_at: string
  department_ids: string[]
  topic_ids: string[]
}

export interface CardDao {
  /** Every card of the user, ordered by name_kana, falling back to handle_name, then name. */
  list: (userId: string) => Promise<CardRecord[]>
  findById: (userId: string, id: string) => Promise<CardRecord | null>
  /** Matches `name` ignoring whitespace (half- and full-width). */
  findByName: (userId: string, name: string) => Promise<CardRecord[]>
  count: (userId: string) => Promise<number>
  insert: (record: CardRecord) => Promise<void>
  update: (record: CardRecord) => Promise<void>
  delete: (userId: string, id: string) => Promise<void>
}
