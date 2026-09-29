import { expect, test } from 'vite-plus/test'

import { emptyCardFilter, filterFromQuery, filterToQuery, toggleTopic } from './card-filter.ts'

test('an empty query is the empty filter, matching any topic', () => {
  expect(filterFromQuery({})).toEqual(emptyCardFilter())
})

test('filterFromQuery reads text, comma-separated topics and the match mode', () => {
  expect(filterFromQuery({ q: '展示会', topicIds: 't-1,t-2', match: 'all' })).toEqual({
    q: '展示会',
    topicIds: ['t-1', 't-2'],
    match: 'all',
  })
})

test('filterFromQuery takes the first of repeated parameters and ignores unknown match values', () => {
  expect(filterFromQuery({ q: ['a', 'b'], match: 'some' })).toEqual({
    q: 'a',
    topicIds: [],
    match: 'any',
  })
})

test('filterToQuery writes only what is in use', () => {
  expect(filterToQuery({ q: '  ', topicIds: [], match: 'all' })).toEqual({})
  expect(filterToQuery({ q: ' 展示会 ', topicIds: ['t-1'], match: 'any' })).toEqual({
    q: '展示会',
    topicIds: 't-1',
    match: 'any',
  })
})

test('a filter survives the round trip through the URL', () => {
  const filter = { q: '展示会', topicIds: ['t-1', 't-2'], match: 'all' as const }

  expect(filterFromQuery(filterToQuery(filter))).toEqual(filter)
})

test('toggleTopic adds and removes a topic', () => {
  const selected = toggleTopic(emptyCardFilter(), 't-1')

  expect(selected.topicIds).toEqual(['t-1'])
  expect(toggleTopic(selected, 't-1').topicIds).toEqual([])
})
