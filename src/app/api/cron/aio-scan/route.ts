export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runAndPersistScan } from '@/lib/aio/run'

// 1回の実行で処理する組織数の上限（多数組織でのタイムアウト回避）。
// 直近スキャンが古い順に処理し、超過分は次回以降に回す（ログに残す）。
const MAX_ORGS_PER_RUN = 10

// 有料プラン判定（scans/route.ts と同一ロジック）。定期スキャンは有料組織のみ対象にし、
// 無料組織の自動課金（手動は週1制限なのにcronが貫通する問題）を防ぐ。
function isPaidPlan(plan?: string | null): boolean {
  const p = (plan || 'FREE').toUpperCase()
  return p !== 'FREE' && p !== 'GUEST'
}

// ============================================
// ドヤAIO 定期スキャン（週1回想定）
// ブランド設定済み かつ アクティブプロンプトが1件以上ある組織を対象に、
// runAndPersistScan を1組織ずつ直列実行する。1組織が失敗しても続行。
// ============================================
export async function GET(request: Request) {
  // Vercel Cron からの呼び出しを認証（既存cronと同じ方式）
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 対象組織: ブランド名設定済み かつ アクティブなプロンプトが1件以上
    const rawCandidates = await prisma.aioOrganization.findMany({
      where: {
        profile: { brandName: { not: null } },
        prompts: { some: { isActive: true } },
      },
      select: {
        id: true,
        slug: true,
        // オーナー（請求主体）の userId。プラン判定に使う。
        members: {
          where: { role: 'owner', status: 'ACTIVE', userId: { not: null } },
          select: { userId: true },
          take: 1,
        },
        // 最後のスキャン日時を取得（古い順に処理するため）
        scans: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    })

    // 有料プランのオーナーがいる組織だけを定期スキャン対象にする（無料の自動課金を防止）。
    // AioMember に user リレーションが無いため、オーナーの userId → User.plan を別引きする。
    const ownerIds = Array.from(
      new Set(rawCandidates.map((o) => o.members[0]?.userId).filter((v): v is string => !!v))
    )
    const paidUserIds = new Set(
      ownerIds.length
        ? (
            await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, plan: true } })
          )
            .filter((u) => isPaidPlan(u.plan))
            .map((u) => u.id)
        : []
    )
    const candidates = rawCandidates.filter((o) => {
      const oid = o.members[0]?.userId
      return !!oid && paidUserIds.has(oid)
    })
    const skippedFree = rawCandidates.length - candidates.length

    // 直近スキャンが古い順（未スキャンは最優先）にソート
    const sorted = candidates.sort((a, b) => {
      const at = a.scans[0]?.createdAt?.getTime() ?? 0
      const bt = b.scans[0]?.createdAt?.getTime() ?? 0
      return at - bt
    })

    const targets = sorted.slice(0, MAX_ORGS_PER_RUN)
    const deferred = sorted.slice(MAX_ORGS_PER_RUN)

    // 上限超過分はサイレント切り捨てせずログに残す
    if (deferred.length > 0) {
      console.warn(
        `[cron/aio-scan] ${candidates.length}組織が対象。上限${MAX_ORGS_PER_RUN}件のため${deferred.length}件を次回に繰り越し: ${deferred
          .map((o) => o.slug)
          .join(', ')}`
      )
    }

    let success = 0
    let failed = 0
    const results: { organizationId: string; slug: string; status: string; error?: string }[] = []

    // 1組織ずつ直列実行（1組織が失敗しても他を続行）
    for (const org of targets) {
      try {
        // 反復回数は共通。定期スキャンは全組織同条件で実行する。
        const r = await runAndPersistScan(org.id)
        if (r.status === 'done') success++
        else failed++
        results.push({ organizationId: org.id, slug: org.slug, status: r.status, error: r.error })
      } catch (e: any) {
        failed++
        console.error(`[cron/aio-scan] 組織 ${org.slug} で例外`, e?.message)
        results.push({ organizationId: org.id, slug: org.slug, status: 'failed', error: e?.message })
      }
    }

    return NextResponse.json({
      success: true,
      totalCandidates: rawCandidates.length,
      paidCandidates: candidates.length,
      skippedFree,
      processed: targets.length,
      deferred: deferred.length,
      succeeded: success,
      failed,
      results,
    })
  } catch (error: any) {
    console.error('[cron/aio-scan] error:', error?.message)
    return NextResponse.json({ error: error?.message || 'aio-scan cron failed' }, { status: 500 })
  }
}
