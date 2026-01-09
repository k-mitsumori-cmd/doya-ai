// ========================================
// エラー通知API
// ========================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendErrorNotification } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    console.log('[ErrorNotifyAPI] POST request received')
    const body = await request.json()
    const {
      errorMessage,
      errorStack,
      pathname,
      errorDigest,
      userAgent,
      httpStatus,
      requestMethod,
      requestUrl,
      requestBody,
    } = body

    console.log('[ErrorNotifyAPI] Error data:', {
      errorMessage,
      pathname,
      httpStatus,
    })

    // セッションからユーザー情報を取得
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const userEmail = session?.user?.email || null
    const userName = session?.user?.name || null

    console.log('[ErrorNotifyAPI] User info:', { userId, userEmail, userName })

    // エラー通知を送信（非同期、エラーはログに記録するだけ）
    sendErrorNotification({
      errorMessage: errorMessage || 'Unknown error',
      errorStack,
      pathname,
      userId,
      userEmail,
      userName,
      errorDigest,
      userAgent,
      httpStatus,
      requestMethod,
      requestUrl,
      requestBody: requestBody ? (typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody)) : undefined,
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch((e) => {
      console.error('[ErrorNotifyAPI] Failed to send error notification:', e)
    })

    console.log('[ErrorNotifyAPI] Notification sent (async)')
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[ErrorNotifyAPI] Error notification API error:', e)
    return NextResponse.json(
      { error: 'Failed to send error notification' },
      { status: 500 }
    )
  }
}

