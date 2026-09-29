import { expect, test, vi } from 'vite-plus/test'

import { createCardExtractorDao } from './card-extractor.workers-ai.ts'

test('extract runs the vision model on the image bytes and returns its text reply', async () => {
  const run = vi.fn(async () => ({ response: '{"name":"山田"}' }))
  const dao = createCardExtractorDao({ run } as unknown as Ai)

  const reply = await dao.extract(
    { body: new Uint8Array([1, 2]).buffer, content_type: 'image/jpeg' },
    'read the card',
  )

  expect(reply).toBe('{"name":"山田"}')
  expect(run).toHaveBeenCalledWith('@cf/meta/llama-3.2-11b-vision-instruct', {
    prompt: 'read the card',
    image: [1, 2],
    max_tokens: 1024,
    temperature: 0,
  })
})

test('extract returns an empty reply when the model gives none', async () => {
  const dao = createCardExtractorDao({ run: async () => ({}) } as unknown as Ai)

  await expect(
    dao.extract({ body: new ArrayBuffer(0), content_type: 'image/jpeg' }, 'prompt'),
  ).resolves.toBe('')
})
