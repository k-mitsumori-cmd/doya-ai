export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAioContext, orgSlugFrom } from '@/lib/aio/access'
import { availableEngines, effectiveScanStatus, type EngineId } from '@/lib/aio/types'
import { runAndPersistScan } from '@/lib/aio/run'
import { isPaidPlan } from '@/lib/unified-plan'
import { recordServiceUsage } from '@/lib/service-usage'

const FREE_SCANS_PER_WEEK = 1

// GET /api/aio/scans — スキャン履歴（軽量）
export async function GET(req: NextRequest) {
  const ctx = await getAioContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const rows = await prisma.aioScan.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, status: true, engines: true, repetitions: true,
      awarenessPct: true, shareOfVoice: true, ownCitationPct: true,
      createdAt: true, updatedAt: true,
    },
    take: 60,
  })
  const items = rows.map((r) => ({ ...r, status: effectiveScanStatus(r.status, r.updatedAt) }))
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/aio/scans — スキャンを実行（プロンプト×エンジン×反復 → 集計 → 保存）
export async function POST(req: NextRequest) {
  const ctx = await getAioContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const [profile, prompts, user] = await Promise.all([
    prisma.aioBrandProfile.findUnique({ where: { organizationId: ctx.organizationId } }),
    prisma.aioPrompt.findMany({ where: { organizationId: ctx.organizationId, isActive: true } }),
    prisma.user.findUnique({ where: { id: ctx.userId }, select: { plan: true } }),
  ])
  if (!profile?.brandName) return NextResponse.json({ error: '先に追跡ブランドを設定してください' }, { status: 400 })
  if (prompts.length === 0) return NextResponse.json({ error: '監視プロンプトを1件以上登録してください' }, { status: 400 })

  // プラン制限（無料は週1回）
  const paid = isPaidPlan(user?.plan)
  if (!paid) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recent = await prisma.aioScan.count({
      where: { organizationId: ctx.organizationId, createdAt: { gte: weekAgo }, status: { not: 'failed' } },
    })
    if (recent >= FREE_SCANS_PER_WEEK) {
      return NextResponse.json(
        { error: '無料プランは週1回までスキャンできます。プロプランで頻度無制限になります。', code: 'LIMIT' },
        { status: 402 }
      )
    }
  }

  // エンジン：利用可能なもの ∩ リクエスト（未指定なら全部）。実行・永続化は共通関数に委譲。
  const avail = availableEngines()
  if (avail.length === 0) return NextResponse.json({ error: '利用可能なAIエンジンがありません（APIキー未設定）' }, { status: 500 })
  const body = await req.json().catch(() => ({}))
  const requested: EngineId[] | undefined = Array.isArray(body.engines) ? body.engines : undefined

  const result = await runAndPersistScan(ctx.organizationId, { engines: requested })

  if (result.status === 'failed') {
    // 実行中での二重起動は409（コスト暴発防止のための連打ガード）。ユーザー操作なので生メッセージを返す。
    if (result.code === 'INFLIGHT') {
      return NextResponse.json({ id: result.id, status: 'processing', error: result.error, code: 'INFLIGHT' }, { status: 409 })
    }
    return NextResponse.json(
      { id: result.id, status: 'failed', error: 'スキャンに失敗しました。時間をおいて再実行してください。' },
      { status: 500 }
    )
  }
  await recordServiceUsage({
    userId: ctx.userId,
    serviceId: 'aio',
    action: 'AI可視性スキャン',
    summary: profile.brandName,
    count: prompts.length,
    input: { engines: requested ?? avail, promptCount: prompts.length },
    metadata: { scanId: result.id, organizationId: ctx.organizationId },
  })

  return NextResponse.json({
    id: result.id,
    status: 'done',
    summary: result.summary,
    recommendations: result.recommendations,
  })
}
