/**
 * RFC 4180 CSV: comma-separated, CRLF after every record, every field quoted (empty ones too) with
 * `"` doubled inside. Line breaks inside a value stay as they are, which quoting allows. Starts
 * with a UTF-8 BOM so Excel doesn't read the Japanese as Shift_JIS.
 */
export const toCsv = (rows: readonly (readonly (string | null)[])[]): string =>
  '﻿' +
  rows
    .map((row) => row.map((value) => `"${(value ?? '').replaceAll('"', '""')}"`).join(',') + '\r\n')
    .join('')
