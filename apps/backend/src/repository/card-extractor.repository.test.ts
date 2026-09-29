import { expect, test } from 'vite-plus/test'

import type { CardExtractorDao } from '../dao/card-extractor.interface.ts'
import {
  EXTRACTION_PROMPT,
  createCardExtractorRepository,
  toExtractedCard,
} from './card-extractor.repository.ts'

const empty = {
  name: null,
  nameKana: null,
  nameRomaji: null,
  companyName: null,
  departmentNames: [],
  titles: [],
  jobTypes: [],
  mobile: null,
  emails: [],
  otherContacts: [],
  url: null,
  offices: [],
}

test('extract sends the image with the extraction prompt and parses the reply', async () => {
  const calls: unknown[] = []
  const dao: CardExtractorDao = {
    extract: async (image, prompt) => {
      calls.push({ image, prompt })
      return '{"name":"山田 太郎","emails":["yamada@example.com"]}'
    },
  }
  const body = new ArrayBuffer(0)

  const card = await createCardExtractorRepository(dao).extract({ body, contentType: 'image/jpeg' })

  expect(calls).toEqual([
    { image: { body, content_type: 'image/jpeg' }, prompt: EXTRACTION_PROMPT },
  ])
  expect(card).toEqual({ ...empty, name: '山田 太郎', emails: ['yamada@example.com'] })
})

test('toExtractedCard finds the JSON inside prose and code fences', () => {
  const reply = 'Here is the result:\n```json\n{"companyName":" Acme ","titles":"部長"}\n```'

  expect(toExtractedCard(reply)).toEqual({ ...empty, companyName: 'Acme', titles: ['部長'] })
})

test('toExtractedCard drops blank values and empty offices', () => {
  const reply = JSON.stringify({
    name: '  ',
    emails: ['a@example.com', '', null],
    offices: [{ address: '東京都', tel: '03-0000-0000' }, { address: null }],
  })

  expect(toExtractedCard(reply)).toEqual({
    ...empty,
    emails: ['a@example.com'],
    offices: [{ postalCode: null, address: '東京都', tel: '03-0000-0000', fax: null }],
  })
})

test.each(['not json at all', '{"name": broken', '[1, 2]', ''])(
  'toExtractedCard falls back to an empty card for %j',
  (reply) => {
    expect(toExtractedCard(reply)).toEqual(empty)
  },
)
