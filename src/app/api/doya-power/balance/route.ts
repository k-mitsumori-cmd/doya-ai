// ============================================
// ドヤパワーの残り（本人の会社だけ）
// ============================================
// GET /api/doya-power/balance → { remaining, limit, byKind, nextRecoveryAt, nextExpiry }
// ⚠️ 旗（DOYA_POWER_ROLLOUT）→ 新しい見た目（isUiNext）→ セッションの本人の会社、の順に確かめる。どれかが違えば 404。
//    旗が off のときは、セッションも台帳も読まずに 404。
// ⚠️ 会社はセッションの本人の会社だけ。query や body の companyId は受け取らない。
// ⚠️ 毎月の付与（有料の人）と毎日の回復は、読むときに足りない分を付ける（cron に頼らない）。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { doyaPowerCharger } from '@/lib/doya-power/charge'
import { doyaPowerRollout } from '@/lib/doya-power/flag'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  if (doyaPowerRollout() === 'off') return NextResponse.json({ error: '見つかりません' }, { status: 404, headers: NO_STORE })
  try {
    const view = await doyaPowerCharger.balanceView()
    if (!view) return NextResponse.json({ error: '見つかりません' }, { status: 404, headers: NO_STORE })
    return NextResponse.json(view, { headers: NO_STORE })
  } catch (e) {
    console.error('[doya-power/balance] failed', { name: (e as { name?: string })?.name, code: (e as { code?: string })?.code })
    return NextResponse.json({ error: 'ドヤパワーの残りを確かめられませんでした。時間をおいて、もう一度お試しください。' }, { status: 503, headers: NO_STORE })
  }
}
