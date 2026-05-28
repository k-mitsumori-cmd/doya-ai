export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

interface EnrichedData {
  businessSummary: string
  painPoints: string[]
  valueProposition: string
  decisionMakers: string[]
  approach: string
}

/**
 * POST /api/doyalist/companies/[id]/enrich
 * 企業情報を Gemini で詳細分析し、enrichedData フィールドに保存
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const id = p.id

    const company = await prisma.doyalistCompany.findUnique({
      where: { id },
      include: { project: { select: { userId: true } } },
    })

    if (!company) {
      return NextResponse.json({ error: '企業が見つかりません' }, { status: 404 })
    }
    if (company.project.userId !== userId) {
      return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })
    }

    const prompt = [
      `${company.name}社（業種: ${company.industry || '不明'}、地域: ${company.region || '不明'}、規模: ${company.size || '不明'}）について、`,
      '営業視点での詳細分析をJSON形式で行ってください。',
      '',
      '出力フィールド:',
      '- businessSummary: 想定される事業概要（200字程度）',
      '- painPoints: 想定される事業課題（3〜5個の配列、各課題は短文）',
      '- valueProposition: 自社サービスを売り込む際の価値提案（150字程度）',
      '- decisionMakers: 商談で接触すべき役職（3〜5個の配列。例: "経営企画部長", "情報システム部マネージャー"）',
      '- approach: 推奨アプローチ方法と切り口（150字程度）',
      '',
      '注意: 出力はJSON1オブジェクトのみ。markdownや余計な文字を含めないこと。',
    ].join('\n')

    let enriched: EnrichedData
    try {
      enriched = await geminiGenerateJson<EnrichedData>({
        prompt,
        model: GEMINI_TEXT_MODEL_DEFAULT,
      })
    } catch (e: any) {
      console.error('[doyalist/companies/[id]/enrich] gemini error', e)
      return NextResponse.json(
        { error: 'AIによる分析に失敗しました。しばらく経ってから再試行してください' },
        { status: 502 }
      )
    }

    // 正規化
    const safe: EnrichedData = {
      businessSummary: String(enriched?.businessSummary || '').slice(0, 1000),
      painPoints: Array.isArray(enriched?.painPoints)
        ? enriched.painPoints.map((s) => String(s)).slice(0, 8)
        : [],
      valueProposition: String(enriched?.valueProposition || '').slice(0, 1000),
      decisionMakers: Array.isArray(enriched?.decisionMakers)
        ? enriched.decisionMakers.map((s) => String(s)).slice(0, 8)
        : [],
      approach: String(enriched?.approach || '').slice(0, 1000),
    }

    const updated = await prisma.doyalistCompany.update({
      where: { id },
      data: { enrichedData: safe as any },
    })

    return NextResponse.json({ success: true, company: updated, enriched: safe })
  } catch (e: any) {
    console.error('[doyalist/companies/[id]/enrich][POST]', e)
    return NextResponse.json(
      { error: e?.message || '企業情報の詳細分析に失敗しました' },
      { status: 500 }
    )
  }
}
