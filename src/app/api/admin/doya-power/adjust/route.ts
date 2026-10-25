// ============================================
// 運営がドヤパワーを手で付ける（お詫び・調整） /api/admin/doya-power/adjust
// ============================================
// ⚠️ 管理者の認証（admin_session_token）が要る。ドヤパワーの台帳の旗（DOYA_POWER_ROLLOUT）が off なら 404。
// ⚠️ 付ける先は、メールで指定した利用者が持ち主の会社だけ。量は 1〜10,000。
// ⚠️ 同じ依頼 ID（requestId）では1回だけ付く（押し直しで二重に付かない）。種類は purchase と同じ扱いで、6か月で切れる。
// 減らす操作は作らない（間違えて減らすと取り返せないため。減らす必要があれば台帳の取引を確かめてから個別に行う）。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { doyaPowerLedgerAllowed } from '@/lib/doya-power/flag'
import { normalizeEmail } from '@/lib/pricing-v2/team'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })
const MAX_POINTS = 10_000

export async function POST(req: NextRequest) {
  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) return json({ error: '管理者認証が必要です' }, 401)
    if (!doyaPowerLedgerAllowed()) return json({ error: 'ドヤパワーは有効になっていません。' }, 404)
    const body = await req.json().catch(() => null)
    const email = normalizeEmail(body?.email)
    const points = body?.points
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 80) : ''
    const requestId = typeof body?.requestId === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(body.requestId) ? body.requestId : null
    if (!email || !Number.isInteger(points) || points < 1 || points > MAX_POINTS || !reason || !requestId) {
      return json({ error: `メール・量（1〜${MAX_POINTS}）・理由・依頼 ID を確かめてください。` }, 400)
    }
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })
    const company = user ? await prisma.accountCompany.findUnique({ where: { userId: user.id }, select: { id: true } }) : null
    if (!company) return json({ error: 'この利用者の会社が見つかりません（会社の登録が要ります）。' }, 404)
    const { grant } = await import('@/lib/doya-power')
    const r = await grant(company.id, 'purchase', points, null, { sourceKey: `admin-adjust:${requestId}`, note: `admin:${reason}` })
    if (!r.ok) return json({ error: 'ドヤパワーを付けられませんでした。' }, 409)
    return json({ ok: true, granted: r.granted, duplicated: r.duplicated, balance: r.balance })
  } catch {
    console.error('[admin/doya-power/adjust] failed')
    return json({ error: 'ドヤパワーを付けられませんでした。' }, 500)
  }
}
