export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCheckoutSession, DOYALIST_PLANS, type DoyalistPlanId } from '@/lib/doyalist/stripe'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { planId } = await req.json()

  if (!planId || !(planId in DOYALIST_PLANS)) {
    return NextResponse.json({ error: '無効なプランです' }, { status: 400 })
  }

  if (planId === 'free') {
    return NextResponse.json({ error: 'Freeプランはチェックアウト不要です' }, { status: 400 })
  }

  try {
    const url = await createCheckoutSession(
      session.user.id,
      planId as DoyalistPlanId,
      session.user.email
    )
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'チェックアウトの作成に失敗しました' }, { status: 500 })
  }
}
