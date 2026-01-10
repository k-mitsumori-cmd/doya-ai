// ========================================
// エラー通知API
// ========================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendErrorNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    console.log('[ErrorNotifyAPI] POST request received')
    
    // リクエストボディの取得を安全に処理
    let body: any = {}
    try {
      const text = await request.text()
      if (text) {
        body = JSON.parse(text)
      }
    } catch (parseError) {
      console.error('[ErrorNotifyAPI] Failed to parse request body:', parseError)
      // パースエラーでも続行
    }

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
    } = body || {}

    console.log('[ErrorNotifyAPI] Error data:', {
      errorMessage: errorMessage || 'No error message',
      pathname: pathname || 'Unknown',
      httpStatus: httpStatus || 'Unknown',
    })

    // セッションからユーザー情報を取得（エラーが発生しても続行）
    let userId: string | undefined
    let userEmail: string | null = null
    let userName: string | null = null
    
    try {
      const session = await getServerSession(authOptions)
      userId = session?.user?.id
      userEmail = session?.user?.email || null
      userName = session?.user?.name || null
    } catch (sessionError) {
      console.warn('[ErrorNotifyAPI] Failed to get session:', sessionError)
      // セッション取得エラーでも続行
    }

    console.log('[ErrorNotifyAPI] User info:', { userId, userEmail, userName })

    // エラー通知を送信（非同期、エラーはログに記録するだけ）
    try {
      await sendErrorNotification({
        errorMessage: errorMessage || 'Unknown error',
        errorStack: errorStack || undefined,
        pathname: pathname || undefined,
        userId,
        userEmail,
        userName,
        errorDigest: errorDigest || undefined,
        userAgent: userAgent || undefined,
        httpStatus: httpStatus || undefined,
        requestMethod: requestMethod || undefined,
        requestUrl: requestUrl || undefined,
        requestBody: requestBody ? (typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody)) : undefined,
        timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      }).catch((e) => {
        console.error('[ErrorNotifyAPI] Failed to send error notification:', e)
      })
    } catch (notificationError) {
      console.error('[ErrorNotifyAPI] Error in sendErrorNotification:', notificationError)
      // 通知エラーでも続行
    }

    console.log('[ErrorNotifyAPI] Notification sent (async)')
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[ErrorNotifyAPI] Error notification API error:', e)
    // エラーが発生しても、可能な限りレスポンスを返す
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to send error notification',
        details: e instanceof Error ? e.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

