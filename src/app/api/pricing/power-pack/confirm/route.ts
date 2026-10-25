// ============================================
// 追加購入の決済の直後に、ドヤパワーを付ける /api/pricing/power-pack/confirm
// ============================================
// Webhook が遅れても、決済の直後に付くようにする保険（同じ決済には1回だけ。sourceKey = purchase:<決済の ID>）。
// ⚠️ 決済の持ち主がログインしている本人のときだけ付ける。旗が off でも、支払い済みの分は付ける（台帳の旗が on のとき）。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { fulfillPowerPackSession } from '@/lib/pricing-v2/power-pack.server'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401, headers: NO_STORE })
    const body = await req.json().catch(() => null)
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''
    if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) return NextResponse.json({ error: '決済を確かめられませんでした。' }, { status: 400, headers: NO_STORE })
    const r = await fulfillPowerPackSession(sessionId, userId)
    if (r.ok) return NextResponse.json({ ok: true, points: r.points, duplicated: r.duplicated }, { headers: NO_STORE })
    const status = r.reason === 'not_paid' ? 409 : r.reason === 'ledger_off' ? 503 : 404
    const error = r.reason === 'not_paid'
      ? 'お支払いの確認がまだ終わっていません。少し待ってから画面を読み込み直してください。'
      : 'ドヤパワーを付けられませんでした。お支払い済みの場合は、重ねて買わずにお問い合わせください。'
    if (r.reason === 'grant_failed' || r.reason === 'ledger_off') console.error(`[pricing/power-pack/confirm] fulfill failed: ${r.reason}`)
    return NextResponse.json({ code: r.reason, error }, { status, headers: NO_STORE })
  } catch {
    console.error('[pricing/power-pack/confirm] confirm failed')
    return NextResponse.json({ error: 'ドヤパワーを付けられたか確認できませんでした。重ねて買わずに、画面を読み込み直してください。' }, { status: 503, headers: NO_STORE })
  }
}
