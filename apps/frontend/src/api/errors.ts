import { LIMITS } from 'utils'

import { ApiError } from './client.ts'

export const cardLimitMessage = `名刺は ${LIMITS.cardsPerUser} 枚まで登録できます。不要な名刺を削除してから登録してください`

/** `POST /cards` refused because the user already has `LIMITS.cardsPerUser` cards (its only 409). */
export class CardLimitError extends Error {
  constructor() {
    super(cardLimitMessage)
    this.name = 'CardLimitError'
  }
}

/** A Japanese message for the user, by what went wrong rather than the backend's English text. */
export const errorMessage = (error: unknown): string => {
  if (error instanceof CardLimitError) return cardLimitMessage
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return '入力内容を確認してください'
      case 401:
        return 'ログインの有効期限が切れました。もう一度ログインしてください'
      case 404:
        return '見つかりませんでした。削除された可能性があります'
      case 409:
        return '同じ名前がすでにあるか、使用中のため操作できません'
      default:
        return `サーバーでエラーが発生しました（${error.status}）`
    }
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return '時間内に応答がありませんでした。通信環境を確認してください'
  }
  return '通信に失敗しました。通信環境を確認してください'
}
