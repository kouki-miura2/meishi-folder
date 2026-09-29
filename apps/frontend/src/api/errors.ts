import { ApiError } from './client.ts'

/** A Japanese message for the user, by what went wrong rather than the backend's English text. */
export const errorMessage = (error: unknown): string => {
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
