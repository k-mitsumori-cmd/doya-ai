export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShodanContext, orgSlugFrom } from '@/lib/shodan/access'
import { analyzeCompany, generateProposal, generateSlides, type OwnCompanyProfile } from '@/lib/shodan/ai'
import type { CompanyResearch } from '@/lib/shodan/types'
import { isPaidPlan } from '@/lib/unified-plan'
import { recordServiceUsage } from '@/lib/service-usage'
import { getShodanBilling } from '@/lib/shodan/billing'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/shodan/preparations/[id]/generate — リサーチ済み案件から「分析→提案資料」を生成
export async function POST(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const sctx = await getShodanContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  // organizationId + id で取得（IDOR防止）
  const prep = await prisma.shodanPreparation.findFirst({ where: { id: p.id, organizationId: sctx.organizationId } })
  if (!prep) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  const research = prep.research as unknown as CompanyResearch | null
  if (!research) return NextResponse.json({ error: '先に企業調査が必要です' }, { status: 400 })

  // 提案資料の生成はプロプラン限定（企業調査までは無料で試せる）
  const billing = await getShodanBilling(prisma, sctx.organizationId)
  if (!billing) return NextResponse.json({ error: '組織の契約情報を確認できませんでした。時間をおいて再度お試しください。' }, { status: 503 })
  if (!isPaidPlan(billing.plan)) {
    const canManageBilling = sctx.role === 'owner' && sctx.userId === billing.ownerUserId
    return NextResponse.json(
      { error: canManageBilling ? '提案資料の生成はプロプランの機能です。プロプランにアップグレードするとご利用いただけます。' : 'この組織で提案資料を生成するには、組織オーナーのプロプラン契約が必要です。', code: 'PLAN', ...(canManageBilling ? { upgradeUrl: `/shodan/pricing?org=${encodeURIComponent(sctx.organizationSlug)}` } : {}) },
      { status: 402 }
    )
  }

  try {
    const profile = await prisma.shodanCompanyProfile.findUnique({ where: { organizationId: sctx.organizationId } })
    const own: OwnCompanyProfile | null = profile
      ? {
          companyName: profile.companyName, url: profile.url, description: profile.description,
          valueProp: profile.valueProp, products: profile.products, targetCustomer: profile.targetCustomer,
          pricingNote: profile.pricingNote, caseStudies: profile.caseStudies,
        }
      : null

    const analysis = await analyzeCompany(research, own)
    const proposalMarkdown = await generateProposal(research, analysis, own)
    const slides = await generateSlides(research, analysis, own)
    if (typeof proposalMarkdown !== 'string' || !proposalMarkdown.trim() || !Array.isArray(slides) || !slides.length ||
        slides.some((slide) => !slide || typeof slide.title !== 'string' || !slide.title.trim())) {
      throw new Error('提案資料の本文またはスライド構成を取得できませんでした')
    }

    const saved = await prisma.shodanPreparation.updateMany({
      where: { id: prep.id, organizationId: sctx.organizationId, updatedAt: prep.updatedAt },
      data: {
        analysis: analysis as any, proposalMarkdown, slidesJson: slides as any, slideImages: [],
        status: 'done', errorMessage: null,
        updatedAt: new Date(Math.max(Date.now(), prep.updatedAt.getTime() + 1)),
      },
    })
    if (saved.count !== 1) {
      return NextResponse.json({ error: '資料が別の操作で変更されました。再読み込みしてご確認ください。' }, { status: 409 })
    }
    await recordServiceUsage({
      userId: sctx.userId,
      serviceId: 'shodan',
      action: '提案資料生成',
      summary: research?.companyName || prep.id,
      count: Array.isArray(slides) ? slides.length : 0,
      input: { preparationId: prep.id },
      metadata: { organizationId: sctx.organizationId },
    })

    return NextResponse.json({ id: prep.id, status: 'done' })
  } catch {
    console.error('[shodan/generate] failed')
    // 開始時から未変更の資料だけに失敗を記録。既存の本文・画像・状態は保持する。
    await prisma.shodanPreparation.updateMany({
      where: { id: prep.id, organizationId: sctx.organizationId, updatedAt: prep.updatedAt },
      data: { errorMessage: '提案資料の生成に失敗しました。再生成をお試しください。' },
    }).catch(() => {})
    return NextResponse.json({ id: prep.id, error: '提案資料の生成に失敗しました。再生成をお試しください。' }, { status: 500 })
  }
}
