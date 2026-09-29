import { expect, test } from 'vite-plus/test'

import { fakeTopicRepository } from './fakes.ts'
import { createTopicService } from './topic.service.ts'

const service = createTopicService(
  fakeTopicRepository([
    { id: 't-1', kind: 'project', name: 'Apollo' },
    { id: 't-2', kind: 'group', name: 'Book club' },
  ]),
)

test('list returns every topic, or only one kind when asked', async () => {
  await expect(service.list('user-1')).resolves.toHaveLength(2)
  await expect(service.list('user-1', 'group')).resolves.toEqual([
    { id: 't-2', kind: 'group', name: 'Book club' },
  ])
})
