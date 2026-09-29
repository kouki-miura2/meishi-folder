import type { TopicDao, TopicKind, TopicRecord } from '../dao/topic.interface.ts'

export type { TopicKind }

export interface Topic {
  id: string
  kind: TopicKind
  name: string
}

export interface TopicRepository {
  list: (userId: string) => Promise<Topic[]>
  findByName: (userId: string, kind: TopicKind, name: string) => Promise<Topic | null>
  create: (userId: string, topic: Topic) => Promise<void>
}

const toTopic = (record: TopicRecord): Topic => ({
  id: record.id,
  kind: record.kind,
  name: record.name,
})

export const createTopicRepository = (dao: TopicDao): TopicRepository => ({
  list: async (userId) => (await dao.listByUser(userId)).map(toTopic),
  findByName: async (userId, kind, name) => {
    const record = await dao.findByName(userId, kind, name)
    return record ? toTopic(record) : null
  },
  create: (userId, topic) =>
    dao.insert({ id: topic.id, user_id: userId, kind: topic.kind, name: topic.name }),
})
