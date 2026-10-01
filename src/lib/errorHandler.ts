// ========================================
// エラーハンドリングヘルパー
// ========================================
import { NextRequest } from 'next/server'
import { sendErrorNotification } from './notifications'

/**
 * APIルートでエラーが発生した際に通知を送信するヘルパー関数
 * @param error - エラーオブジェクト
 * @param request - NextRequestオブジェクト
 * @param statusCode - HTTPステータスコード（オプション）
 * @param additionalInfo - 追加情報（オプション）
 */
export async function notifyApiError(
  _error: Error | unknown,
  request: NextRequest,
  statusCode?: number,
  _additionalInfo?: Record<string, any>
): Promise<void> {
  try {
    await sendErrorNotification({
      errorMessage: 'Unexpected API error',
      pathname: new URL(request.url).pathname,
      httpStatus: statusCode,
      requestMethod: request.method,
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    })
  } catch {
    // 通知の失敗で元の処理を止めない。
    console.error('[ErrorHandler] Failed to notify API error')
  }
}
