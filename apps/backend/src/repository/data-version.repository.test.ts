import { expect, test } from 'vite-plus/test'

import type { DataVersionDao } from '../dao/data-version.interface.ts'
import { createDataVersionRepository } from './data-version.repository.ts'

test('get and save pass through to the DAO', async () => {
  const saved: [string, string][] = []
  const dao: DataVersionDao = {
    get: async () => 'v1',
    save: async (userId, version) => void saved.push([userId, version]),
  }
  const repository = createDataVersionRepository(dao)

  await expect(repository.get('user-1')).resolves.toBe('v1')
  await repository.save('user-1', 'v2')

  expect(saved).toEqual([['user-1', 'v2']])
})
