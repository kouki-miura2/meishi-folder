import type { LocationQuery } from 'vue-router'

export interface CardFilter {
  q: string
  topicIds: string[]
  /** How several topics combine; the filter sheet (1c) starts on "いずれか". */
  match: 'any' | 'all'
  /** The list order, done on screen: kana reading (the default) or company. Not sent to the API. */
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

/** The API's query: what narrows the cards down. */
export const filterToQuery = (filter: CardFilter): Record<string, string> => ({
  ...(filter.q.trim() ? { q: filter.q.trim() } : {}),
  ...(filter.topicIds.length ? { topicIds: filter.topicIds.join(','), match: filter.match } : {}),
})

/** The URL's query: the API's, plus the order. */
export const filterToRouteQuery = (filter: CardFilter): Record<string, string> => ({
  ...filterToQuery(filter),
  ...(filter.sort === 'company' ? { sort: filter.sort } : {}),
})

export const toggleTopic = (filter: CardFilter, topicId: string): CardFilter => ({
  ...filter,
  topicIds: filter.topicIds.includes(topicId)
    ? filter.topicIds.filter((id) => id !== topicId)
    : [...filter.topicIds, topicId],
})
