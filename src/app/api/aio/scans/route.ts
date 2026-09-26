export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAioContext, orgSlugFrom } from '@/lib/aio/access'
import {
  availableEngines,
  effectiveScanStatus,
  type EngineId,
} from '@/lib/aio/types'
import { runAndPersistScan } from '@/lib/aio/run'
import { recordServiceUsage } from '@/lib/service-usage'
import { decodeAioScanCursor, encodeAioScanCursor } from '@/lib/aio/scan-cursor'

// ⚠️ 上限の正本は lib/aio/types.ts。ここに数字を書かない
//    （サイドバーの表示も同じ定義を読む）

// GET /api/aio/scans — スキャン履歴（軽量）
export async function GET(req: NextRequest) {
  const ctx = await getAioContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const rawCursor = req.nextUrl.searchParams.get('cursor')
  let cursor: ReturnType<typeof decodeAioScanCursor> | null = null
  try { if (req.nextUrl.searchParams.has('cursor')) cursor = decodeAioScanCursor(rawCursor || '', ctx.organizationId) }
  catch { return NextResponse.json({ error: '履歴の取得位置が正しくありません。最初から読み直してください。' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } }) }
  const rows = await prisma.aioScan.findMany({
    where: { organizationId: ctx.organizationId, status: { not: 'deleted' }, ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true, status: true, engines: true, repetitions: true,
      awarenessPct: true, shareOfVoice: true, ownCitationPct: true,
      createdAt: true, updatedAt: true,
    },
    take: 61,
  })
  const page = rows.slice(0, 60)
  const items = page.map((r) => ({ ...r, status: effectiveScanStatus(r.status, r.updatedAt) }))
  return NextResponse.json({ items, nextCursor: rows.length > 60 ? encodeAioScanCursor(page[page.length - 1], ctx.organizationId) : null }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}

// POST /api/aio/scans — スキャンを実行（プロンプト×エンジン×反復 → 集計 → 保存）
export async function POST(req: NextRequest) {
  const ctx = await getAioContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const [profile, prompts] = await Promise.all([
    prisma.aioBrandProfile.findUnique({ where: { organizationId: ctx.organizationId } }),
    prisma.aioPrompt.findMany({ where: { organizationId: ctx.organizationId, isActive: true } }),
  ])
  if (!profile?.brandName) return NextResponse.json({ error: '先に追跡ブランドを設定してください' }, { status: 400 })
  if (prompts.length === 0) return NextResponse.json({ error: '監視プロンプトを1件以上登録してください' }, { status: 400 })

  // エンジン：利用可能なもの ∩ リクエスト（未指定なら全部）。実行・永続化は共通関数に委譲。
  const avail = availableEngines()
  if (avail.length === 0) return NextResponse.json({ error: '利用可能なAIエンジンがありません（APIキー未設定）' }, { status: 500 })
  const body = await req.json().catch(() => ({}))
  const requested: EngineId[] | undefined = Array.isArray(body.engines) ? body.engines : undefined

  const result = await runAndPersistScan(ctx.organizationId, { engines: requested })

  if (result.status === 'failed') {
    if (result.code === 'PROMPT_LIMIT') return NextResponse.json({ error: result.error, code: result.code }, { status: 400 })
    if (result.code === 'LIMIT') {
      const canManageBilling = ctx.role === 'owner'
      return NextResponse.json({ error: result.error, code: 'LIMIT', canManageBilling, ...(canManageBilling && result.upgradeAvailable ? { upgradeUrl: '/aio/pricing' } : {}) }, { status: 402 })
    }
    if (result.code === 'BILLING_OWNER') {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 409 })
    }
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
