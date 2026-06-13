export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShodanContext, orgSlugFrom } from '@/lib/shodan/access'
import { analyzeCompany, generateProposal, type OwnCompanyProfile } from '@/lib/shodan/ai'
import type { CompanyResearch } from '@/lib/shodan/types'

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

    await prisma.shodanPreparation.update({
      where: { id: prep.id },
      data: { analysis: analysis as any, proposalMarkdown, status: 'done', errorMessage: null },
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
