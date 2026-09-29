export type TopicKind = 'project' | 'group'

export interface TopicRecord {
  id: string
  user_id: string
  kind: TopicKind
  name: string
}

export interface TopicDao {
  /** Ordered by name. */
  listByUser: (userId: string) => Promise<TopicRecord[]>
  findByName: (userId: string, kind: TopicKind, name: string) => Promise<TopicRecord | null>
  insert: (record: TopicRecord) => Promise<void>
}
