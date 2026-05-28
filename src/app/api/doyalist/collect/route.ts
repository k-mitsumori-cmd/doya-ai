export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { collectCompanies } from '@/lib/doyalist/collect'
import {
  getUserDoyalistLimits,
  countMonthlyCompanies,
} from '@/lib/doyalist/limits'

/**
 * POST /api/doyalist/collect
 * gBizINFO（経済産業省）+ 法人番号API（国税庁）から実企業を抽出し、
 * DoyalistCompany レコードを作成
 * Body: { projectId: string, count: number }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { projectId } = body || {}
    const rawCount = Number(body?.count ?? 10)
    const requestedCount = Number.isFinite(rawCount) ? Math.floor(rawCount) : 10
    const MAX_COUNT_PER_REQUEST = 20
    const count = Math.max(1, Math.min(MAX_COUNT_PER_REQUEST, requestedCount))
    const wasClamped = requestedCount > MAX_COUNT_PER_REQUEST

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })
    }

    // プロジェクト所有権確認
    const project = await prisma.doyalistProject.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }
    if (project.userId !== userId) {
      return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })
    }

    // プラン上限チェック
    const limits = await getUserDoyalistLimits(userId)
    if (limits.maxCompaniesPerMonth === 0) {
      return NextResponse.json(
        { error: '現在のプランでは企業生成を利用できません' },
        { status: 403 }
      )
    }
    if (limits.maxCompaniesPerMonth > 0) {
      const used = await countMonthlyCompanies(userId)
      if (used + count > limits.maxCompaniesPerMonth) {
        return NextResponse.json(
          {
            error: `月間上限（${limits.maxCompaniesPerMonth}社）を超えます。残り${Math.max(
              0,
              limits.maxCompaniesPerMonth - used
            )}社まで生成可能です`,
          },
          { status: 403 }
        )
      }
    }

    const industry = project.industry || ''
    const region = project.region || ''
    const keywords = (project.keywords || '').split(/[,、 \n]/).map(s => s.trim()).filter(Boolean)

    // 検索キーワード: ユーザー入力 > 業界
    const searchKeywords = keywords.length > 0 ? keywords : (industry ? [industry] : ['企業'])

    let collected: Awaited<ReturnType<typeof collectCompanies>>
    try {
      collected = await collectCompanies({
        criteria: {
          keywords: searchKeywords,
          areas: region && region !== '全国' ? [region] : undefined,
          industries: industry ? [industry] : undefined,
        } as any,
        maxResults: count,
        sources: ['gbizinfo', 'corporate_number'],
      })
    } catch (e: any) {
      console.error('[doyalist/collect] API error', e)
      return NextResponse.json(
        { error: '企業データの取得に失敗しました。しばらく経ってから再試行してください。' },
        { status: 502 }
      )
    }

    if (collected.length === 0) {
      return NextResponse.json(
        { error: '該当する企業が見つかりませんでした。キーワードを変更してお試しください。' },
        { status: 404 }
      )
    }

    // DB保存（実企業データ）
    const rows = collected.slice(0, count).map((c) => {
      const rawBusinessSummary = (c.rawData as any)?.business_summary || (c.rawData as any)?.businessSummary || null
      return {
        projectId,
        name: c.companyName.slice(0, 200),
        website: c.website || null,
        industry: c.industry || project.industry || null,
        region: c.prefecture || project.region || null,
        size: c.employeeCount || project.targetSize || null,
        description: rawBusinessSummary || null,
        contactPerson: c.representative || null,
        // 取得可能データを全て enrichedData に保存
        enrichedData: {
          corporateNumber: c.corporateNumber || null,
          address: c.address || null,
          prefecture: c.prefecture || null,
          representative: c.representative || null,
          capital: c.capital || null,
          employeeCount: c.employeeCount || null,
          foundedYear: c.foundedYear || null,
          businessSummary: rawBusinessSummary,
          industry: c.industry || null,
        },
        score: null,
        status: 'new',
        source: c.source,
      }
    })
    await prisma.doyalistCompany.createMany({ data: rows })

    // 直近作成データを取得して返す（createManyはレコードを返さないため）
    const sourceTypes = ['corporate_number', 'gbizinfo', 'corporate_number+gbizinfo', 'gbizinfo+corporate_number']
    const created = await prisma.doyalistCompany.findMany({
      where: { projectId, source: { in: sourceTypes } },
      orderBy: { createdAt: 'desc' },
      take: rows.length,
    })

    return NextResponse.json({
      success: true,
      generated: created.length,
      companies: created,
      ...(wasClamped ? {
        warning: `1回のリクエストでは最大${MAX_COUNT_PER_REQUEST}社まで生成可能です。${requestedCount}社のリクエストを${count}社に調整しました。`,
      } : {}),
    })
  } catch (e: any) {
    console.error('[doyalist/collect][POST]', e)
    return NextResponse.json(
      { error: e?.message || '企業生成に失敗しました' },
      { status: 500 }
    )
  }
}
