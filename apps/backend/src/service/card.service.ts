import type {
  CardExtractorRepository,
  ExtractedCard,
} from '../repository/card-extractor.repository.ts'
import type { CardImageRepository } from '../repository/card-image.repository.ts'
import type { Card, CardRepository, Office, Visibility } from '../repository/card.repository.ts'
import type { CompanyRepository } from '../repository/company.repository.ts'
import type { DepartmentRepository } from '../repository/department.repository.ts'
import type { TopicKind, TopicRepository } from '../repository/topic.repository.ts'
import { ServiceError } from './errors.ts'
import type { MasterResolver } from './master-resolver.ts'
import { cleanText, cleanTexts } from './text.ts'
import type { MasterRef } from './user.service.ts'

export interface OfficeInput {
  postalCode?: string | null
  address?: string | null
  tel?: string | null
  fax?: string | null
}

/**
 * Card fields as the client sends them. Masters (company, departments, projects, groups) come as
 * names and are found or created. On update, an omitted field keeps its current value and `null`
 * clears it.
 */
export interface CardInput {
  name?: string | null
  nameKana?: string | null
  nameRomaji?: string | null
  companyName?: string | null
  departmentNames?: string[]
  titles?: string[]
  jobTypes?: string[]
  mobile?: string | null
  emails?: string[]
  otherContacts?: string[]
  url?: string | null
  offices?: OfficeInput[]
  metOn?: string | null
  metAt?: string | null
  metOccasion?: string | null
  handleName?: string | null
  projectNames?: string[]
  groupNames?: string[]
  frontImageId?: string | null
  backImageId?: string | null
  visibility?: Visibility
}

/** What the card list shows. */
export interface CardSummary {
  id: string
  name: string | null
  nameKana: string | null
  handleName: string | null
  companyName: string | null
  departmentNames: string[]
  projects: MasterRef[]
  groups: MasterRef[]
}

export interface CardView {
  id: string
  name: string | null
  nameKana: string | null
  nameRomaji: string | null
  company: MasterRef | null
  departments: MasterRef[]
  titles: string[]
  jobTypes: string[]
  mobile: string | null
  emails: string[]
  otherContacts: string[]
  url: string | null
  offices: Office[]
  metOn: string | null
  metAt: string | null
  metOccasion: string | null
  handleName: string | null
  projects: MasterRef[]
  groups: MasterRef[]
  frontImageId: string | null
  backImageId: string | null
  visibility: Visibility
  createdAt: string
  updatedAt: string
}

export interface CardListFilter {
  q?: string
  topicIds?: string[]
  /** `all` (default): every topic; `any`: at least one. */
  match?: 'any' | 'all'
}

export interface CardService {
  /** Reads the printed items off the uploaded photos without saving anything. */
  extract: (
    userId: string,
    images: { frontImageId: string; backImageId?: string | null },
  ) => Promise<ExtractedCard>
  /** Registered cards whose name matches (ignoring spaces): possibly the same person. */
  candidates: (userId: string, name: string) => Promise<CardSummary[]>
  list: (userId: string, filter: CardListFilter) => Promise<CardSummary[]>
  get: (userId: string, id: string) => Promise<CardView>
  /** New cards are always private, whatever `input.visibility` says. */
  create: (userId: string, input: CardInput) => Promise<CardView>
  update: (userId: string, id: string, input: CardInput) => Promise<CardView>
  remove: (userId: string, id: string) => Promise<void>
}

export interface CardServiceDependencies {
  cardRepository: CardRepository
  cardImageRepository: CardImageRepository
  cardExtractorRepository: CardExtractorRepository
  companyRepository: CompanyRepository
  departmentRepository: DepartmentRepository
  topicRepository: TopicRepository
  masterResolver: MasterResolver
}

const isEmpty = (value: unknown) => value === null || (Array.isArray(value) && value.length === 0)

/** The front side wins; the back only fills what the front lacks (typically the romaji name). */
const preferFront = (front: ExtractedCard, back: ExtractedCard): ExtractedCard => {
  const merged = { ...front }
  for (const key of Object.keys(front) as (keyof ExtractedCard)[]) {
    if (isEmpty(front[key])) Object.assign(merged, { [key]: back[key] })
  }
  return merged
}

const emptyCard = (id: string, now: string): Card => ({
  id,
  name: null,
  nameKana: null,
  nameRomaji: null,
  companyId: null,
  departmentIds: [],
  titles: [],
  jobTypes: [],
  mobile: null,
  emails: [],
  otherContacts: [],
  url: null,
  offices: [],
  metOn: null,
  metAt: null,
  metOccasion: null,
  handleName: null,
  topicIds: [],
  frontImageId: null,
  backImageId: null,
  visibility: 'private',
  createdAt: now,
  updatedAt: now,
})

const imageIds = (card: Card) =>
  [card.frontImageId, card.backImageId].filter((id): id is string => id !== null)

export const createCardService = ({
  cardRepository,
  cardImageRepository,
  cardExtractorRepository,
  companyRepository,
  departmentRepository,
  topicRepository,
  masterResolver,
}: CardServiceDependencies): CardService => {
  const loadMasters = async (userId: string) => {
    const [companies, departments, topics] = await Promise.all([
      companyRepository.list(userId),
      departmentRepository.list(userId),
      topicRepository.list(userId),
    ])
    const refs = (masters: MasterRef[], ids: string[]) =>
      ids.flatMap((id) => {
        const master = masters.find((m) => m.id === id)
        return master ? [{ id: master.id, name: master.name }] : []
      })
    const topicRefs = (card: Card, kind: TopicKind) =>
      refs(
        topics.filter((t) => t.kind === kind),
        card.topicIds,
      )
    return {
      companies,
      departments,
      topics,
      toSummary: (card: Card): CardSummary => ({
        id: card.id,
        name: card.name,
        nameKana: card.nameKana,
        handleName: card.handleName,
        companyName: companies.find((c) => c.id === card.companyId)?.name ?? null,
        departmentNames: refs(departments, card.departmentIds).map((d) => d.name),
        projects: topicRefs(card, 'project'),
        groups: topicRefs(card, 'group'),
      }),
      toView: (card: Card): CardView => {
        const { companyId, departmentIds, topicIds: _topicIds, ...fields } = card
        return {
          ...fields,
          company: refs(companies, companyId ? [companyId] : [])[0] ?? null,
          departments: refs(departments, departmentIds),
          projects: topicRefs(card, 'project'),
          groups: topicRefs(card, 'group'),
        }
      },
    }
  }

  /** Applies `input` on top of `base`, resolving master names to ids. */
  const apply = async (userId: string, base: Card, input: CardInput): Promise<Card> => {
    const masters = await loadMasters(userId)
    const text = (value: string | null | undefined, current: string | null) =>
      value === undefined ? current : cleanText(value)
    const texts = (value: string[] | undefined, current: string[]) =>
      value === undefined ? current : cleanTexts(value)

    let { companyId, departmentIds } = base
    if (input.companyName !== undefined || input.departmentNames !== undefined) {
      const companyName = text(
        input.companyName,
        masters.companies.find((c) => c.id === base.companyId)?.name ?? null,
      )
      // A changed company keeps the department names, re-resolved under the new company.
      const departmentNames = cleanTexts(
        input.departmentNames ??
          masters.departments.filter((d) => base.departmentIds.includes(d.id)).map((d) => d.name),
      )
      if (!companyName && departmentNames.length > 0) {
        throw new ServiceError('invalid', 'Departments need a company')
      }
      const company = companyName ? await masterResolver.company(userId, companyName) : null
      companyId = company?.id ?? null
      departmentIds = company
        ? (await masterResolver.departments(userId, company.id, departmentNames)).map((d) => d.id)
        : []
    }

    const topicIds = async (kind: TopicKind, names: string[] | undefined) =>
      names === undefined
        ? base.topicIds.filter((id) => masters.topics.some((t) => t.id === id && t.kind === kind))
        : (await masterResolver.topics(userId, kind, names)).map((t) => t.id)

    const card: Card = {
      ...base,
      name: text(input.name, base.name),
      nameKana: text(input.nameKana, base.nameKana),
      nameRomaji: text(input.nameRomaji, base.nameRomaji),
      companyId,
      departmentIds,
      titles: texts(input.titles, base.titles),
      jobTypes: texts(input.jobTypes, base.jobTypes),
      mobile: text(input.mobile, base.mobile),
      emails: texts(input.emails, base.emails),
      otherContacts: texts(input.otherContacts, base.otherContacts),
      url: text(input.url, base.url),
      offices:
        input.offices === undefined
          ? base.offices
          : input.offices
              .map((o) => ({
                postalCode: cleanText(o.postalCode),
                address: cleanText(o.address),
                tel: cleanText(o.tel),
                fax: cleanText(o.fax),
              }))
              .filter((o) => Object.values(o).some((v) => v !== null)),
      metOn: text(input.metOn, base.metOn),
      metAt: text(input.metAt, base.metAt),
      metOccasion: text(input.metOccasion, base.metOccasion),
      handleName: text(input.handleName, base.handleName),
      topicIds: [
        ...(await topicIds('project', input.projectNames)),
        ...(await topicIds('group', input.groupNames)),
      ],
      frontImageId: input.frontImageId === undefined ? base.frontImageId : input.frontImageId,
      backImageId: input.backImageId === undefined ? base.backImageId : input.backImageId,
      visibility: input.visibility ?? base.visibility,
    }

    if (!card.name && !card.nameKana && !card.handleName) {
      throw new ServiceError('invalid', 'One of name, name kana or handle name is required')
    }
    for (const id of imageIds(card).filter((id) => !imageIds(base).includes(id))) {
      if (!(await cardImageRepository.exists(userId, id))) {
        throw new ServiceError('invalid', `Image ${id} not found`)
      }
    }
    return card
  }

  const findOrThrow = async (userId: string, id: string) => {
    const card = await cardRepository.findById(userId, id)
    if (!card) throw new ServiceError('not_found', `Card ${id} not found`)
    return card
  }

  return {
    extract: async (userId, { frontImageId, backImageId }) => {
      const ids = [frontImageId, backImageId].filter((id): id is string => !!id)
      const results = await Promise.all(
        ids.map(async (id) => {
          const image = await cardImageRepository.get(userId, id)
          if (!image) throw new ServiceError('not_found', `Image ${id} not found`)
          return cardExtractorRepository.extract(image)
        }),
      )
      return results.reduce(preferFront)
    },
    candidates: async (userId, rawName) => {
      const name = cleanText(rawName)
      if (!name) return []
      const [cards, masters] = await Promise.all([
        cardRepository.findByName(userId, name),
        loadMasters(userId),
      ])
      return cards.map(masters.toSummary)
    },
    list: async (userId, { q, topicIds, match }) => {
      const [cards, masters] = await Promise.all([
        cardRepository.list(userId, { q: cleanText(q) ?? undefined, topicIds, match }),
        loadMasters(userId),
      ])
      return cards.map(masters.toSummary)
    },
    get: async (userId, id) => {
      const [card, masters] = await Promise.all([findOrThrow(userId, id), loadMasters(userId)])
      return masters.toView(card)
    },
    create: async (userId, input) => {
      const base = emptyCard(crypto.randomUUID(), new Date().toISOString())
      const card = await apply(userId, base, { ...input, visibility: 'private' })
      await cardRepository.create(userId, card)
      return (await loadMasters(userId)).toView(card)
    },
    update: async (userId, id, input) => {
      const base = await findOrThrow(userId, id)
      const card = await apply(userId, base, input)
      card.updatedAt = new Date().toISOString()
      await cardRepository.update(userId, card)
      // Overwriting a card with a new scan replaces its photos; the old ones are no longer reachable.
      const replaced = imageIds(base).filter((image) => !imageIds(card).includes(image))
      if (replaced.length > 0) await cardImageRepository.delete(userId, replaced)
      return (await loadMasters(userId)).toView(card)
    },
    remove: async (userId, id) => {
      const card = await findOrThrow(userId, id)
      await cardRepository.delete(userId, id)
      if (imageIds(card).length > 0) await cardImageRepository.delete(userId, imageIds(card))
    },
  }
}
