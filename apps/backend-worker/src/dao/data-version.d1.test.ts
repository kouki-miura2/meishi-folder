import { afterAll, beforeAll, expect, test } from 'vite-plus/test'

import { createDataVersionDao } from './data-version.d1.ts'
import { createTestEnv } from './test-env.ts'

let testEnv: Awaited<ReturnType<typeof createTestEnv>>
beforeAll(async () => {
  testEnv = await createTestEnv()
})
afterAll(() => testEnv.dispose())

test('get is null until save, then returns the latest version for that user only', async () => {
  const dao = createDataVersionDao(testEnv.env.DB)

  await expect(dao.get('user-1')).resolves.toBeNull()
  await dao.save('user-1', 'v1')
  await dao.save('user-1', 'v2')
  await dao.save('user-2', 'other')

  await expect(dao.get('user-1')).resolves.toBe('v2')
})
