// Replay the original purchase; never mint an unrelated administrative adjustment.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { stripe } from '@/lib/stripe'
import { doyaPowerLedgerAllowed } from '@/lib/doya-power/flag'
import { fulfillPowerPackSession, POWER_PACK_KIND } from '@/lib/pricing-v2/power-pack.server'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

/** Explicit administrator recovery, including after the customer's return URL or webhook retry window is gone. */
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get('origin')
    if (origin && origin !== new URL(req.url).origin) return json({ error: 'この画面からは実行できません。' }, 403)
    const token = (await cookies()).get(COOKIE_NAME)?.value
    const { valid, adminUser } = await verifyAdminSession(token || null)
    if (!valid || !adminUser) return json({ error: '管理者認証が必要です。' }, 401)
    if (!doyaPowerLedgerAllowed()) return json({ error: 'ドヤパワーは現在停止しています。再開後に同じ決済IDで再実行してください。' }, 503)
    const body = await req.json().catch(() => null)
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''
    const companyId = typeof body?.companyId === 'string' ? body.companyId.trim() : ''
    if (body?.apply !== true || !/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId) || !/^[A-Za-z0-9_-]{1,200}$/.test(companyId)) {
      return json({ error: '元の決済ID・会社ID・実行指定を確かめてください。' }, 400)
    }
    // Pin the operator's intended company before fulfillment can persist anything.
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.id !== sessionId || session.mode !== 'payment' || session.metadata?.app !== 'doya-ai' || session.metadata?.kind !== POWER_PACK_KIND || session.metadata?.companyId !== companyId) {
      return json({ error: '指定した会社の追加購入を確認できませんでした。' }, 404)
    }
    // The shared function checks company ownership, line item, amount, currency,
    // current Charge refunds, and immutable receipt binding before granting.
    const result = await fulfillPowerPackSession(session)
    if (!result.ok) return json({ error: '購入を反映できませんでした。同じ決済IDで確認し直してください。', code: result.reason }, result.reason === 'not_paid' ? 409 : result.reason === 'ledger_off' || result.reason === 'grant_failed' ? 503 : 404)
    return json({ ok: true, points: result.points, refundedPoints: result.refundedPoints, duplicated: result.duplicated })
  } catch {
    console.error('[admin/doya-power/purchase/replay] failed')
    return json({ error: '購入の復旧を確認できませんでした。量を指定した調整付与はせず、同じ決済IDで再確認してください。' }, 503)
  }
}
