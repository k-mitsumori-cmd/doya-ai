import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const runtime = 'nodejs'

type PlanCode = 'GUEST' | 'FREE' | 'PRO' | 'ENTERPRISE' | 'UNKNOWN'

function normalizePlan(raw: any): PlanCode {
  const s = String(raw || '').toUpperCase().trim()
  if (s === 'PRO') return 'PRO'
  if (s === 'ENTERPRISE') return 'ENTERPRISE'
  if (s === 'FREE') return 'FREE'
  if (s === 'GUEST') return 'GUEST'
  return 'UNKNOWN'
}

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const isLoggedIn = !!user?.id

    // サービス別プラン（seoPlan）優先 → なければ全体プラン(plan)
    const plan = normalizePlan(user?.seoPlan || user?.plan || (isLoggedIn ? 'FREE' : 'GUEST'))
    const isPaid = plan === 'PRO' || plan === 'ENTERPRISE'

    return NextResponse.json({
      success: true,
      isLoggedIn,
      plan,
      // 完成記事のAI修正チャットは有料のみ
      canUseChatEdit: isLoggedIn && isPaid,
      // 画像生成（図解/サムネ）も有料のみ
      canUseSeoImages: isLoggedIn && isPaid,
    })
  } catch {
    return NextResponse.json({
      success: true,
      isLoggedIn: false,
      plan: 'UNKNOWN',
      canUseChatEdit: false,
      canUseSeoImages: false,
    })
  }
}


