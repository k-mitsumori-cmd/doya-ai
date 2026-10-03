export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runAndPersistScan } from '@/lib/aio/run'
import { isPaidPlan } from '@/lib/unified-plan'
import { scanQuota } from '@/lib/aio/quota'
import { SCAN_STALE_MS } from '@/lib/aio/types'

// One scan commonly takes minutes. Keep each cron invocation within its 300-second budget.
const MAX_SCANS_PER_RUN = 1
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const FAILED_RETRY_MS = 24 * 60 * 60 * 1000

// 有料プラン判定は unified-plan.ts の単一ソース isPaidPlan を使用（定期スキャンは有料組織のみ対象）。

// ============================================
// ドヤAIO 定期スキャン（各組織は7日以上空けて測定）
// ブランド設定済み かつ アクティブプロンプトが1件以上ある組織を対象に、
// 6時間ごとの枠で古い組織から1件ずつ処理する。
// ============================================
export async function GET(request: Request) {
  // Vercel Cron からの呼び出しを認証（既存cronと同じ方式）
  // ⚠️ CRON_SECRET が未設定だとテンプレートが "Bearer undefined" になり、
  //    その文字列を送れば通ってしまう。未設定なら動かさないこと。
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - WEEK_MS)
    const retryAfter = new Date(now.getTime() - FAILED_RETRY_MS)
    const staleBefore = new Date(now.getTime() - SCAN_STALE_MS)
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
          take: 2,
        },
        // 最後のスキャン日時を取得（古い順に処理するため）
        scans: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true, updatedAt: true, status: true },
        },
      },
    })

    // 有料プランのオーナーがいる組織だけを定期スキャン対象にする（無料の自動課金を防止）。
    // AioMember に user リレーションが無いため、オーナーの userId → User.plan を別引きする。
    const ownerIds = Array.from(
      new Set(rawCandidates.map((o) => o.members[0]?.userId).filter((v): v is string => !!v))
    )
    const ownerPlans = new Map(ownerIds.length
      ? (await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, plan: true } }))
        .map((user) => [user.id, user.plan] as const)
      : [])
    const candidates = rawCandidates.filter((o) => {
      const oid = o.members[0]?.userId
      return o.members.length === 1 && !!oid && isPaidPlan(ownerPlans.get(oid))
    })
    const skippedIneligible = rawCandidates.length - candidates.length

    const organizationIds = candidates.map((org) => org.id)
    const [recentCompleted, usedRows] = organizationIds.length ? await Promise.all([
      prisma.aioScan.findMany({
        where: { organizationId: { in: organizationIds }, status: { in: ['done', 'deleted'] }, createdAt: { gt: weekAgo } },
        select: { organizationId: true },
        distinct: ['organizationId'],
      }),
      prisma.aioScan.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: organizationIds }, createdAt: { gte: scanQuota('PRO', now).since }, OR: [
          { status: { in: ['done', 'deleted'] } },
          { status: 'processing', updatedAt: { gte: staleBefore } },
        ] },
        _count: { _all: true },
      }),
    ]) : [[], []]
    const completedRecently = new Set(recentCompleted.map((row) => row.organizationId))
    const usedByOrg = new Map(usedRows.map((row) => [row.organizationId, row._count._all]))
    const due = candidates.filter((org) => {
      if (completedRecently.has(org.id)) return false
      const plan = ownerPlans.get(org.members[0]!.userId!)
      if ((usedByOrg.get(org.id) ?? 0) >= scanQuota(plan, now).limit) return false
      const last = org.scans[0]
      if (last?.status === 'failed' && last.createdAt > retryAfter) return false
      if (last?.status === 'processing' && last.updatedAt > staleBefore) return false
      return true
    })
    // 直近スキャンが古い順（未スキャンは最優先）にソート
    const sorted = due.sort((a, b) => {
      const at = a.scans[0]?.createdAt?.getTime() ?? 0
      const bt = b.scans[0]?.createdAt?.getTime() ?? 0
      return at - bt
    })

    let success = 0
    let failed = 0
    let skippedPreflight = 0
    let processed = 0
    const results: { organizationId: string; slug: string; status: string; error?: string }[] = []

    // A preflight rejection has no scan ID and does not occupy this invocation's scan slot.
    for (const org of sorted) {
      if (processed >= MAX_SCANS_PER_RUN) break
      try {
        const r = await runAndPersistScan(org.id, { scheduled: true })
        if (!r.id || r.code === 'INFLIGHT') {
          skippedPreflight++
          results.push({ organizationId: org.id, slug: org.slug, status: 'skipped' })
          continue
        }
        processed++
        if (r.status === 'done') success++
        else failed++
        results.push({ organizationId: org.id, slug: org.slug, status: r.status,
          ...(r.status === 'done' ? {} : { error: 'スキャンに失敗しました' }) })
      } catch (e: any) {
        processed++
        failed++
        console.error("[api/cron/aio-scan] failed")
        results.push({ organizationId: org.id, slug: org.slug, status: 'failed', error: 'スキャンに失敗しました' })
      }
    }

    const deferred = sorted.length - processed - skippedPreflight
    if (deferred > 0) console.warn(`[cron/aio-scan] ${deferred}組織を次回に繰り越し`)

    return NextResponse.json({
      success: true,
      totalCandidates: rawCandidates.length,
      paidCandidates: candidates.length,
      skippedIneligible,
      due: due.length,
      processed,
      skippedPreflight,
      deferred,
      succeeded: success,
      failed,
      results,
    })
  } catch (error: any) {
    console.error('[cron/aio-scan] error:')
    return NextResponse.json({ error: '定期スキャンを完了できませんでした' }, { status: 500 })
  }
}
