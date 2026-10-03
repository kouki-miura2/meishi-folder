import type { LocationQuery } from 'vue-router'

import type { CardView } from '../api/types.ts'

export interface CardFilter {
  q: string
  topicIds: string[]
  /** How several topics combine; the filter sheet (1c) starts on "いずれか". */
  match: 'any' | 'all'
  /** The list order: kana reading (the default) or company. */
  sort: 'name' | 'company'
}

export const emptyCardFilter = (): CardFilter => ({
  q: '',
  topicIds: [],
  match: 'any',
  sort: 'name',
})

const single = (value: LocationQuery[string]) => (Array.isArray(value) ? value[0] : value) ?? ''

/**
 * The list's filter lives in the URL (`?q=&topicIds=&match=&sort=`), so it survives going to a card
 * and back.
 */
export const filterFromQuery = (query: LocationQuery): CardFilter => ({
  q: single(query.q),
  topicIds: single(query.topicIds).split(',').filter(Boolean),
  match: single(query.match) === 'all' ? 'all' : 'any',
  sort: single(query.sort) === 'company' ? 'company' : 'name',
})

/** The URL's query: only what differs from the empty filter. */
export const filterToRouteQuery = (filter: CardFilter): Record<string, string> => ({
  ...(filter.q.trim() ? { q: filter.q.trim() } : {}),
  ...(filter.topicIds.length ? { topicIds: filter.topicIds.join(','), match: filter.match } : {}),
  ...(filter.sort === 'company' ? { sort: filter.sort } : {}),
})

/** Every text a search looks in: all of the card's text fields and its masters' names. */
const searchedTexts = (card: CardView) => [
  card.name,
  card.nameKana,
  card.nameRomaji,
  card.company?.name,
  ...card.departments.map((d) => d.name),
  ...card.titles,
  ...card.jobTypes,
  card.mobile,
  ...card.emails,
  ...card.otherContacts,
  card.url,
  ...card.offices.flatMap((o) => [o.postalCode, o.address, o.tel, o.fax]),
  card.metOn,
  card.metAt,
  card.metOccasion,
  card.handleName,
  card.memo,
  ...card.projects.map((t) => t.name),
  ...card.groups.map((t) => t.name),
]

/**
 * The cards a filter lets through, done on screen over the full list so searching never calls the
 * API: the text as a substring of any searched text, ignoring letter case; the topics, all or any.
 */
export const filterCards = (cards: readonly CardView[], filter: CardFilter): CardView[] => {
  const q = filter.q.trim().toLowerCase()
  const hasTopic = (card: CardView) => (id: string) =>
    card.projects.some((t) => t.id === id) || card.groups.some((t) => t.id === id)
  return cards.filter(
    (card) =>
      (!q || searchedTexts(card).some((text) => text?.toLowerCase().includes(q))) &&
      (filter.topicIds.length === 0 ||
        filter.topicIds[filter.match === 'any' ? 'some' : 'every'](hasTopic(card))),
  )
}

export const toggleTopic = (filter: CardFilter, topicId: string): CardFilter => ({
  ...filter,
  topicIds: filter.topicIds.includes(topicId)
    ? filter.topicIds.filter((id) => id !== topicId)
    : [...filter.topicIds, topicId],
})
