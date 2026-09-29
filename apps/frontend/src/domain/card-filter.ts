import type { LocationQuery } from 'vue-router'

export interface CardFilter {
  q: string
  topicIds: string[]
  /** How several topics combine; the filter sheet (1c) starts on "いずれか". */
  match: 'any' | 'all'
}

export const emptyCardFilter = (): CardFilter => ({ q: '', topicIds: [], match: 'any' })

const single = (value: LocationQuery[string]) => (Array.isArray(value) ? value[0] : value) ?? ''

/** The list's filter lives in the URL (`?q=&topicIds=&match=`), so it survives going to a card and back. */
export const filterFromQuery = (query: LocationQuery): CardFilter => ({
  q: single(query.q),
  topicIds: single(query.topicIds).split(',').filter(Boolean),
  match: single(query.match) === 'all' ? 'all' : 'any',
})

export const filterToQuery = (filter: CardFilter): Record<string, string> => ({
  ...(filter.q.trim() ? { q: filter.q.trim() } : {}),
  ...(filter.topicIds.length ? { topicIds: filter.topicIds.join(','), match: filter.match } : {}),
})

export const toggleTopic = (filter: CardFilter, topicId: string): CardFilter => ({
  ...filter,
  topicIds: filter.topicIds.includes(topicId)
    ? filter.topicIds.filter((id) => id !== topicId)
    : [...filter.topicIds, topicId],
})
