import { LIMITS } from 'utils'
import { expect, test } from 'vite-plus/test'

import { createCardService } from './card.service.ts'
import {
  fakeCardExtractorRepository,
  fakeCardImageRepository,
  fakeCardRepository,
  fakeCompanyRepository,
  fakeDepartmentRepository,
  fakeTopicRepository,
} from './fakes.ts'
import { createMasterResolver } from './master-resolver.ts'

const setup = () => {
  const cardRepository = fakeCardRepository()
  const cardImageRepository = fakeCardImageRepository(
    new Map([
      ['front', { body: new ArrayBuffer(1), contentType: 'image/jpeg' }],
      ['back', { body: new ArrayBuffer(2), contentType: 'image/jpeg' }],
      ['new-front', { body: new ArrayBuffer(3), contentType: 'image/jpeg' }],
    ]),
  )
  const companyRepository = fakeCompanyRepository()
  const departmentRepository = fakeDepartmentRepository()
  const topicRepository = fakeTopicRepository()
  const service = createCardService({
    cardRepository,
    cardImageRepository,
    cardExtractorRepository: fakeCardExtractorRepository({
      1: { name: '山田 太郎', companyName: 'Acme', titles: ['部長'] },
      2: { name: 'Taro Yamada', nameRomaji: 'Taro Yamada', titles: ['Manager'] },
    }),
    companyRepository,
    departmentRepository,
    topicRepository,
    masterResolver: createMasterResolver({
      companyRepository,
      departmentRepository,
      topicRepository,
    }),
  })
  return { service, cardRepository, cardImageRepository, companyRepository, topicRepository }
}

const registered = {
  name: '山田 太郎',
  companyName: 'Acme',
  departmentNames: ['営業部'],
  titles: ['部長'],
  metAt: '展示会',
  memo: 'デモを見せてもらった',
  projectNames: ['Apollo'],
  groupNames: ['Book club'],
  frontImageId: 'front',
  backImageId: 'back',
}

test('extract prefers the front and fills the gaps from the back', async () => {
  const { service } = setup()

  const card = await service.extract('user-1', { frontImageId: 'front', backImageId: 'back' })

  expect(card).toMatchObject({
    name: '山田 太郎',
    nameRomaji: 'Taro Yamada',
    companyName: 'Acme',
    titles: ['部長'],
  })
})

test('extract reports not_found for an unknown image', async () => {
  const { service } = setup()

  await expect(service.extract('user-1', { frontImageId: 'missing' })).rejects.toMatchObject({
    code: 'not_found',
  })
})

test('create resolves the masters by name, forces private visibility and returns names', async () => {
  const { service, companyRepository, topicRepository } = setup()

  const view = await service.create('user-1', { ...registered, visibility: 'company' })

  expect(view).toMatchObject({
    name: '山田 太郎',
    company: { name: 'Acme' },
    departments: [{ name: '営業部' }],
    projects: [{ name: 'Apollo' }],
    groups: [{ name: 'Book club' }],
    visibility: 'private',
  })
  expect(companyRepository.companies).toHaveLength(1)
  expect(topicRepository.topics).toHaveLength(2)
})

test.each([
  ['no name, kana or handle name', { companyName: 'Acme' }],
  ['departments without a company', { name: '山田', departmentNames: ['営業部'] }],
  ['an unknown image', { name: '山田', frontImageId: 'missing' }],
])('create rejects %s', async (_label, input) => {
  const { service } = setup()

  await expect(service.create('user-1', input)).rejects.toMatchObject({ code: 'invalid' })
})

test('create refuses a card past the limit, before resolving any master', async () => {
  const { service, companyRepository } = setup()
  for (let i = 0; i < LIMITS.cardsPerUser; i++) await service.create('user-1', { name: `${i}` })

  await expect(service.create('user-1', registered)).rejects.toMatchObject({ code: 'conflict' })
  expect(companyRepository.companies).toHaveLength(0)
})

test('update keeps omitted fields and clears fields sent as null', async () => {
  const { service } = setup()
  const { id } = await service.create('user-1', registered)

  const view = await service.update('user-1', id, { metAt: null, visibility: 'private' })

  expect(view).toMatchObject({
    name: '山田 太郎',
    company: { name: 'Acme' },
    departments: [{ name: '営業部' }],
    projects: [{ name: 'Apollo' }],
    metAt: null,
    visibility: 'private',
  })
})

test.each(['company', 'department'] as const)(
  'update rejects %s visibility: cards are never shared',
  async (visibility) => {
    const { service } = setup()
    const { id } = await service.create('user-1', registered)

    await expect(service.update('user-1', id, { visibility })).rejects.toMatchObject({
      code: 'invalid',
    })
    await expect(service.list('user-1')).resolves.toMatchObject([{ visibility: 'private' }])
  },
)

test('update with a new scan replaces printed items and photos but keeps scene and notes', async () => {
  const { service, cardImageRepository } = setup()
  const { id } = await service.create('user-1', registered)

  const view = await service.update('user-1', id, {
    name: '山田 太郎',
    companyName: 'Beta',
    titles: ['本部長'],
    frontImageId: 'new-front',
    backImageId: null,
  })

  expect(view).toMatchObject({
    company: { name: 'Beta' },
    departments: [{ name: '営業部' }],
    titles: ['本部長'],
    metAt: '展示会',
    memo: 'デモを見せてもらった',
    projects: [{ name: 'Apollo' }],
    groups: [{ name: 'Book club' }],
    frontImageId: 'new-front',
    backImageId: null,
  })
  expect([...cardImageRepository.images.keys()]).toEqual(['new-front'])
})

test('remove deletes the card and its photos', async () => {
  const { service, cardRepository, cardImageRepository } = setup()
  const { id } = await service.create('user-1', registered)

  await service.remove('user-1', id)

  expect(cardRepository.cards).toEqual([])
  expect([...cardImageRepository.images.keys()]).toEqual(['new-front'])
})

test('update and remove report not_found for an unknown card', async () => {
  const { service } = setup()

  await expect(service.update('user-1', 'missing', {})).rejects.toMatchObject({
    code: 'not_found',
  })
  await expect(service.remove('user-1', 'missing')).rejects.toMatchObject({ code: 'not_found' })
})

test('list returns every card in full, and candidates return summaries with master names', async () => {
  const { service } = setup()
  const created = await service.create('user-1', registered)
  const { id } = created
  const summary = {
    id,
    name: '山田 太郎',
    nameKana: null,
    handleName: null,
    companyName: 'Acme',
    departmentNames: ['営業部'],
    projects: [{ id: expect.any(String), name: 'Apollo' }],
    groups: [{ id: expect.any(String), name: 'Book club' }],
  }

  await expect(service.list('user-1')).resolves.toEqual([created])
  await expect(service.candidates('user-1', ' 山田 太郎 ')).resolves.toEqual([summary])
  await expect(service.candidates('user-1', ' ')).resolves.toEqual([])
})

test('exportCsv writes a header and one row per card, multi-values one per line', async () => {
  const { service } = setup()
  const { id, createdAt } = await service.create('user-1', {
    ...registered,
    titles: ['部長', 'CTO'],
    memo: 'say "hi"',
    offices: [
      { postalCode: '100-0001', address: '東京都', tel: '03-0000-0000' },
      { address: '大阪府' },
    ],
  })

  const [header, row, end] = (await service.exportCsv('user-1')).slice(1).split('\r\n')

  const cells = (line = '') =>
    [...line.matchAll(/"((?:[^"]|"")*)"/g)].map(([, value = '']) => value.replaceAll('""', '"'))
  const columns = cells(header)
  expect(columns).toEqual([
    'ID',
    '氏名',
    '氏名カナ',
    '氏名ローマ字',
    '会社・団体',
    '部署',
    '役職',
    '職種',
    '携帯',
    'メール',
    'その他連絡',
    'URL',
    ...['1', '2'].flatMap((n) =>
      ['郵便番号', '住所', '電話', 'FAX'].map((column) => `事業所${n}_${column}`),
    ),
    '取得日',
    '取得場所',
    '取得機会',
    '関連プロジェクト',
    '関連グループ',
    'ハンドルネーム',
    'メモ',
    '登録日時',
    '更新日時',
  ])
  const values = Object.fromEntries(columns.map((column, i) => [column, cells(row)[i]]))
  expect(values).toMatchObject({
    ID: id,
    氏名: '山田 太郎',
    氏名カナ: '',
    会社・団体: 'Acme',
    部署: '営業部',
    役職: '部長\nCTO',
    事業所1_郵便番号: '100-0001',
    事業所1_電話: '03-0000-0000',
    事業所2_住所: '大阪府',
    事業所2_電話: '',
    取得場所: '展示会',
    関連プロジェクト: 'Apollo',
    関連グループ: 'Book club',
    メモ: 'say "hi"',
    登録日時: createdAt,
  })
  expect(end).toBe('')
})

test('exportCsv without cards is the header alone, with one group of office columns', async () => {
  const { service } = setup()

  const csv = await service.exportCsv('user-1')

  expect(csv.startsWith('﻿"ID","氏名"')).toBe(true)
  expect(csv).toContain('"事業所1_FAX","取得日"')
  expect(csv.split('\r\n')).toHaveLength(2)
})
