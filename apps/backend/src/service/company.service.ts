import type { Company, CompanyRepository } from '../repository/company.repository.ts'
import { ServiceError } from './errors.ts'
import { cleanText } from './text.ts'

export interface CompanyService {
  list: (userId: string) => Promise<Company[]>
  create: (userId: string, name: string) => Promise<Company>
  rename: (userId: string, id: string, name: string) => Promise<Company>
  /** Refuses while a card or the user's own affiliation still refers to it: merge it instead. */
  remove: (userId: string, id: string) => Promise<void>
  /** Folds `sourceIds` into `targetId` (spelling variants of the same company). */
  merge: (userId: string, targetId: string, sourceIds: string[]) => Promise<Company>
}

export const createCompanyService = (repository: CompanyRepository): CompanyService => {
  const findOrThrow = async (userId: string, id: string) => {
    const company = await repository.findById(userId, id)
    if (!company) throw new ServiceError('not_found', `Company ${id} not found`)
    return company
  }
  const requireName = (value: string) => {
    const name = cleanText(value)
    if (!name) throw new ServiceError('invalid', 'Company name is required')
    return name
  }
  const requireUnused = async (userId: string, name: string, exceptId?: string) => {
    const existing = await repository.findByName(userId, name)
    if (existing && existing.id !== exceptId) {
      throw new ServiceError('conflict', `Company "${name}" already exists`)
    }
  }

  return {
    list: (userId) => repository.list(userId),
    create: async (userId, value) => {
      const name = requireName(value)
      await requireUnused(userId, name)
      const company = { id: crypto.randomUUID(), name }
      await repository.create(userId, company)
      return company
    },
    rename: async (userId, id, value) => {
      const name = requireName(value)
      await findOrThrow(userId, id)
      await requireUnused(userId, name, id)
      await repository.rename(userId, id, name)
      return { id, name }
    },
    remove: async (userId, id) => {
      await findOrThrow(userId, id)
      if (await repository.isReferenced(userId, id)) {
        throw new ServiceError('conflict', 'Company is still in use; merge it instead')
      }
      await repository.delete(userId, id)
    },
    merge: async (userId, targetId, rawSourceIds) => {
      const sourceIds = [...new Set(rawSourceIds)]
      if (sourceIds.length === 0 || sourceIds.includes(targetId)) {
        throw new ServiceError('invalid', 'Pick at least one company other than the target')
      }
      const target = await findOrThrow(userId, targetId)
      for (const id of sourceIds) await findOrThrow(userId, id)
      await repository.merge(userId, targetId, sourceIds)
      return target
    },
  }
}
