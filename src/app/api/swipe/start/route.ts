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
    const userId = String((session?.user as any)?.id || '').trim()
    if (!userId) return NextResponse.json({ code: 'LOGIN_REQUIRED', error: 'スワイプ記事を作成するにはログインしてください。' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const { mainKeyword } = body

    if (typeof mainKeyword !== 'string' || !mainKeyword.trim() || mainKeyword.length > 100) {
      return NextResponse.json({ error: 'キーワードは1〜100文字で入力してください。' }, { status: 400 })
    }

    // session_idを生成
    const sessionId = uuidv4()

    // セッションをDBに保存
    await prisma.swipeSession.create({
      data: {
        sessionId,
        userId,
        guestId: null,
        mainKeyword: mainKeyword.trim(),
        swipes: [],
      },
    })

    // 質問ツリー全文を返却
    return NextResponse.json({
      success: true,
      sessionId,
      questions: SWIPE_QUESTIONS,
    })
  } catch (error: any) {
    console.error('[swipe/start] error:', error)
    return NextResponse.json(
      { error: 'スワイプの開始に失敗しました。' },
      { status: 503 }
    )
  }
}
