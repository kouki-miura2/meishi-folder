import type { CompanyRepository } from '../repository/company.repository.ts'
import type { DepartmentRepository } from '../repository/department.repository.ts'
import type { Affiliation, User, UserRepository } from '../repository/user.repository.ts'
import { ServiceError } from './errors.ts'
import type { MasterResolver } from './master-resolver.ts'
import { cleanText } from './text.ts'

export interface AffiliationInput {
  companyName: string
  departmentName?: string | null
}

export interface UserInput {
  name: string
  nameKana?: string | null
  affiliations: AffiliationInput[]
}

export interface MasterRef {
  id: string
  name: string
}

export interface UserView {
  name: string
  nameKana: string | null
  affiliations: { company: MasterRef; department: MasterRef | null }[]
}

export interface UserService {
  /** The signed-in user's profile; not found until the welcome screen has saved one. */
  getMe: (userId: string) => Promise<UserView>
  saveMe: (userId: string, input: UserInput) => Promise<UserView>
}

export interface UserServiceDependencies {
  userRepository: UserRepository
  companyRepository: CompanyRepository
  departmentRepository: DepartmentRepository
  masterResolver: MasterResolver
}

export const createUserService = ({
  userRepository,
  companyRepository,
  departmentRepository,
  masterResolver,
}: UserServiceDependencies): UserService => {
  const toView = async (user: User): Promise<UserView> => {
    const [companies, departments] = await Promise.all([
      companyRepository.list(user.id),
      departmentRepository.list(user.id),
    ])
    const ref = (masters: MasterRef[], id: string | null) => {
      const master = masters.find((m) => m.id === id)
      return master ? { id: master.id, name: master.name } : null
    }
    return {
      name: user.name,
      nameKana: user.nameKana,
      affiliations: user.affiliations.flatMap((a) => {
        const company = ref(companies, a.companyId)
        return company ? [{ company, department: ref(departments, a.departmentId) }] : []
      }),
    }
  }

  return {
    getMe: async (userId) => {
      const user = await userRepository.findById(userId)
      if (!user) throw new ServiceError('not_found', 'User profile not registered')
      return toView(user)
    },
    saveMe: async (userId, input) => {
      const name = cleanText(input.name)
      if (!name) throw new ServiceError('invalid', 'Name is required')

      const affiliations: Affiliation[] = []
      for (const affiliation of input.affiliations) {
        const companyName = cleanText(affiliation.companyName)
        if (!companyName) throw new ServiceError('invalid', 'Company name is required')
        const company = await masterResolver.company(userId, companyName)
        const departmentName = cleanText(affiliation.departmentName)
        const [department] = departmentName
          ? await masterResolver.departments(userId, company.id, [departmentName])
          : []
        const departmentId = department?.id ?? null
        if (
          !affiliations.some((a) => a.companyId === company.id && a.departmentId === departmentId)
        ) {
          affiliations.push({ companyId: company.id, departmentId })
        }
      }

      const existing = await userRepository.findById(userId)
      const now = new Date().toISOString()
      const user: User = {
        id: userId,
        name,
        nameKana: cleanText(input.nameKana),
        affiliations,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      await userRepository.save(user)
      return toView(user)
    },
  }
}
