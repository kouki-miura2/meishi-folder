import { expect, test } from 'vite-plus/test'

import type { CardView } from '../api/types.ts'
import {
  type CardFilter,
  emptyCardFilter,
  filterCards,
  filterFromQuery,
  filterToRouteQuery,
  toggleTopic,
} from './card-filter.ts'

test('an empty query is the empty filter, matching any topic', () => {
  expect(filterFromQuery({})).toEqual(emptyCardFilter())
})

test('filterFromQuery reads text, comma-separated topics and the match mode', () => {
  expect(filterFromQuery({ q: '展示会', topicIds: 't-1,t-2', match: 'all' })).toEqual({
    q: '展示会',
    topicIds: ['t-1', 't-2'],
    match: 'all',
    sort: 'name',
  })
})

test('filterFromQuery takes the first of repeated parameters and ignores unknown values', () => {
  expect(filterFromQuery({ q: ['a', 'b'], match: 'some', sort: 'date' })).toEqual({
    q: 'a',
    topicIds: [],
    match: 'any',
    sort: 'name',
  })
})

test('filterToRouteQuery writes only what differs from the empty filter', () => {
  expect(filterToRouteQuery({ q: '  ', topicIds: [], match: 'all', sort: 'name' })).toEqual({})
  expect(
    filterToRouteQuery({ q: ' 展示会 ', topicIds: ['t-1'], match: 'any', sort: 'name' }),
  ).toEqual({ q: '展示会', topicIds: 't-1', match: 'any' })
  expect(filterToRouteQuery({ ...emptyCardFilter(), sort: 'company' })).toEqual({ sort: 'company' })
})

test('a filter survives the round trip through the URL', () => {
  const filter = {
    q: '展示会',
    topicIds: ['t-1', 't-2'],
    match: 'all' as const,
    sort: 'company' as const,
  }

  expect(filterFromQuery(filterToRouteQuery(filter))).toEqual(filter)
})

test('toggleTopic adds and removes a topic', () => {
  const selected = toggleTopic(emptyCardFilter(), 't-1')

  expect(selected.topicIds).toEqual(['t-1'])
  expect(toggleTopic(selected, 't-1').topicIds).toEqual([])
})

const cardView = (id: string, fields: Partial<CardView> = {}): CardView => ({
  id,
  name: null,
  nameKana: null,
  nameRomaji: null,
  company: null,
  departments: [],
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
  memo: null,
  projects: [],
  groups: [],
  frontImageId: null,
  backImageId: null,
  visibility: 'private',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...fields,
})

const cards = [
  cardView('memo', { name: '山田 太郎', memo: 'Demo day' }),
  cardView('company', {
    handleName: 'アルファ',
    company: { id: 'c-1', name: 'Acme' },
    departments: [{ id: 'd-1', name: 'Research_Lab' }],
    projects: [{ id: 't-1', name: 'Apollo' }],
    groups: [{ id: 't-2', name: 'Book club' }],
  }),
  cardView('office', {
    name: '佐藤',
    emails: ['sato@example.com'],
    offices: [{ postalCode: null, address: '大阪市北区', tel: null, fax: null }],
    projects: [{ id: 't-1', name: 'Apollo' }],
  }),
]
const ids = (filter: Partial<CardFilter>) =>
  filterCards(cards, { ...emptyCardFilter(), ...filter }).map((card) => card.id)

test('filterCards searches every text field and master name, ignoring letter case', () => {
  expect(ids({})).toEqual(['memo', 'company', 'office'])
  expect(ids({ q: 'SATO@' })).toEqual(['office'])
  expect(ids({ q: ' acme ' })).toEqual(['company'])
  expect(ids({ q: 'research_lab' })).toEqual(['company'])
  expect(ids({ q: 'book' })).toEqual(['company'])
  expect(ids({ q: 'apollo' })).toEqual(['company', 'office'])
  expect(ids({ q: 'demo' })).toEqual(['memo'])
  expect(ids({ q: '北区' })).toEqual(['office'])
})

test('filterCards takes the text literally and never matches the field names', () => {
  expect(ids({ q: '%' })).toEqual([])
  expect(ids({ q: 'Res_arch' })).toEqual([])
  expect(ids({ q: 'address' })).toEqual([])
})

test('filterCards requires every topic with "all", and at least one with "any"', () => {
  expect(ids({ topicIds: ['t-1'], match: 'all' })).toEqual(['company', 'office'])
  expect(ids({ topicIds: ['t-1', 't-2'], match: 'all' })).toEqual(['company'])
  expect(ids({ topicIds: ['t-2', 'missing'], match: 'any' })).toEqual(['company'])
  expect(ids({ q: '佐藤', topicIds: ['t-1'], match: 'any' })).toEqual(['office'])
})
