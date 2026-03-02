import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { SWIPE_QUESTIONS } from '@seo/lib/swipe-questions'
import { v4 as uuidv4 } from 'uuid'

/**
 * スワイプセッション開始API
 * - session_id（UUID）を発行
 * - 質問ツリー全文を返却
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json().catch(() => ({}))
    const { mainKeyword } = body

    if (!mainKeyword || typeof mainKeyword !== 'string' || !mainKeyword.trim()) {
      return NextResponse.json({ error: 'mainKeyword is required' }, { status: 400 })
    }

    // session_idを生成
    const sessionId = uuidv4()

    // ゲストIDを取得（未ログイン時）
    const guestId = session?.user?.id
      ? undefined
      : req.cookies.get('guest_id')?.value || uuidv4()

    // セッションをDBに保存
    const swipeSession = await prisma.swipeSession.create({
      data: {
        sessionId,
        userId: session?.user?.id || null,
        guestId: session?.user?.id ? null : guestId,
        mainKeyword: mainKeyword.trim(),
        swipes: [],
      },
    })

    // 質問ツリー全文を返却
    return NextResponse.json({
      success: true,
      sessionId,
      questions: SWIPE_QUESTIONS,
      guestId: session?.user?.id ? undefined : guestId,
    })
  } catch (error: any) {
    console.error('[swipe/start] error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
