import type { CardDao, CardFilter, CardRecord, Visibility } from '../dao/card.interface.ts'

export type { CardFilter, Visibility }

export interface Office {
  postalCode: string | null
  address: string | null
  tel: string | null
  fax: string | null
}

export interface Card {
  id: string
  name: string | null
  nameKana: string | null
  nameRomaji: string | null
  companyId: string | null
  departmentIds: string[]
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
  memo: string | null
  topicIds: string[]
  frontImageId: string | null
  backImageId: string | null
  visibility: Visibility
  createdAt: string
  updatedAt: string
}

export interface CardRepository {
  list: (userId: string, filter: CardFilter) => Promise<Card[]>
  findById: (userId: string, id: string) => Promise<Card | null>
  findByName: (userId: string, name: string) => Promise<Card[]>
  count: (userId: string) => Promise<number>
  create: (userId: string, card: Card) => Promise<void>
  update: (userId: string, card: Card) => Promise<void>
  delete: (userId: string, id: string) => Promise<void>
}

const toCard = (record: CardRecord): Card => ({
  id: record.id,
  name: record.name,
  nameKana: record.name_kana,
  nameRomaji: record.name_romaji,
  companyId: record.company_id,
  departmentIds: record.department_ids,
  titles: JSON.parse(record.titles),
  jobTypes: JSON.parse(record.job_types),
  mobile: record.mobile,
  emails: JSON.parse(record.emails),
  otherContacts: JSON.parse(record.other_contacts),
  url: record.url,
  offices: JSON.parse(record.offices),
  metOn: record.met_on,
  metAt: record.met_at,
  metOccasion: record.met_occasion,
  handleName: record.handle_name,
  memo: record.memo,
  topicIds: record.topic_ids,
  frontImageId: record.front_image_id,
  backImageId: record.back_image_id,
  visibility: record.visibility,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
})

const toRecord = (userId: string, card: Card): CardRecord => ({
  id: card.id,
  user_id: userId,
  name: card.name,
  name_kana: card.nameKana,
  name_romaji: card.nameRomaji,
  company_id: card.companyId,
  department_ids: card.departmentIds,
  titles: JSON.stringify(card.titles),
  job_types: JSON.stringify(card.jobTypes),
  mobile: card.mobile,
  emails: JSON.stringify(card.emails),
  other_contacts: JSON.stringify(card.otherContacts),
  url: card.url,
  offices: JSON.stringify(card.offices),
  met_on: card.metOn,
  met_at: card.metAt,
  met_occasion: card.metOccasion,
  handle_name: card.handleName,
  memo: card.memo,
  topic_ids: card.topicIds,
  front_image_id: card.frontImageId,
  back_image_id: card.backImageId,
  visibility: card.visibility,
  created_at: card.createdAt,
  updated_at: card.updatedAt,
})

export const createCardRepository = (dao: CardDao): CardRepository => ({
  list: async (userId, filter) => (await dao.list(userId, filter)).map(toCard),
  findById: async (userId, id) => {
    const record = await dao.findById(userId, id)
    return record ? toCard(record) : null
  },
  findByName: async (userId, name) => (await dao.findByName(userId, name)).map(toCard),
  count: dao.count,
  create: (userId, card) => dao.insert(toRecord(userId, card)),
  update: (userId, card) => dao.update(toRecord(userId, card)),
  delete: dao.delete,
})
