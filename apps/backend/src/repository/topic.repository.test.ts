import { expect, test } from 'vite-plus/test'

import type { TopicDao, TopicRecord } from '../dao/topic.interface.ts'
import { createTopicRepository } from './topic.repository.ts'

const record: TopicRecord = { id: 't-1', user_id: 'user-1', kind: 'project', name: 'Apollo' }
const topic = { id: 't-1', kind: 'project', name: 'Apollo' }

test('list and findByName map the storage record to the domain entity', async () => {
  const dao: TopicDao = {
    listByUser: async () => [record],
    findByName: async () => record,
    insert: async () => {},
  }
  const repository = createTopicRepository(dao)

  await expect(repository.list('user-1')).resolves.toEqual([topic])
  await expect(repository.findByName('user-1', 'project', 'Apollo')).resolves.toEqual(topic)
})

test('create stores the owner alongside the topic', async () => {
  const inserted: TopicRecord[] = []
  const dao: TopicDao = {
    listByUser: async () => [],
    findByName: async () => null,
    insert: async (r) => void inserted.push(r),
  }

  await createTopicRepository(dao).create('user-1', { id: 't-1', kind: 'project', name: 'Apollo' })

  expect(inserted).toEqual([record])
})
