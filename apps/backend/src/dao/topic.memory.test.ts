import { expect, test } from 'vite-plus/test'

import { createMemoryStore } from './memory-store.ts'
import { createTopicDao } from './topic.memory.ts'

test('insert, then listByUser and findByName see the topic only for its owner and kind', async () => {
  const dao = createTopicDao(createMemoryStore())

  await dao.insert({ id: 't-2', user_id: 'user-1', kind: 'project', name: 'beta' })
  await dao.insert({ id: 't-1', user_id: 'user-1', kind: 'group', name: 'alpha' })
  await dao.insert({ id: 't-3', user_id: 'user-2', kind: 'project', name: 'beta' })

  await expect(dao.listByUser('user-1')).resolves.toEqual([
    { id: 't-1', user_id: 'user-1', kind: 'group', name: 'alpha' },
    { id: 't-2', user_id: 'user-1', kind: 'project', name: 'beta' },
  ])
  await expect(dao.findByName('user-1', 'project', 'beta')).resolves.toMatchObject({ id: 't-2' })
  await expect(dao.findByName('user-1', 'group', 'beta')).resolves.toBeNull()
})
