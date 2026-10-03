import { expect, test } from 'vite-plus/test'

import type { DataVersionRepository } from '../repository/data-version.repository.ts'
import { createDataVersionService } from './data-version.service.ts'

const fakeRepository = (): DataVersionRepository => {
  const versions = new Map<string, string>()
  return {
    get: async (userId) => versions.get(userId) ?? null,
    save: async (userId, version) => void versions.set(userId, version),
  }
}

test('bump gives a new version each time, and get returns the latest', async () => {
  const versions = createDataVersionService(fakeRepository())

  await expect(versions.get('user-1')).resolves.toBeNull()
  const first = await versions.bump('user-1')
  const second = await versions.bump('user-1')

  expect(second).not.toBe(first)
  await expect(versions.get('user-1')).resolves.toBe(second)
})
