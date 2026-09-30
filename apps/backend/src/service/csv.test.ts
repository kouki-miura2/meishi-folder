import { expect, test } from 'vite-plus/test'

import { toCsv } from './csv.ts'

test('quotes every field, doubles quotes and ends each record with CRLF after a BOM', () => {
  expect(
    toCsv([
      ['名前', 'メモ'],
      ['say "hi"', null],
      ['a,b', '1行目\n2行目'],
    ]),
  ).toBe('﻿"名前","メモ"\r\n"say ""hi""",""\r\n"a,b","1行目\n2行目"\r\n')
})

test('an empty table is just the BOM', () => {
  expect(toCsv([])).toBe('﻿')
})
