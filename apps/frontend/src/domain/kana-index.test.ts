import { expect, test } from 'vite-plus/test'

import { groupByIndex, indexLabelOf, toKatakana } from './kana-index.ts'

const card = (
  nameKana: string | null,
  handleName: string | null = null,
  name: string | null = null,
) => ({
  nameKana,
  handleName,
  name,
})

test('toKatakana converts hiragana and leaves everything else', () => {
  expect(toKatakana('かずー Kaz')).toBe('カズー Kaz')
})

test.each([
  ['アオキ', 'ア'],
  ['ヴィンセント', 'ア'],
  ['ガモウ', 'カ'],
  ['ヶ谷', 'カ'],
  ['ジョウ', 'サ'],
  ['ヅカ', 'タ'],
  ['ノダ', 'ナ'],
  ['ポール', 'ハ'],
  ['モリ', 'マ'],
  ['ョシ', 'ヤ'],
  ['ロペス', 'ラ'],
  ['ワタナベ', 'ワ'],
  ['ンジャイ', 'ワ'],
])('indexes the kana reading %s under %s', (kana, label) => {
  expect(indexLabelOf(card(kana))).toBe(label)
})

test('falls back to the handle name, then the name', () => {
  expect(indexLabelOf(card(null, 'かずー'))).toBe('カ')
  expect(indexLabelOf(card(null, null, 'Kenji Sato'))).toBe('A')
  expect(indexLabelOf(card(null, null, '佐藤 健二'))).toBe('#')
  expect(indexLabelOf(card(null, null, null))).toBe('#')
})

test('reads full-width Latin letters as Latin', () => {
  expect(indexLabelOf(card('Ｋｅｎ'))).toBe('A')
})

test('groupByIndex orders sections by the index and cards by reading within each', () => {
  const sections = groupByIndex([
    card('サトウ'),
    card(null, null, 'Alice'),
    card('イシカワ'),
    card(null, 'かずー'),
    card('アオキ'),
    card(null, null, '佐藤'),
  ])

  expect(
    sections.map((s) => [s.label, s.cards.map((c) => c.nameKana ?? c.handleName ?? c.name)]),
  ).toEqual([
    ['ア', ['アオキ', 'イシカワ']],
    ['カ', ['かずー']],
    ['サ', ['サトウ']],
    ['A', ['Alice']],
    ['#', ['佐藤']],
  ])
})
