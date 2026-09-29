import { expect, test } from 'vite-plus/test'

import { ApiError } from './client.ts'
import { errorMessage } from './errors.ts'

test.each([
  [400, '入力内容を確認してください'],
  [404, '見つかりませんでした。削除された可能性があります'],
  [409, '同じ名前がすでにあるか、使用中のため操作できません'],
  [500, 'サーバーでエラーが発生しました（500）'],
])('maps an API error with status %i to a Japanese message', (status, message) => {
  expect(errorMessage(new ApiError(status, 'x'))).toBe(message)
})

test('explains a timeout separately from other network failures', () => {
  expect(errorMessage(new DOMException('timed out', 'TimeoutError'))).toContain('時間内に応答')
  expect(errorMessage(new TypeError('Failed to fetch'))).toContain('通信に失敗しました')
})
