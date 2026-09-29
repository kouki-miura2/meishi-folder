import type { DepartmentDao, DepartmentRecord } from '../dao/department.interface.ts'

export interface Department {
  id: string
  companyId: string
  name: string
}

export interface DepartmentListItem extends Department {
  cardCount: number
}

export interface DepartmentRepository {
  list: (userId: string) => Promise<Department[]>
  listByCompany: (userId: string, companyId: string) => Promise<DepartmentListItem[]>
  findById: (userId: string, id: string) => Promise<Department | null>
  findByName: (userId: string, companyId: string, name: string) => Promise<Department | null>
  create: (userId: string, department: Department) => Promise<void>
  rename: (userId: string, id: string, name: string) => Promise<void>
  delete: (userId: string, id: string) => Promise<void>
  isReferenced: (userId: string, id: string) => Promise<boolean>
  merge: (userId: string, targetId: string, sourceIds: string[]) => Promise<void>
}

const toDepartment = (record: DepartmentRecord): Department => ({
  id: record.id,
  companyId: record.company_id,
  name: record.name,
})

export const createDepartmentRepository = (dao: DepartmentDao): DepartmentRepository => ({
  list: async (userId) => (await dao.listByUser(userId)).map(toDepartment),
  listByCompany: async (userId, companyId) =>
    (await dao.listByCompany(userId, companyId)).map((record) => ({
      ...toDepartment(record),
      cardCount: record.card_count,
    })),
  findById: async (userId, id) => {
    const record = await dao.findById(userId, id)
    return record ? toDepartment(record) : null
  },
  findByName: async (userId, companyId, name) => {
    const record = await dao.findByName(userId, companyId, name)
    return record ? toDepartment(record) : null
  },
  create: (userId, department) =>
    dao.insert({
      id: department.id,
      user_id: userId,
      company_id: department.companyId,
      name: department.name,
    }),
  rename: dao.rename,
  delete: dao.delete,
  isReferenced: dao.isReferenced,
  merge: dao.merge,
})
