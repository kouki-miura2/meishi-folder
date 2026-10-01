import type { UserDao, UserRecord } from '../dao/user.interface.ts'

export interface Affiliation {
  companyId: string
  departmentId: string | null
}

export interface User {
  id: string
  name: string
  nameKana: string | null
  affiliations: Affiliation[]
  /** The terms of service / privacy policy version agreed to, and when. */
  termsVersion: string | null
  termsAgreedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface UserRepository {
  findById: (id: string) => Promise<User | null>
  save: (user: User) => Promise<void>
  /** Deletes the user and every row they own (see `UserDao.deleteAll`). */
  deleteAll: (id: string) => Promise<void>
}

const toUser = (record: UserRecord): User => ({
  id: record.id,
  name: record.name,
  nameKana: record.name_kana,
  affiliations: record.affiliations.map((a) => ({
    companyId: a.company_id,
    departmentId: a.department_id,
  })),
  termsVersion: record.terms_version,
  termsAgreedAt: record.terms_agreed_at,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
})

export const createUserRepository = (dao: UserDao): UserRepository => ({
  findById: async (id) => {
    const record = await dao.findById(id)
    return record ? toUser(record) : null
  },
  save: (user) =>
    dao.save({
      id: user.id,
      name: user.name,
      name_kana: user.nameKana,
      terms_version: user.termsVersion,
      terms_agreed_at: user.termsAgreedAt,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      affiliations: user.affiliations.map((a) => ({
        company_id: a.companyId,
        department_id: a.departmentId,
      })),
    }),
  deleteAll: dao.deleteAll,
})
