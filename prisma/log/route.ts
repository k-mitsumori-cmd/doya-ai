import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * スワイプログ保存API
 * スワイプ操作のたびに呼ばれる（リアルタイム保存）
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json().catch(() => ({}))
    const { sessionId, swipes } = body

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    if (!Array.isArray(swipes)) {
      return NextResponse.json({ error: 'swipes must be an array' }, { status: 400 })
    }

    // セッションを取得
    const swipeSession = await prisma.swipeSession.findUnique({
      where: { sessionId },
    })

    if (!swipeSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // 権限チェック（本人またはゲストID一致）
    const userId = session?.user?.id
    const guestId = req.cookies.get('guest_id')?.value

    if (
      (userId && swipeSession.userId !== userId) ||
      (!userId && swipeSession.guestId !== guestId)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // スワイプログを更新
    await prisma.swipeSession.update({
      where: { sessionId },
      data: {
        swipes: swipes as any,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[swipe/log] error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
