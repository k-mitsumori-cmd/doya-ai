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

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// POST /api/shodan/preparations/[id]/generate — リサーチ済み案件から「分析→提案資料」を生成
export async function POST(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const sctx = await getShodanContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  // organizationId + id で取得（IDOR防止）
  const prep = await prisma.shodanPreparation.findFirst({ where: { id: p.id, organizationId: sctx.organizationId } })
  if (!prep) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  const research = prep.research as unknown as CompanyResearch | null
  if (!research) return NextResponse.json({ error: '先に企業調査が必要です' }, { status: 400 })

  // 提案資料の生成はプロプラン限定（企業調査までは無料で試せる）
  const user = await prisma.user.findUnique({ where: { id: sctx.userId }, select: { plan: true } })
  if (!isPaidPlan(user?.plan)) {
    return NextResponse.json(
      { error: '提案資料の生成はプロプランの機能です。プロプランにアップグレードするとご利用いただけます。', code: 'PLAN' },
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
    const slides = await generateSlides(research, analysis, own).catch(() => [])

    await prisma.shodanPreparation.update({
      where: { id: prep.id },
      data: { analysis: analysis as any, proposalMarkdown, slidesJson: slides as any, status: 'done', errorMessage: null },
    })
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
  } catch (e: any) {
    console.error('[shodan/generate] failed', e?.message)
    // リサーチは残すため status は 'researched' のまま（再生成可能）。エラーのみ記録。
    await prisma.shodanPreparation.update({
      where: { id: prep.id },
      data: { errorMessage: (e?.message || '提案生成に失敗しました').slice(0, 500) },
    }).catch(() => {})
    return NextResponse.json({ id: prep.id, status: 'researched', error: '提案資料の生成に失敗しました。再生成をお試しください。' }, { status: 500 })
  }
}
