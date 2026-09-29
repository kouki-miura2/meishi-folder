import type { CompanyDao, CompanyRecord } from '../dao/company.interface.ts'

export interface Company {
  id: string
  name: string
}

export interface CompanyRepository {
  list: (userId: string) => Promise<Company[]>
  findById: (userId: string, id: string) => Promise<Company | null>
  findByName: (userId: string, name: string) => Promise<Company | null>
  create: (userId: string, company: Company) => Promise<void>
  rename: (userId: string, id: string, name: string) => Promise<void>
  delete: (userId: string, id: string) => Promise<void>
  isReferenced: (userId: string, id: string) => Promise<boolean>
  merge: (userId: string, targetId: string, sourceIds: string[]) => Promise<void>
}

const toCompany = (record: CompanyRecord): Company => ({ id: record.id, name: record.name })

export const createCompanyRepository = (dao: CompanyDao): CompanyRepository => ({
  list: async (userId) => (await dao.listByUser(userId)).map(toCompany),
  findById: async (userId, id) => {
    const record = await dao.findById(userId, id)
    return record ? toCompany(record) : null
  },
  findByName: async (userId, name) => {
    const record = await dao.findByName(userId, name)
    return record ? toCompany(record) : null
  },
  create: (userId, company) => dao.insert({ id: company.id, user_id: userId, name: company.name }),
  rename: dao.rename,
  delete: dao.delete,
  isReferenced: dao.isReferenced,
  merge: dao.merge,
})
