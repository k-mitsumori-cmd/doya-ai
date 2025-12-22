import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

type PlanCode = 'FREE' | 'PRO' | 'ENTERPRISE' | 'UNKNOWN'

function normalizePlan(raw: any): PlanCode {
  const s = String(raw || '').toUpperCase()
  if (s === 'PRO') return 'PRO'
  if (s === 'ENTERPRISE') return 'ENTERPRISE'
  if (s === 'FREE') return 'FREE'
  return 'UNKNOWN'
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user: any = session?.user || null

  // サービス別プラン（seoPlan）があれば優先。なければ全体プラン(plan)でフォールバック。
  const plan = normalizePlan(user?.seoPlan || user?.plan || (user ? 'FREE' : 'UNKNOWN'))
  const isLoggedIn = !!user

  const isPaid = plan === 'PRO' || plan === 'ENTERPRISE'

  return NextResponse.json({
    success: true,
    isLoggedIn,
    plan,
    // 完成記事のAI修正チャットは有料のみ
    canUseChatEdit: isPaid,
    // 画像生成（図解/サムネ）も有料のみ（要望）
    canUseSeoImages: isPaid,
  })
}


