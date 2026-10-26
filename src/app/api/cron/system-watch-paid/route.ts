import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { budgetedAgentChecksOnce, budgetedPaidChecks } from '@/lib/system-watch/paid-run'
import { PAID_ENABLED_KEY } from '@/lib/system-watch/paid-checks'
import { PAID_AGENT_ENABLED_KEY, powerLeftFor } from '@/lib/system-watch/agent-checks'
import { DAILY_CAP_YEN, readSpend } from '@/lib/system-watch/budget'
import { runWatch } from '@/lib/system-watch/run'
import { handlePaidRequest, type PaidRouteDeps } from '@/lib/system-watch/paid-route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// ドヤAIの常時確認（有料の API を使う分）
// ⚠️ 従量課金。1日の累計の見込み額が 10円に届いたら、残りは回さない（src/lib/system-watch/budget.ts）。
// GET（毎朝 8:40 の cron）: SystemSetting のスイッチが 'true' のグループだけを回す（どちらも既定は止まっている）。
//    watch:v1:paid-enabled       … 3社の安いモデルに短い文を返させる（1日 約0.02円）
//    watch:v1:paid-agent-enabled … エージェントの B1・B2（1日 約4.2円。2026-10-26 ユーザー承認・1日 約10円まで）
// POST ?once=agent（統括が手で）: B1・B2 だけを、スイッチ2に関係なく1回だけ回す。スイッチは変えない。
//    作った記録の ID と、台帳（枠の数え・構成づくりの回数・ドヤパワー）の前後を返す。中身は src/lib/system-watch/paid-route.ts
// 認証: Authorization: Bearer ${CRON_SECRET}。
// ============================================

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

/**
 * 前後を比べる台帳の写し。本人（SYSTEM_WATCH_TEST_USER_ID）の分だけに絞る（ほかの利用者の同じ時間の操作で差が出ないように）。
 * - 自動点検の記録の ID（watch:v1:marked:）
 * - 見積書の枠の台帳（org-quota:v1:…:<sha256(本人の見積の組織)>:…）
 * - スライドの構成づくりの回数（doyaslide-text-usage:v1:…:<sha256(本人)>）
 */
async function snapshot() {
  const userId = process.env.SYSTEM_WATCH_TEST_USER_ID
  if (!userId) return { settings: {}, powerLeft: null }
  const orgs = await prisma.quoteMember.findMany({ where: { userId, status: 'ACTIVE' }, select: { organizationId: true } }).catch(() => [])
  const mine = [sha256(userId), ...orgs.map(o => sha256(o.organizationId))]
  const rows = await prisma.systemSetting.findMany({
    where: { OR: [{ key: { startsWith: 'watch:v1:marked:' } }, ...mine.map(h => ({ key: { contains: h } }))] },
    select: { key: true, value: true },
  })
  return { settings: Object.fromEntries(rows.map(r => [r.key, r.value])), powerLeft: await powerLeftFor(userId).catch(() => null) }
}

function deps(): PaidRouteDeps {
  return {
    secret: process.env.CRON_SECRET,
    budgetedPaidChecks,
    budgetedAgentChecksOnce,
    runWatch,
    readSpend,
    capYen: DAILY_CAP_YEN,
    switchKeys: [PAID_ENABLED_KEY, PAID_AGENT_ENABLED_KEY],
    snapshot,
  }
}

export async function GET(request: Request) {
  const r = await handlePaidRequest(request, 'GET', deps())
  return NextResponse.json(r.body, { status: r.status })
}

export async function POST(request: Request) {
  const r = await handlePaidRequest(request, 'POST', deps())
  return NextResponse.json(r.body, { status: r.status })
}
