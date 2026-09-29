import { afterAll, beforeAll, expect, test } from 'vite-plus/test'

import { createTestEnv } from './test-env.ts'
import { createTopicDao } from './topic.d1.ts'

let testEnv: Awaited<ReturnType<typeof createTestEnv>>
beforeAll(async () => {
  testEnv = await createTestEnv()
})
afterAll(() => testEnv.dispose())

test('insert, then listByUser and findByName see the topic only for its owner and kind', async () => {
  const dao = createTopicDao(testEnv.env.DB)

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
