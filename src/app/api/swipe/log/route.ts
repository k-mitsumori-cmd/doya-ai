import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { SwipeLogsSchema } from '@/lib/swipe-request'

/**
 * スワイプログ保存API
 * スワイプ操作のたびに呼ばれる（リアルタイム保存）
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = String((session?.user as any)?.id || '').trim()
    if (!userId) return NextResponse.json({ code: 'LOGIN_REQUIRED', error: 'スワイプを保存するにはログインしてください。' }, { status: 401 })
    const parsed = z.object({ sessionId: z.string().uuid(), swipes: SwipeLogsSchema }).safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'スワイプ内容を確認してください。' }, { status: 400 })
    const { sessionId, swipes } = parsed.data

    // セッションを取得
    const swipeSession = await prisma.swipeSession.findUnique({
      where: { sessionId },
    })

    if (!swipeSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // セッションの所有者のみ更新できる。
    if (swipeSession.userId !== userId) {
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
      { error: 'スワイプの保存に失敗しました。' },
      { status: 503 }
    )
  }
}
