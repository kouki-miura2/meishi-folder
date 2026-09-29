import { expect, test } from 'vite-plus/test'

import { createDepartmentService } from './department.service.ts'
import { fakeCompanyRepository, fakeDepartmentRepository } from './fakes.ts'

const setup = () => {
  const departmentRepository = fakeDepartmentRepository([
    { id: 'd-1', companyId: 'c-1', name: '営業部' },
    { id: 'd-2', companyId: 'c-1', name: '営業' },
    { id: 'd-3', companyId: 'c-2', name: '営業部' },
  ])
  const service = createDepartmentService({
    departmentRepository,
    companyRepository: fakeCompanyRepository([
      { id: 'c-1', name: 'Acme' },
      { id: 'c-2', name: 'Beta' },
    ]),
  })
  return { service, departmentRepository }
}

test('list returns the departments of an existing company', async () => {
  const { service } = setup()

  await expect(service.list('user-1', 'c-1')).resolves.toHaveLength(2)
  await expect(service.list('user-1', 'missing')).rejects.toMatchObject({ code: 'not_found' })
})

test('create checks the company and duplicate names within it', async () => {
  const { service } = setup()

  await expect(service.create('user-1', 'c-2', '営業')).resolves.toMatchObject({
    companyId: 'c-2',
    name: '営業',
  })
  await expect(service.create('user-1', 'c-1', '営業部')).rejects.toMatchObject({
    code: 'conflict',
  })
  await expect(service.create('user-1', 'missing', '総務')).rejects.toMatchObject({
    code: 'not_found',
  })
  await expect(service.create('user-1', 'c-1', ' ')).rejects.toMatchObject({ code: 'invalid' })
})

test('rename checks duplicates within the same company only', async () => {
  const { service } = setup()

  await expect(service.rename('user-1', 'd-3', '営業')).resolves.toMatchObject({ name: '営業' })
  await expect(service.rename('user-1', 'd-2', '営業部')).rejects.toMatchObject({
    code: 'conflict',
  })
})

test('remove refuses a department still in use', async () => {
  const { service, departmentRepository } = setup()
  departmentRepository.referenced.add('d-1')

  await expect(service.remove('user-1', 'd-1')).rejects.toMatchObject({ code: 'conflict' })
  await service.remove('user-1', 'd-2')

  expect(departmentRepository.departments.map((d) => d.id)).toEqual(['d-1', 'd-3'])
})

test('merge only folds departments of the same company', async () => {
  const { service, departmentRepository } = setup()

  await expect(service.merge('user-1', 'd-1', ['d-3'])).rejects.toMatchObject({ code: 'invalid' })
  await service.merge('user-1', 'd-1', ['d-2'])

  expect(departmentRepository.merges).toEqual([{ targetId: 'd-1', sourceIds: ['d-2'] }])
})
