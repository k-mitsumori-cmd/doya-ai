// ========================================
// エラー通知API
// ========================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendErrorNotification } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { errorMessage, errorStack, pathname, errorDigest, userAgent } = body

    // セッションからユーザー情報を取得
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const userEmail = session?.user?.email || null
    const userName = session?.user?.name || null

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
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch((e) => {
      console.error('Failed to send error notification:', e)
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Error notification API error:', e)
    return NextResponse.json(
      { error: 'Failed to send error notification' },
      { status: 500 }
    )
  }
}

