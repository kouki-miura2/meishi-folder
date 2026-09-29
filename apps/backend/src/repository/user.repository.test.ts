import { expect, test } from 'vite-plus/test'

import type { UserDao, UserRecord } from '../dao/user.interface.ts'
import { createUserRepository, type User } from './user.repository.ts'

const record: UserRecord = {
  id: 'user-1',
  name: '山田 太郎',
  name_kana: 'ヤマダ タロウ',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  affiliations: [{ company_id: 'c-1', department_id: 'd-1' }],
}

const user: User = {
  id: 'user-1',
  name: '山田 太郎',
  nameKana: 'ヤマダ タロウ',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  affiliations: [{ companyId: 'c-1', departmentId: 'd-1' }],
}

test('findById maps the storage record to the domain entity', async () => {
  const dao: UserDao = { findById: async () => record, save: async () => {} }

  await expect(createUserRepository(dao).findById('user-1')).resolves.toEqual(user)
})

test('findById resolves null when the DAO finds nothing', async () => {
  const dao: UserDao = { findById: async () => null, save: async () => {} }

  await expect(createUserRepository(dao).findById('missing')).resolves.toBeNull()
})

test('save maps the domain entity back to the storage record', async () => {
  const saved: UserRecord[] = []
  const dao: UserDao = { findById: async () => null, save: async (r) => void saved.push(r) }

  await createUserRepository(dao).save(user)

  expect(saved).toEqual([record])
})
