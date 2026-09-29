import { expect, test } from 'vite-plus/test'

import { createCardExtractorDao } from './card-extractor.memory.ts'

const image = { body: new ArrayBuffer(0), content_type: 'image/jpeg' }

test('extract replies with the configured text', async () => {
  const dao = createCardExtractorDao('{"name":"山田"}')

  await expect(dao.extract(image, 'prompt')).resolves.toBe('{"name":"山田"}')
})

test('extract replies with an empty JSON object by default', async () => {
  const dao = createCardExtractorDao()

  await expect(dao.extract(image, 'prompt')).resolves.toBe('{}')
})
