import { expect, test } from 'vite-plus/test'

import { stripApiPrefix } from './api-path.ts'

test.each([
  ['https://example.com/api/cards/c-1?x=1', 'https://example.com/cards/c-1?x=1'],
  ['https://example.com/api', 'https://example.com/'],
  ['https://example.com/api/', 'https://example.com/'],
  ['https://example.com/apiary', 'https://example.com/apiary'],
  ['https://example.com/cards', 'https://example.com/cards'],
])('maps %s to %s', (from, to) => {
  expect(stripApiPrefix(new Request(from)).url).toBe(to)
})

test('keeps the method, headers and body', async () => {
  const request = new Request('https://example.com/api/me', {
    method: 'PUT',
    headers: { authorization: 'Bearer token' },
    body: '{"name":"山田"}',
  })

  const stripped = stripApiPrefix(request)

  expect(stripped.method).toBe('PUT')
  expect(stripped.headers.get('authorization')).toBe('Bearer token')
  await expect(stripped.text()).resolves.toBe('{"name":"山田"}')
})
