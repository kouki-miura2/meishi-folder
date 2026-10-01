import { expect, test } from 'vite-plus/test'

import type { UserDao, UserRecord } from '../dao/user.interface.ts'
import { createUserRepository, type User } from './user.repository.ts'

const record: UserRecord = {
  id: 'user-1',
  name: '山田 太郎',
  name_kana: 'ヤマダ タロウ',
  terms_version: '2026-10-01',
  terms_agreed_at: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  affiliations: [{ company_id: 'c-1', department_id: 'd-1' }],
}

const user: User = {
  id: 'user-1',
  name: '山田 太郎',
  nameKana: 'ヤマダ タロウ',
  termsVersion: '2026-10-01',
  termsAgreedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  affiliations: [{ companyId: 'c-1', departmentId: 'd-1' }],
}

test('findById maps the storage record to the domain entity', async () => {
  const dao: UserDao = {
    findById: async () => record,
    save: async () => {},
    deleteAll: async () => {},
  }

  await expect(createUserRepository(dao).findById('user-1')).resolves.toEqual(user)
})

test('findById resolves null when the DAO finds nothing', async () => {
  const dao: UserDao = {
    findById: async () => null,
    save: async () => {},
    deleteAll: async () => {},
  }

  await expect(createUserRepository(dao).findById('missing')).resolves.toBeNull()
})

test('save maps the domain entity back to the storage record', async () => {
  const saved: UserRecord[] = []
  const dao: UserDao = {
    findById: async () => null,
    save: async (r) => void saved.push(r),
    deleteAll: async () => {},
  }

  await createUserRepository(dao).save(user)

  expect(saved).toEqual([record])
})

test('deleteAll hands the user id to the DAO', async () => {
  const deleted: string[] = []
  const dao: UserDao = {
    findById: async () => null,
    save: async () => {},
    deleteAll: async (id) => void deleted.push(id),
  }

  await createUserRepository(dao).deleteAll('user-1')

  expect(deleted).toEqual(['user-1'])
})
