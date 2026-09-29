import { expect, test } from 'vite-plus/test'

import { cleanText, cleanTexts } from './text.ts'

test('cleanText trims and turns blank values into null', () => {
  expect(cleanText('  Acme ')).toBe('Acme')
  expect(cleanText('   ')).toBeNull()
  expect(cleanText(null)).toBeNull()
  expect(cleanText(undefined)).toBeNull()
})

test('cleanTexts trims, drops blanks and duplicates, and keeps the order', () => {
  expect(cleanTexts([' b ', 'a', '', 'b', '  '])).toEqual(['b', 'a'])
})
