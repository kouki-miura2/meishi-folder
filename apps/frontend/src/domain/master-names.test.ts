import { expect, test } from 'vite-plus/test'

import { findVariantGroups, masterStatus, variantKey } from './master-names.ts'

const masters = [{ name: '東都電機株式会社' }, { name: '芝浦建設株式会社' }]

test('masterStatus matches an existing master after trimming only', () => {
  expect(masterStatus(' 東都電機株式会社 ', masters)).toBe('existing')
  expect(masterStatus('東都電機(株)', masters)).toBe('new')
  expect(masterStatus('  ', masters)).toBeNull()
})

test.each([
  ['東都電機(株)', '東都電機株式会社'],
  ['東都電機（株）', '東都電機株式会社'],
  ['㈱ミナトデザイン', '株式会社ミナトデザイン'],
  ['技術本部 / IoT推進室', '技術本部IoT推進室'],
  ['ＩｏＴ推進室', 'iot推進室'],
])('variantKey treats %s and %s as the same name', (a, b) => {
  expect(variantKey(a)).toBe(variantKey(b))
})

test('variantKey keeps genuinely different names apart', () => {
  expect(variantKey('第一営業部')).not.toBe(variantKey('第二営業部'))
})

test('findVariantGroups returns only groups with more than one member', () => {
  const groups = findVariantGroups([
    { id: 'd-1', name: '技術本部' },
    { id: 'd-2', name: '技術本部 / IoT推進室' },
    { id: 'd-3', name: '技術本部IoT推進室' },
    { id: 'd-4', name: '第二営業部' },
  ])

  expect(groups.map((g) => g.map((d) => d.id))).toEqual([['d-2', 'd-3']])
})
