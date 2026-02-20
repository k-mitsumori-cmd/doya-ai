// ========================================
// エラーハンドリングヘルパー
// ========================================
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendErrorNotification } from './notifications'

/**
 * APIルートでエラーが発生した際に通知を送信するヘルパー関数
 * @param error - エラーオブジェクト
 * @param request - NextRequestオブジェクト
 * @param statusCode - HTTPステータスコード（オプション）
 * @param additionalInfo - 追加情報（オプション）
 */
export async function notifyApiError(
  error: Error | unknown,
  request: NextRequest,
  statusCode?: number,
  additionalInfo?: Record<string, any>
): Promise<void> {
  try {
    console.log('[ErrorHandler] notifyApiError called:', {
      errorMessage: error instanceof Error ? error.message : String(error),
      statusCode,
      pathname: new URL(request.url).pathname,
    })
    // セッションからユーザー情報を取得
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const userEmail = session?.user?.email || null
    const userName = session?.user?.name || null

    // エラー情報を抽出（より詳細に）
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorName = error instanceof Error ? error.name : 'UnknownError'
    const errorCause = error instanceof Error && (error as any).cause ? String((error as any).cause) : undefined
    
    // エラーオブジェクト全体を文字列化（可能な場合）
    let errorDetails = ''
    try {
      if (error instanceof Error) {
        errorDetails = JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: (error as any).cause,
        }, null, 2)
      } else {
        errorDetails = JSON.stringify(error, null, 2)
      }
    } catch {
      errorDetails = String(error)
    }

    // リクエスト情報を取得
    const url = new URL(request.url)
    const pathname = url.pathname
    const method = request.method

    // リクエストボディを取得（可能な場合）
    let requestBody: string | undefined
    try {
      const clonedRequest = request.clone()
      const body = await clonedRequest.text()
      if (body && body.length < 2000) {
        // 長すぎる場合は切り詰め
        requestBody = body.slice(0, 2000)
      }
    } catch {
      // リクエストボディの取得に失敗しても続行
    }

    // エラー通知を送信（非同期、エラーはログに記録するだけ）
    const fullErrorMessage = additionalInfo
      ? `${errorMessage}\n\n追加情報: ${JSON.stringify(additionalInfo, null, 2)}\n\nエラー詳細:\n${errorDetails}`
      : `${errorMessage}\n\nエラー詳細:\n${errorDetails}`
    
    try {
      await sendErrorNotification({
        errorMessage: fullErrorMessage,
        errorStack: errorStack || errorDetails,
        pathname,
        userId,
        userEmail,
        userName,
        httpStatus: statusCode,
        requestMethod: method,
        requestUrl: request.url,
        requestBody,
        timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      })
    } catch (notifyErr) {
      console.error('[ErrorHandler] Failed to send error notification:', notifyErr)
    }
    
    // 非同期で実行するが、ログを出力
    console.log('[ErrorHandler] Error notification initiated')
  } catch (e) {
    // 通知エラーはログに記録するだけ（エラー通知の失敗でさらにエラーを発生させない）
    console.error('Failed to notify API error:', e)
  }
}

