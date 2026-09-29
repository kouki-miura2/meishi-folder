import type {
  CardExtractorRepository,
  ExtractedCard,
} from '../repository/card-extractor.repository.ts'
import type { CardImage, CardImageRepository } from '../repository/card-image.repository.ts'
import type { Card, CardRepository } from '../repository/card.repository.ts'
import type { Company, CompanyRepository } from '../repository/company.repository.ts'
import type { Department, DepartmentRepository } from '../repository/department.repository.ts'
import type { Topic, TopicRepository } from '../repository/topic.repository.ts'
import type { User, UserRepository } from '../repository/user.repository.ts'

/**
 * Test-only, array-backed fakes of the repository interfaces, so service tests never touch the
 * real repositories or DAOs. They ignore `userId`: each test works for a single user. Merge,
 * reference and filter behavior is the DAO's job and is tested there; here those calls are just
 * recorded or stubbed.
 */

export const fakeUserRepository = (users: User[] = []) =>
  ({
    users,
    findById: async (id) => users.find((u) => u.id === id) ?? null,
    save: async (user) => {
      users.splice(0, users.length, ...users.filter((u) => u.id !== user.id), user)
    },
  }) satisfies UserRepository & { users: User[] }

export const fakeCompanyRepository = (companies: Company[] = []) => {
  const merges: { targetId: string; sourceIds: string[] }[] = []
  const referenced = new Set<string>()
  return {
    companies,
    merges,
    referenced,
    list: async () => companies.map((c) => ({ ...c, cardCount: 0, departmentCount: 0 })),
    findById: async (_userId, id) => companies.find((c) => c.id === id) ?? null,
    findByName: async (_userId, name) => companies.find((c) => c.name === name) ?? null,
    create: async (_userId, company) => void companies.push(company),
    rename: async (_userId, id, name) => {
      const company = companies.find((c) => c.id === id)
      if (company) company.name = name
    },
    delete: async (_userId, id) => {
      companies.splice(
        companies.findIndex((c) => c.id === id),
        1,
      )
    },
    isReferenced: async (_userId, id) => referenced.has(id),
    merge: async (_userId, targetId, sourceIds) => void merges.push({ targetId, sourceIds }),
  } satisfies CompanyRepository & Record<string, unknown>
}

export const fakeDepartmentRepository = (departments: Department[] = []) => {
  const merges: { targetId: string; sourceIds: string[] }[] = []
  const referenced = new Set<string>()
  return {
    departments,
    merges,
    referenced,
    list: async () => [...departments],
    listByCompany: async (_userId, companyId) =>
      departments.filter((d) => d.companyId === companyId).map((d) => ({ ...d, cardCount: 0 })),
    findById: async (_userId, id) => departments.find((d) => d.id === id) ?? null,
    findByName: async (_userId, companyId, name) =>
      departments.find((d) => d.companyId === companyId && d.name === name) ?? null,
    create: async (_userId, department) => void departments.push(department),
    rename: async (_userId, id, name) => {
      const department = departments.find((d) => d.id === id)
      if (department) department.name = name
    },
    delete: async (_userId, id) => {
      departments.splice(
        departments.findIndex((d) => d.id === id),
        1,
      )
    },
    isReferenced: async (_userId, id) => referenced.has(id),
    merge: async (_userId, targetId, sourceIds) => void merges.push({ targetId, sourceIds }),
  } satisfies DepartmentRepository & Record<string, unknown>
}

export const fakeTopicRepository = (topics: Topic[] = []) =>
  ({
    topics,
    list: async () => [...topics],
    findByName: async (_userId, kind, name) =>
      topics.find((t) => t.kind === kind && t.name === name) ?? null,
    create: async (_userId, topic) => void topics.push(topic),
  }) satisfies TopicRepository & { topics: Topic[] }

export const fakeCardRepository = (cards: Card[] = []) =>
  ({
    cards,
    list: async () => [...cards],
    findById: async (_userId, id) => structuredClone(cards.find((c) => c.id === id) ?? null),
    findByName: async (_userId, name) => cards.filter((c) => c.name === name),
    create: async (_userId, card) => void cards.push(card),
    update: async (_userId, card) => {
      cards.splice(
        cards.findIndex((c) => c.id === card.id),
        1,
        card,
      )
    },
    delete: async (_userId, id) => {
      cards.splice(
        cards.findIndex((c) => c.id === id),
        1,
      )
    },
  }) satisfies CardRepository & { cards: Card[] }

export const fakeCardImageRepository = (images = new Map<string, CardImage>()) =>
  ({
    images,
    put: async (_userId, id, image) => void images.set(id, image),
    get: async (_userId, id) => images.get(id) ?? null,
    exists: async (_userId, id) => images.has(id),
    delete: async (_userId, ids) => {
      for (const id of ids) images.delete(id)
    },
  }) satisfies CardImageRepository & { images: Map<string, CardImage> }

export const emptyExtractedCard: ExtractedCard = {
  name: null,
  nameKana: null,
  nameRomaji: null,
  companyName: null,
  departmentNames: [],
  titles: [],
  jobTypes: [],
  mobile: null,
  emails: [],
  otherContacts: [],
  url: null,
  offices: [],
}

/** Replies per image body size, so a test can tell the front photo from the back. */
export const fakeCardExtractorRepository = (
  replies: Record<number, Partial<ExtractedCard>> = {},
): CardExtractorRepository => ({
  extract: async (image) => ({ ...emptyExtractedCard, ...replies[image.body.byteLength] }),
})
