export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShodanContext, orgSlugFrom } from '@/lib/shodan/access'
import { researchCompany } from '@/lib/shodan/research'
import { effectivePrepStatus, PREP_STALE_MS, SHODAN_MONTHLY_LIMIT } from '@/lib/shodan/types'
import { jstStartOfMonthUtc } from '@/lib/plan-limit'

// 統一プラン：有料判定
function isPaidPlan(plan?: string | null): boolean {
  const p = (plan || 'FREE').toUpperCase()
  return p !== 'FREE' && p !== 'GUEST'
}
// ⚠️ 上限の正本は lib/shodan/types.ts。ここに数字を書かない
//    （サイドバーの表示も同じ定義を読む）

function normalizeUrl(input: string): string | null {
  let s = (input || '').trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

// GET /api/shodan/preparations — 一覧（成果物本文は含めず軽量に）
export async function GET(req: NextRequest) {
  const ctx = await getShodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const rows = await prisma.shodanPreparation.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, targetUrl: true, targetName: true, status: true, createdAt: true, updatedAt: true },
    take: 100,
  })
  const items = rows.map((r) => ({ ...r, status: effectivePrepStatus(r.status, r.updatedAt) }))
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/shodan/preparations — URLを起点に「リサーチ→分析→提案」を一括実行
export async function POST(req: NextRequest) {
  const ctx = await getShodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const targetUrl = normalizeUrl(body.url as string)
  if (!targetUrl) return NextResponse.json({ error: '有効なURLを入力してください' }, { status: 400 })

  // プラン制限（組織単位・月次）
  // ⚠️ 有料プランにも上限を置く。1件ごとにサイト巡回とAI呼び出しの実費が出るため、
  //    無制限にすると月額を上回る使われ方を止められない。
  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { plan: true } })
  {
    const limit = isPaidPlan(user?.plan)
      ? String(user?.plan || '').toUpperCase() === 'ENTERPRISE'
        ? SHODAN_MONTHLY_LIMIT.ENTERPRISE
        : SHODAN_MONTHLY_LIMIT.PRO
      : SHODAN_MONTHLY_LIMIT.FREE
    // ⚠️ 月の区切りは JST。サーバのローカル時刻（Vercelでは UTC）で数えると、
    //    毎月1日の 0:00〜9:00 JST に実行したぶんが前月に計上され、
    //    サイドバーの表示（JST基準）と食い違う。
    const since = jstStartOfMonthUtc()
    // done（成功）＋ 実行中(processing で stale でないもの) を数える。
    // - 同時POSTでも作成直後から枠を占有し抜け道を塞ぐ
    // - failed は非消費／タイムアウトで詰まった stale processing も除外（GETされず放置されても無料枠を恒久消費しない）
    const staleBefore = new Date(Date.now() - PREP_STALE_MS)
    const usedThisMonth = await prisma.shodanPreparation.count({
      where: {
        organizationId: ctx.organizationId,
        createdAt: { gte: since },
        OR: [
          { status: 'done' },
          { status: 'researched' },
          { status: 'processing', updatedAt: { gte: staleBefore } },
        ],
      },
    })
    if (usedThisMonth >= limit) {
      // ⚠️ 既に支払っている方に「プロにご登録を」と返さないこと
      const reason = isPaidPlan(user?.plan)
        ? `今月の上限（${limit}件）に達しました。来月1日に枠が戻ります。追加をご希望の場合はお問い合わせよりご相談ください。`
        : `無料プランは月${limit}件までです。プロプランにご登録いただくと上限が広がります。`
      return NextResponse.json({ error: reason, code: 'LIMIT' }, { status: 402 })
    }
  }

  // 案件を作成（処理中＝リサーチ実行中）
  const prep = await prisma.shodanPreparation.create({
    data: { organizationId: ctx.organizationId, createdByMemberId: ctx.memberId, targetUrl, status: 'processing' },
  })

  try {
    // フェーズ1: 深掘りリサーチのみ（提案生成は /[id]/generate で実行）。
    // リサーチ結果を即返すことで、画面に「実際に調べた内容」を表示できる。
    const research = await researchCompany(targetUrl)
    await prisma.shodanPreparation.update({
      where: { id: prep.id },
      data: { research: research as any, targetName: research.companyName || null, status: 'researched' },
    })
    return NextResponse.json({ id: prep.id, status: 'researched', research })
  } catch (e: any) {
    console.error('[shodan/preparations] research failed', e?.message)
    await prisma.shodanPreparation.update({
      where: { id: prep.id },
      data: { status: 'failed', errorMessage: (e?.message || '調査に失敗しました').slice(0, 500) },
    }).catch(() => {})
    return NextResponse.json({ id: prep.id, status: 'failed', error: '企業調査に失敗しました。URLを確認して再実行してください。' }, { status: 500 })
  }
}
