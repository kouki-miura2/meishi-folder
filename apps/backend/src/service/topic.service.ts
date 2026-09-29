import type { Topic, TopicKind, TopicRepository } from '../repository/topic.repository.ts'

export interface TopicService {
  list: (userId: string, kind?: TopicKind) => Promise<Topic[]>
}

export const createTopicService = (repository: TopicRepository): TopicService => ({
  list: async (userId, kind) =>
    (await repository.list(userId)).filter((topic) => !kind || topic.kind === kind),
})
