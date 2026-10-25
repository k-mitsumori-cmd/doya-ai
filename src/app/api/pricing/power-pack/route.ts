// ============================================
// ドヤパワーの追加購入の Checkout を作る /api/pricing/power-pack
// ============================================
// ⚠️ 旗 NEW_PRICING_ROLLOUT と、ドヤパワーの台帳の旗（DOYA_POWER_ROLLOUT）の両方の内側。どちらかが off なら 404。
// 付与は src/lib/pricing-v2/power-pack.server.ts（決済の直後の確認と Webhook の2経路。同じ決済には1回だけ）。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isNewPricingEnabledFor } from '@/lib/pricing-v2/rollout'
import { createPowerPackCheckout } from '@/lib/pricing-v2/power-pack.server'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id
    const email = session?.user?.email ?? null
    if (!userId || !email) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401, headers: NO_STORE })
    if (!isNewPricingEnabledFor(email)) return NextResponse.json({ error: '見つかりません。' }, { status: 404, headers: NO_STORE })
    const body = await req.json().catch(() => null)
    const baseUrl = String(process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).trim().replace(/\/+$/, '')
    const r = await createPowerPackCheckout({ userId, email, packs: body?.packs, baseUrl })
    if (!r.ok) return NextResponse.json({ code: r.code, error: r.error }, { status: r.status, headers: NO_STORE })
    return NextResponse.json({ url: r.url, sessionId: r.sessionId }, { headers: NO_STORE })
  } catch {
    console.error('[pricing/power-pack] checkout failed')
    return NextResponse.json({ error: '決済画面を開けませんでした。時間をおいて再度お試しください。' }, { status: 500, headers: NO_STORE })
  }
}
