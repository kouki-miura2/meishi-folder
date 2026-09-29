import type { Company, CompanyRepository } from '../repository/company.repository.ts'
import type { Department, DepartmentRepository } from '../repository/department.repository.ts'
import type { Topic, TopicKind, TopicRepository } from '../repository/topic.repository.ts'
import { cleanTexts } from './text.ts'

/**
 * Find-or-create for the per-user masters: a name that matches an existing master (exact match
 * after trimming) refers to it, any other name creates a new one. Spelling variants end up as
 * separate masters on purpose; the user merges them later.
 */
export interface MasterResolver {
  company: (userId: string, name: string) => Promise<Company>
  departments: (
    userId: string,
    companyId: string,
    names: readonly string[],
  ) => Promise<Department[]>
  topics: (userId: string, kind: TopicKind, names: readonly string[]) => Promise<Topic[]>
}

export interface MasterResolverDependencies {
  companyRepository: CompanyRepository
  departmentRepository: DepartmentRepository
  topicRepository: TopicRepository
}

export const createMasterResolver = ({
  companyRepository,
  departmentRepository,
  topicRepository,
}: MasterResolverDependencies): MasterResolver => ({
  company: async (userId, rawName) => {
    const name = rawName.trim()
    const existing = await companyRepository.findByName(userId, name)
    if (existing) return existing
    const company = { id: crypto.randomUUID(), name }
    await companyRepository.create(userId, company)
    return company
  },
  departments: async (userId, companyId, names) => {
    const departments: Department[] = []
    for (const name of cleanTexts(names)) {
      const existing = await departmentRepository.findByName(userId, companyId, name)
      const department = existing ?? { id: crypto.randomUUID(), companyId, name }
      if (!existing) await departmentRepository.create(userId, department)
      departments.push(department)
    }
    return departments
  },
  topics: async (userId, kind, names) => {
    const topics: Topic[] = []
    for (const name of cleanTexts(names)) {
      const existing = await topicRepository.findByName(userId, kind, name)
      const topic = existing ?? { id: crypto.randomUUID(), kind, name }
      if (!existing) await topicRepository.create(userId, topic)
      topics.push(topic)
    }
    return topics
  },
})
