import { expect, test } from 'vite-plus/test'

import { ServiceError } from './errors.ts'
import {
  fakeCardImageRepository,
  fakeCompanyRepository,
  fakeDepartmentRepository,
  fakeTopicRepository,
  fakeUserRepository,
} from './fakes.ts'
import { createMasterResolver } from './master-resolver.ts'
import { createUserService } from './user.service.ts'

const setup = () => {
  const userRepository = fakeUserRepository()
  const companyRepository = fakeCompanyRepository([{ id: 'c-1', name: 'Acme' }])
  const departmentRepository = fakeDepartmentRepository()
  const cardImageRepository = fakeCardImageRepository(
    new Map([['img-1', { body: new ArrayBuffer(1), contentType: 'image/jpeg' }]]),
  )
  const service = createUserService({
    userRepository,
    companyRepository,
    departmentRepository,
    cardImageRepository,
    masterResolver: createMasterResolver({
      companyRepository,
      departmentRepository,
      topicRepository: fakeTopicRepository(),
    }),
  })
  return { service, userRepository, companyRepository, departmentRepository, cardImageRepository }
}

test('getMe reports not_found until a profile is saved', async () => {
  const { service } = setup()

  await expect(service.getMe('user-1')).rejects.toMatchObject({ code: 'not_found' })
})

test('saveMe finds or creates the affiliated masters and returns the profile with names', async () => {
  const { service, companyRepository } = setup()

  const view = await service.saveMe('user-1', {
    name: ' 山田 太郎 ',
    nameKana: '',
    affiliations: [
      { companyName: 'Acme', departmentName: '営業部' },
      { companyName: 'Beta', departmentName: null },
    ],
  })

  expect(view).toMatchObject({
    name: '山田 太郎',
    nameKana: null,
    affiliations: [
      { company: { id: 'c-1', name: 'Acme' }, department: { name: '営業部' } },
      { company: { name: 'Beta' }, department: null },
    ],
  })
  expect(companyRepository.companies).toHaveLength(2)
  await expect(service.getMe('user-1')).resolves.toEqual(view)
})

test('saveMe drops duplicate affiliations and keeps createdAt on update', async () => {
  const { service, userRepository } = setup()
  await service.saveMe('user-1', { name: '山田', affiliations: [] })
  const createdAt = userRepository.users[0]?.createdAt

  const view = await service.saveMe('user-1', {
    name: '山田',
    affiliations: [{ companyName: 'Acme' }, { companyName: ' Acme ' }],
  })

  expect(view.affiliations).toHaveLength(1)
  expect(userRepository.users).toHaveLength(1)
  expect(userRepository.users[0]?.createdAt).toBe(createdAt)
})

test.each([
  ['a blank name', { name: ' ', affiliations: [] }],
  ['a blank company name', { name: '山田', affiliations: [{ companyName: ' ' }] }],
])('saveMe rejects %s', async (_label, input) => {
  const { service } = setup()

  const result = service.saveMe('user-1', input)

  await expect(result).rejects.toBeInstanceOf(ServiceError)
  await expect(result).rejects.toMatchObject({ code: 'invalid' })
})

test('deleteMe deletes the profile and every photo, leaving the user to start over', async () => {
  const { service, cardImageRepository } = setup()
  await service.saveMe('user-1', { name: '山田 太郎', affiliations: [] })

  await service.deleteMe('user-1')

  await expect(service.getMe('user-1')).rejects.toMatchObject({ code: 'not_found' })
  expect(cardImageRepository.images.size).toBe(0)
})

test('deleteMe succeeds for a user who never saved a profile', async () => {
  const { service } = setup()

  await expect(service.deleteMe('user-1')).resolves.toBeUndefined()
})
