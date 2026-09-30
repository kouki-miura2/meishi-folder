import { expect, test } from 'vite-plus/test'

import {
  emptyCardFilter,
  filterFromQuery,
  filterToQuery,
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

test('filterToQuery writes only what narrows the cards, not the order', () => {
  expect(filterToQuery({ q: '  ', topicIds: [], match: 'all', sort: 'company' })).toEqual({})
  expect(filterToQuery({ q: ' 展示会 ', topicIds: ['t-1'], match: 'any', sort: 'name' })).toEqual({
    q: '展示会',
    topicIds: 't-1',
    match: 'any',
  })
})

test('filterToRouteQuery adds the order, only when it is not the default', () => {
  expect(filterToRouteQuery(emptyCardFilter())).toEqual({})
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
