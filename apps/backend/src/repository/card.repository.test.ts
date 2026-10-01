import { expect, test } from 'vite-plus/test'

import type { CardDao, CardRecord } from '../dao/card.interface.ts'
import { cardRecord } from '../dao/fixtures.ts'
import { createCardRepository } from './card.repository.ts'

const record = cardRecord({
  name: '山田 太郎',
  company_id: 'c-1',
  department_ids: ['d-1'],
  titles: '["部長"]',
  emails: '["yamada@example.com"]',
  offices: '[{"postalCode":"100-0001","address":"東京都","tel":null,"fax":null}]',
  topic_ids: ['t-1'],
})

const fakeDao = (overrides: Partial<CardDao> = {}): CardDao => ({
  list: async () => [record],
  findById: async () => record,
  findByName: async () => [record],
  count: async () => 1,
  insert: async () => {},
  update: async () => {},
  delete: async () => {},
  ...overrides,
})

test('findById parses the JSON list columns into the domain entity', async () => {
  const card = await createCardRepository(fakeDao()).findById('user-1', 'card-1')

  expect(card).toMatchObject({
    name: '山田 太郎',
    companyId: 'c-1',
    departmentIds: ['d-1'],
    titles: ['部長'],
    jobTypes: [],
    emails: ['yamada@example.com'],
    offices: [{ postalCode: '100-0001', address: '東京都', tel: null, fax: null }],
    topicIds: ['t-1'],
    visibility: 'private',
  })
})

test('list and findByName map every record', async () => {
  const repository = createCardRepository(fakeDao())

  await expect(repository.list('user-1', {})).resolves.toHaveLength(1)
  await expect(repository.findByName('user-1', '山田 太郎')).resolves.toHaveLength(1)
})

test('create and update serialize the entity back into the same record', async () => {
  const written: CardRecord[] = []
  const repository = createCardRepository(
    fakeDao({
      insert: async (r) => void written.push(r),
      update: async (r) => void written.push(r),
    }),
  )
  const card = await repository.findById('user-1', 'card-1')
  if (!card) throw new Error('fixture missing')

  await repository.create('user-1', card)
  await repository.update('user-1', card)

  expect(written).toEqual([record, record])
})
