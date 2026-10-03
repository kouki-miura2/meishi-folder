/** The list's index labels, in display order: the kana rows, then Latin names, then everything else. */
export const INDEX_LABELS = [
  'ア',
  'カ',
  'サ',
  'タ',
  'ナ',
  'ハ',
  'マ',
  'ヤ',
  'ラ',
  'ワ',
  'A',
  '#',
] as const
export type IndexLabel = (typeof INDEX_LABELS)[number]

// First katakana of each row (ァ..オ, カ..ゴ, ...), paired with its label. ヴ, ヵ and ヶ come after
// ン in Unicode, so they are placed explicitly.
const ROW_STARTS: [number, IndexLabel][] = [
  [0x30a1, 'ア'],
  [0x30ab, 'カ'],
  [0x30b5, 'サ'],
  [0x30bf, 'タ'],
  [0x30ca, 'ナ'],
  [0x30cf, 'ハ'],
  [0x30de, 'マ'],
  [0x30e3, 'ヤ'],
  [0x30e9, 'ラ'],
  [0x30ee, 'ワ'],
]
const EXTRA: Record<string, IndexLabel> = { ヴ: 'ア', ヵ: 'カ', ヶ: 'カ' }

/** Hiragana → katakana, so ひらがな handle names sort and index with the katakana readings. */
export const toKatakana = (value: string) =>
  value.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))

export interface IndexedName {
  nameKana: string | null
  handleName: string | null
  name: string | null
}

/** What a card sorts by: its kana, else its handle name, else its name (as the backend orders it). */
export const sortKeyOf = (card: IndexedName) =>
  toKatakana((card.nameKana ?? card.handleName ?? card.name ?? '').trim().normalize('NFKC'))

export const indexLabelOf = (card: IndexedName): IndexLabel => {
  const first = sortKeyOf(card).charAt(0)
  if (/[A-Za-z0-9]/.test(first)) return 'A'
  if (EXTRA[first]) return EXTRA[first]
  const code = first.charCodeAt(0)
  if (code < 0x30a1 || code > 0x30f3) return '#'
  return ROW_STARTS.findLast(([start]) => code >= start)?.[1] ?? '#'
}

export interface IndexSection<T> {
  label: IndexLabel
  cards: T[]
}

/** Groups cards under their index label, sections in index order, cards by reading within each. */
export const groupByIndex = <T extends IndexedName>(cards: readonly T[]): IndexSection<T>[] =>
  INDEX_LABELS.map((label) => ({
    label,
    cards: cards
      .filter((card) => indexLabelOf(card) === label)
      .sort((a, b) => sortKeyOf(a).localeCompare(sortKeyOf(b), 'ja')),
  })).filter((section) => section.cards.length > 0)

export interface AffiliatedName extends IndexedName {
  company: { name: string } | null
  departments: { name: string }[]
}

const departmentLine = (card: AffiliatedName) => card.departments.map((d) => d.name).join('\n')

const collate = (a: string, b: string) =>
  a.normalize('NFKC').localeCompare(b.normalize('NFKC'), 'ja')

/**
 * The list in company order: company name, then departments, then the reading as in the kana order.
 * Cards without a company come last. Names are compared as written (there is no reading for them).
 */
export const sortByCompany = <T extends AffiliatedName>(cards: readonly T[]): T[] =>
  [...cards].sort(
    (a, b) =>
      Number(!a.company) - Number(!b.company) ||
      collate(a.company?.name ?? '', b.company?.name ?? '') ||
      collate(departmentLine(a), departmentLine(b)) ||
      sortKeyOf(a).localeCompare(sortKeyOf(b), 'ja'),
  )
