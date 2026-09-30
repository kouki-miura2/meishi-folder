import { expect, test } from 'vite-plus/test'

import { createCardExtractorDao } from './card-extractor.workers-ai.ts'

const image = { body: new Uint8Array([1, 2, 3]).buffer, content_type: 'image/jpeg' }

const aiReplying = (response: unknown) => ({ run: async () => ({ response }) }) as unknown as Ai

test('passes a text reply through', async () => {
  const dao = createCardExtractorDao(aiReplying('{"name":"山田"}'))

  expect(await dao.extract(image, 'prompt')).toBe('{"name":"山田"}')
})

test('turns a reply Workers AI already parsed as JSON back into text', async () => {
  const dao = createCardExtractorDao(aiReplying({ name: '山田', emails: [] }))

  expect(JSON.parse(await dao.extract(image, 'prompt'))).toEqual({ name: '山田', emails: [] })
})

test('an empty reply is empty text', async () => {
  expect(await createCardExtractorDao(aiReplying(undefined)).extract(image, 'prompt')).toBe('')
})
