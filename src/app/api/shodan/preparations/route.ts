export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShodanContext, orgSlugFrom } from '@/lib/shodan/access'
import { researchCompany } from '@/lib/shodan/research'
import { analyzeCompany, generateProposal, type OwnCompanyProfile } from '@/lib/shodan/ai'
import { effectivePrepStatus, PREP_STALE_MS } from '@/lib/shodan/types'

// 統一プラン：有料判定
function isPaidPlan(plan?: string | null): boolean {
  const p = (plan || 'FREE').toUpperCase()
  return p !== 'FREE' && p !== 'GUEST'
}
const FREE_MONTHLY_LIMIT = 5

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

  // プラン制限（無料は月5件まで／組織単位）
  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { plan: true } })
  if (!isPaidPlan(user?.plan)) {
    const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0)
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
          { status: 'processing', updatedAt: { gte: staleBefore } },
        ],
      },
    })
    if (usedThisMonth >= FREE_MONTHLY_LIMIT) {
      return NextResponse.json(
        { error: `無料プランは月${FREE_MONTHLY_LIMIT}件までです。プロプランで無制限にご利用いただけます。`, code: 'LIMIT' },
        { status: 402 }
      )
    }
  }

  // 案件を作成（処理中）
  const prep = await prisma.shodanPreparation.create({
    data: { organizationId: ctx.organizationId, createdByMemberId: ctx.memberId, targetUrl, status: 'processing' },
  })

  try {
    // 1) 深掘りリサーチ
    const research = await researchCompany(targetUrl)
    await prisma.shodanPreparation.update({
      where: { id: prep.id },
      data: { research: research as any, targetName: research.companyName || null },
    })

    // 2) 自社情報を読み込み（提案最適化のため）
    const profile = await prisma.shodanCompanyProfile.findUnique({ where: { organizationId: ctx.organizationId } })
    const own: OwnCompanyProfile | null = profile
      ? {
          companyName: profile.companyName, url: profile.url, description: profile.description,
          valueProp: profile.valueProp, products: profile.products, targetCustomer: profile.targetCustomer,
          pricingNote: profile.pricingNote, caseStudies: profile.caseStudies,
        }
      : null

    // 3) 現状分析・課題仮説・解決策
    const analysis = await analyzeCompany(research, own)

    // 4) 提案資料（Markdown）
    const proposalMarkdown = await generateProposal(research, analysis, own)

    const done = await prisma.shodanPreparation.update({
      where: { id: prep.id },
      data: { analysis: analysis as any, proposalMarkdown, status: 'done' },
    })
    return NextResponse.json({ id: done.id, status: 'done' })
  } catch (e: any) {
    console.error('[shodan/preparations] pipeline failed', e?.message)
    await prisma.shodanPreparation.update({
      where: { id: prep.id },
      data: { status: 'failed', errorMessage: (e?.message || '生成に失敗しました').slice(0, 500) },
    }).catch(() => {})
    return NextResponse.json({ id: prep.id, status: 'failed', error: '準備の生成に失敗しました。URLを確認して再実行してください。' }, { status: 500 })
  }
}
