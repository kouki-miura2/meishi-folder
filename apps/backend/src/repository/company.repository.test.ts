import { expect, test } from 'vite-plus/test'

import type { CompanyDao, CompanyRecord } from '../dao/company.interface.ts'
import { createCompanyRepository } from './company.repository.ts'

const fakeDao = (overrides: Partial<CompanyDao> = {}): CompanyDao => ({
  listByUser: async () => [],
  findById: async () => null,
  findByName: async () => null,
  insert: async () => {},
  rename: async () => {},
  delete: async () => {},
  isReferenced: async () => false,
  merge: async () => {},
  ...overrides,
})

const record: CompanyRecord = { id: 'c-1', user_id: 'user-1', name: 'Acme' }

test('list, findById and findByName drop the owner column', async () => {
  const repository = createCompanyRepository(
    fakeDao({
      listByUser: async () => [record],
      findById: async () => record,
      findByName: async () => record,
    }),
  )

  await expect(repository.list('user-1')).resolves.toEqual([{ id: 'c-1', name: 'Acme' }])
  await expect(repository.findById('user-1', 'c-1')).resolves.toEqual({ id: 'c-1', name: 'Acme' })
  await expect(repository.findByName('user-1', 'Acme')).resolves.toEqual({
    id: 'c-1',
    name: 'Acme',
  })
})

test('create stores the owner alongside the company', async () => {
  const inserted: CompanyRecord[] = []
  const repository = createCompanyRepository(
    fakeDao({ insert: async (r) => void inserted.push(r) }),
  )

  await repository.create('user-1', { id: 'c-1', name: 'Acme' })

  expect(inserted).toEqual([record])
})
