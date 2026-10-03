import { LIMITS } from 'utils'
import { expect, test } from 'vite-plus/test'

import type { CardView, ExtractedCard } from '../api/types.ts'
import {
  changedPrintedFields,
  emptyCardForm,
  fieldsToReview,
  formFromCard,
  formFromExtracted,
  overwritePrinted,
  printedText,
  toCreateInput,
  toOverwriteInput,
  toUpdateInput,
  validateCardForm,
} from './card-form.ts'

const card: CardView = {
  id: 'card-1',
  name: '佐藤 健二',
  nameKana: 'サトウ ケンジ',
  nameRomaji: null,
  company: { id: 'c-1', name: '東都電機株式会社' },
  departments: [{ id: 'd-1', name: '技術本部' }],
  titles: ['部長'],
  jobTypes: [],
  mobile: null,
  emails: ['k.sato@toto-denki.co.jp'],
  otherContacts: [],
  url: null,
  offices: [{ postalCode: '105-0011', address: '東京都港区', tel: null, fax: null }],
  metOn: '2026-09-29',
  metAt: '東京ビッグサイト',
  metOccasion: null,
  handleName: null,
  memo: '展示会で\nデモを見せてもらった',
  projects: [{ id: 't-1', name: 'スマートビル' }],
  groups: [{ id: 't-2', name: 'IoT勉強会' }],
  frontImageId: 'img-1',
  backImageId: null,
  visibility: 'private',
  createdAt: '2026-09-29T00:00:00.000Z',
  updatedAt: '2026-09-29T00:00:00.000Z',
}

const extracted: ExtractedCard = {
  name: '佐藤 健二',
  nameKana: null,
  nameRomaji: 'Kenji Sato',
  companyName: '東都電機株式会社',
  departmentNames: ['技術本部'],
  titles: ['部長'],
  jobTypes: [],
  mobile: '090-1234-5678',
  emails: [],
  otherContacts: [],
  url: null,
  offices: [],
}

test('formFromCard and toUpdateInput round-trip a card, names in place of master ids', () => {
  const form = formFromCard(card)

  expect(form.companyName).toBe('東都電機株式会社')
  expect(form.projectNames).toEqual(['スマートビル'])
  expect(toUpdateInput(form)).toEqual({
    name: '佐藤 健二',
    nameKana: 'サトウ ケンジ',
    nameRomaji: null,
    companyName: '東都電機株式会社',
    departmentNames: ['技術本部'],
    titles: ['部長'],
    jobTypes: [],
    mobile: null,
    emails: ['k.sato@toto-denki.co.jp'],
    otherContacts: [],
    url: null,
    offices: [{ postalCode: '105-0011', address: '東京都港区', tel: null, fax: null }],
    metOn: '2026-09-29',
    metAt: '東京ビッグサイト',
    metOccasion: null,
    handleName: null,
    memo: '展示会で\nデモを見せてもらった',
    projectNames: ['スマートビル'],
    groupNames: ['IoT勉強会'],
  })
})

test('formFromExtracted fills the printed items and dates the card today', () => {
  const form = formFromExtracted(extracted, '2026-09-30')

  expect(form).toMatchObject({ name: '佐藤 健二', nameRomaji: 'Kenji Sato', metOn: '2026-09-30' })
  expect(form.projectNames).toEqual([])
})

test('toCreateInput trims, turns blanks into null and drops empty list items and offices', () => {
  const form = {
    ...emptyCardForm(),
    name: '  山田 ',
    emails: [' a@example.com ', ''],
    offices: [{ postalCode: '', address: ' ', tel: '', fax: '' }],
  }

  expect(toCreateInput(form, { frontImageId: 'img-1', backImageId: null })).toMatchObject({
    name: '山田',
    nameKana: null,
    emails: ['a@example.com'],
    offices: [],
    frontImageId: 'img-1',
    backImageId: null,
  })
})

test('toOverwriteInput sends only the photos and printed items', () => {
  const input = toOverwriteInput(formFromCard(card), { frontImageId: 'new', backImageId: null })

  expect(input).toMatchObject({ name: '佐藤 健二', frontImageId: 'new', backImageId: null })
  expect(input).not.toHaveProperty('metAt')
  expect(input).not.toHaveProperty('projectNames')
  expect(input).not.toHaveProperty('visibility')
})

test('validateCardForm requires one of name, kana or handle name', () => {
  expect(validateCardForm(emptyCardForm())).toEqual([
    '氏名・氏名カナ・ハンドルネームのいずれかを入力してください',
  ])
  expect(validateCardForm({ ...emptyCardForm(), handleName: 'かずー' })).toEqual([])
})

test('validateCardForm rejects departments without a company and a malformed date', () => {
  const errors = validateCardForm({
    ...emptyCardForm(),
    name: '山田',
    departmentNames: ['営業部'],
    metOn: '2026/09/29',
  })

  expect(errors).toHaveLength(2)
})

test('validateCardForm caps the memo by visible characters', () => {
  const form = { ...emptyCardForm(), name: '山田' }

  expect(validateCardForm({ ...form, memo: '👨‍👩‍👧'.repeat(LIMITS.textMaxLength) })).toEqual([])
  expect(validateCardForm({ ...form, memo: 'あ'.repeat(LIMITS.textMaxLength + 1) })).toEqual([
    `メモは ${LIMITS.textMaxLength} 字以内で入力してください`,
  ])
})

test('fieldsToReview flags values whose shape looks misread', () => {
  const review = fieldsToReview({
    ...emptyCardForm(),
    name: '佐藤 健二',
    nameKana: 'さとう けんじ',
    mobile: '090-l234-5678',
    emails: ['k.sato@toto-denki'],
    url: 'not a url',
    offices: [{ postalCode: '105-001', address: '', tel: '', fax: '' }],
  })

  expect([...review].sort()).toEqual(['emails', 'mobile', 'nameKana', 'offices', 'url'])
})

test.each([
  ['090-1234-567', true],
  ['090-1234-5678', false],
  ['03 1234 5678', false],
  ['+81 90-1234-5678', false],
  ['+81 9', true],
])('fieldsToReview checks the digit count of the phone number %s', (mobile, flagged) => {
  const review = fieldsToReview({ ...emptyCardForm(), name: '佐藤', mobile })

  expect(review.has('mobile')).toBe(flagged)
})

test('fieldsToReview passes well-formed values and flags a missing name', () => {
  const review = fieldsToReview({
    ...emptyCardForm(),
    nameKana: 'サトウ ケンジ',
    mobile: '090-1234-5678',
    emails: ['k.sato@toto-denki.co.jp'],
    url: 'https://toto-denki.co.jp',
    offices: [{ postalCode: '105-0011', address: '', tel: '03-1234-5678', fax: '' }],
  })

  expect([...review]).toEqual(['name'])
})

test('overwritePrinted replaces the printed items and keeps scene and notes', () => {
  const form = overwritePrinted(formFromCard(card), extracted)

  expect(form).toMatchObject({
    nameKana: '',
    nameRomaji: 'Kenji Sato',
    mobile: '090-1234-5678',
    emails: [],
    offices: [],
    metOn: '2026-09-29',
    metAt: '東京ビッグサイト',
    memo: card.memo,
    projectNames: ['スマートビル'],
  })
})

test('changedPrintedFields lists the printed items that differ, ignoring blanks and spaces', () => {
  const before = formFromCard(card)
  const after = {
    ...overwritePrinted(before, extracted),
    name: ' 佐藤 健二 ',
    titles: ['部長', ''],
  }

  expect([...changedPrintedFields(before, after)]).toEqual([
    'nameKana',
    'nameRomaji',
    'mobile',
    'emails',
    'offices',
  ])
})

test('printedText shows a printed item as one line', () => {
  const form = {
    ...formFromCard(card),
    titles: ['部長', '技師'],
    offices: [{ postalCode: '105-0011', address: '東京都港区', tel: '03-1234-5678', fax: '' }],
  }

  expect(printedText(form, 'name')).toBe('佐藤 健二')
  expect(printedText(form, 'mobile')).toBe('')
  expect(printedText(form, 'titles')).toBe('部長、技師')
  expect(printedText(form, 'offices')).toBe('〒105-0011 東京都港区 TEL 03-1234-5678')
})
