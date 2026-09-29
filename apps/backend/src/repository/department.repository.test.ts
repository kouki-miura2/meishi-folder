import { expect, test } from 'vite-plus/test'

import type { DepartmentDao, DepartmentRecord } from '../dao/department.interface.ts'
import { createDepartmentRepository } from './department.repository.ts'

const fakeDao = (overrides: Partial<DepartmentDao> = {}): DepartmentDao => ({
  listByUser: async () => [],
  listByCompany: async () => [],
  findById: async () => null,
  findByName: async () => null,
  insert: async () => {},
  rename: async () => {},
  delete: async () => {},
  isReferenced: async () => false,
  merge: async () => {},
  ...overrides,
})

const record: DepartmentRecord = { id: 'd-1', user_id: 'user-1', company_id: 'c-1', name: '営業部' }
const department = { id: 'd-1', companyId: 'c-1', name: '営業部' }

test('reads map the storage record to the domain entity', async () => {
  const repository = createDepartmentRepository(
    fakeDao({
      listByUser: async () => [record],
      listByCompany: async () => [{ ...record, card_count: 2 }],
      findById: async () => record,
      findByName: async () => record,
    }),
  )

  await expect(repository.list('user-1')).resolves.toEqual([department])
  await expect(repository.listByCompany('user-1', 'c-1')).resolves.toEqual([
    { ...department, cardCount: 2 },
  ])
  await expect(repository.findById('user-1', 'd-1')).resolves.toEqual(department)
  await expect(repository.findByName('user-1', 'c-1', '営業部')).resolves.toEqual(department)
})

test('create maps the domain entity to the storage record', async () => {
  const inserted: DepartmentRecord[] = []
  const repository = createDepartmentRepository(
    fakeDao({ insert: async (r) => void inserted.push(r) }),
  )

  await repository.create('user-1', department)

  expect(inserted).toEqual([record])
})
