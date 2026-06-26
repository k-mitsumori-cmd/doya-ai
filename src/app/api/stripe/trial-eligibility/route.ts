export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isTrialEligible } from '@/lib/trial'

// GET /api/stripe/trial-eligibility
// 「初月無料」訴求の表示出し分け用。未ログイン訪問者は将来の新規顧客なので eligible:true。
// ログイン済みは Stripe 履歴で判定（再契約者は false）。
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ eligible: true }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { stripeCustomerId: true },
    })
    const eligible = await isTrialEligible({ email: session.user.email, stripeCustomerId: user?.stripeCustomerId })
    return NextResponse.json({ eligible }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    // 判定不能時は訴求を出さない側（false）に倒す（再契約者への誤表示を防ぐ）
    return NextResponse.json({ eligible: false }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
