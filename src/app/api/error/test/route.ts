// ========================================
// エラー通知テストAPI
// ========================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendErrorNotification } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    console.log('[ErrorTestAPI] Test notification requested')
    
    // セッションからユーザー情報を取得
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const userEmail = session?.user?.email || null
    const userName = session?.user?.name || null

    // テスト用のエラー通知を送信
    await sendErrorNotification({
      errorMessage: 'テスト通知: これはSlack通知のテストです',
      pathname: '/api/error/test',
      userId,
      userEmail,
      userName,
      httpStatus: 200,
      requestMethod: 'POST',
      requestUrl: request.url,
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    })

    return NextResponse.json({ 
      success: true,
      message: 'テスト通知を送信しました。Slackを確認してください。',
    })
  } catch (e: any) {
    console.error('[ErrorTestAPI] Test notification error:', e)
    return NextResponse.json(
      { 
        error: 'テスト通知の送信に失敗しました',
        details: e.message,
      },
      { status: 500 }
    )
  }
}

