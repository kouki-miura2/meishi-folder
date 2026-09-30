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
  'update rejects %s visibility until mutual authentication exists',
  async (visibility) => {
    const { service } = setup()
    const { id } = await service.create('user-1', registered)

    await expect(service.update('user-1', id, { visibility })).rejects.toMatchObject({
      code: 'invalid',
    })
    await expect(service.get('user-1', id)).resolves.toMatchObject({ visibility: 'private' })
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

test('get, update and remove report not_found for an unknown card', async () => {
  const { service } = setup()

  await expect(service.get('user-1', 'missing')).rejects.toMatchObject({ code: 'not_found' })
  await expect(service.update('user-1', 'missing', {})).rejects.toMatchObject({
    code: 'not_found',
  })
  await expect(service.remove('user-1', 'missing')).rejects.toMatchObject({ code: 'not_found' })
})

test('list and candidates return summaries with master names', async () => {
  const { service } = setup()
  const { id } = await service.create('user-1', registered)
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

  await expect(service.list('user-1', {})).resolves.toEqual([summary])
  await expect(service.candidates('user-1', ' 山田 太郎 ')).resolves.toEqual([summary])
  await expect(service.candidates('user-1', ' ')).resolves.toEqual([])
})
