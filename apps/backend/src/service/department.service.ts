import type { CompanyRepository } from '../repository/company.repository.ts'
import type {
  Department,
  DepartmentListItem,
  DepartmentRepository,
} from '../repository/department.repository.ts'
import { ServiceError } from './errors.ts'
import { cleanText } from './text.ts'

export interface DepartmentService {
  /** With how many cards refer to each department. */
  list: (userId: string, companyId: string) => Promise<DepartmentListItem[]>
  create: (userId: string, companyId: string, name: string) => Promise<Department>
  rename: (userId: string, id: string, name: string) => Promise<Department>
  /** Refuses while a card or the user's own affiliation still refers to it: merge it instead. */
  remove: (userId: string, id: string) => Promise<void>
  /** Folds `sourceIds` into `targetId`; all of them must belong to the same company. */
  merge: (userId: string, targetId: string, sourceIds: string[]) => Promise<Department>
}

export interface DepartmentServiceDependencies {
  departmentRepository: DepartmentRepository
  companyRepository: CompanyRepository
}

export const createDepartmentService = ({
  departmentRepository: repository,
  companyRepository,
}: DepartmentServiceDependencies): DepartmentService => {
  const findOrThrow = async (userId: string, id: string) => {
    const department = await repository.findById(userId, id)
    if (!department) throw new ServiceError('not_found', `Department ${id} not found`)
    return department
  }
  const requireCompany = async (userId: string, companyId: string) => {
    if (!(await companyRepository.findById(userId, companyId))) {
      throw new ServiceError('not_found', `Company ${companyId} not found`)
    }
  }
  const requireName = (value: string) => {
    const name = cleanText(value)
    if (!name) throw new ServiceError('invalid', 'Department name is required')
    return name
  }
  const requireUnused = async (
    userId: string,
    companyId: string,
    name: string,
    exceptId?: string,
  ) => {
    const existing = await repository.findByName(userId, companyId, name)
    if (existing && existing.id !== exceptId) {
      throw new ServiceError('conflict', `Department "${name}" already exists`)
    }
  }

  return {
    list: async (userId, companyId) => {
      await requireCompany(userId, companyId)
      return repository.listByCompany(userId, companyId)
    },
    create: async (userId, companyId, value) => {
      const name = requireName(value)
      await requireCompany(userId, companyId)
      await requireUnused(userId, companyId, name)
      const department = { id: crypto.randomUUID(), companyId, name }
      await repository.create(userId, department)
      return department
    },
    rename: async (userId, id, value) => {
      const name = requireName(value)
      const department = await findOrThrow(userId, id)
      await requireUnused(userId, department.companyId, name, id)
      await repository.rename(userId, id, name)
      return { ...department, name }
    },
    remove: async (userId, id) => {
      await findOrThrow(userId, id)
      if (await repository.isReferenced(userId, id)) {
        throw new ServiceError('conflict', 'Department is still in use; merge it instead')
      }
      await repository.delete(userId, id)
    },
    merge: async (userId, targetId, rawSourceIds) => {
      const sourceIds = [...new Set(rawSourceIds)]
      if (sourceIds.length === 0 || sourceIds.includes(targetId)) {
        throw new ServiceError('invalid', 'Pick at least one department other than the target')
      }
      const target = await findOrThrow(userId, targetId)
      for (const id of sourceIds) {
        const source = await findOrThrow(userId, id)
        if (source.companyId !== target.companyId) {
          throw new ServiceError('invalid', 'Only departments of the same company can be merged')
        }
      }
      await repository.merge(userId, targetId, sourceIds)
      return target
    },
  }
}
