import { expect, test } from 'vite-plus/test'

import { createDataVersionDao } from './data-version.memory.ts'
import { createMemoryStore } from './memory-store.ts'

test('get is null until save, then returns the latest version for that user only', async () => {
  const dao = createDataVersionDao(createMemoryStore())

  await expect(dao.get('user-1')).resolves.toBeNull()
  await dao.save('user-1', 'v1')
  await dao.save('user-1', 'v2')
  await dao.save('user-2', 'other')

  await expect(dao.get('user-1')).resolves.toBe('v2')
})
