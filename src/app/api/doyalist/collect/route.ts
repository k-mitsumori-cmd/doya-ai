export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { collectCompaniesDetailed } from '@/lib/doyalist/collect'
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
    const MAX_COUNT_PER_REQUEST = 10000 // 1回最大10,000社（Vercel maxDuration=300s以内）
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
    const userKeywords = (project.keywords || '').split(/[,、 \n]/).map(s => s.trim()).filter(Boolean)

    // 業界からgBizINFO検索向けの代表キーワードを生成
    const INDUSTRY_FALLBACK_KEYWORDS: Record<string, string[]> = {
      'IT・ソフトウェア': ['システム', 'ソフトウェア', 'IT'],
      '製造業': ['製造', '工業', '製作'],
      '小売・EC': ['販売', '商事', 'リテール'],
      '医療・介護': ['医療', '介護', 'ヘルスケア'],
      '教育': ['学習', '教育', 'スクール'],
      '金融・保険': ['金融', '保険'],
      '不動産': ['不動産', '住宅'],
      '飲食': ['フード', '食品', '飲食'],
      '物流': ['物流', '運輸', '配送'],
      '建設': ['建設', '建築', '工務'],
      'コンサル': ['コンサルティング', 'コンサル'],
      '広告・マーケ': ['広告', 'マーケティング', 'プロモーション'],
      '人材': ['人材', 'リクルート', 'スタッフ'],
      'その他': ['株式会社'],
    }

    // 検索キーワード: ユーザー入力 > 業界フォールバック > 汎用
    const searchKeywords = userKeywords.length > 0
      ? userKeywords
      : (industry && INDUSTRY_FALLBACK_KEYWORDS[industry]
          ? INDUSTRY_FALLBACK_KEYWORDS[industry]
          : ['株式会社'])

    let collectedResult: Awaited<ReturnType<typeof collectCompaniesDetailed>>
    try {
      collectedResult = await collectCompaniesDetailed({
        criteria: {
          keywords: searchKeywords,
          areas: region && region !== '全国' ? [region] : undefined,
          industries: industry ? [industry] : undefined,
        } as any,
        maxResults: count,
        sources: ['gbizinfo', 'corporate_number'],
        enrich: true,
        enrichLimit: Math.min(count, 300),
      })
    } catch (e: any) {
      console.error('[doyalist/collect] API error', e)
      // 失敗時は空プロジェクトを削除
      try { await prisma.doyalistProject.delete({ where: { id: projectId } }) } catch {}
      return NextResponse.json(
        { error: '企業データの取得に失敗しました。しばらく経ってから再試行してください。' },
        { status: 502 }
      )
    }

    const collected = collectedResult.companies

    if (collected.length === 0) {
      // 空プロジェクトを削除して履歴に残さない
      try { await prisma.doyalistProject.delete({ where: { id: projectId } }) } catch {}
      // APIが応答していたかどうかで原因を区別
      if (!collectedResult.apiOk) {
        return NextResponse.json(
          { error: '企業データAPIから応答がありませんでした。時間をおいて再試行してください。', code: 'api_error' },
          { status: 502 }
        )
      }
      return NextResponse.json(
        {
          error: '該当する企業が見つかりませんでした。キーワードや業界・地域の絞り込みを緩めてお試しください。',
          code: 'no_hits',
          hint: 'AIキーワード変換ボタンで検索ワードを増やすとヒット数が増えやすくなります',
        },
        { status: 422 }
      )
    }

    // DB保存（実企業データ）
    const rows = collected.slice(0, count).map((c) => {
      return {
        projectId,
        name: c.companyName.slice(0, 200),
        website: c.website || null,
        industry: c.industry || project.industry || null,
        region: c.prefecture || project.region || null,
        size: c.employeeCount || project.targetSize || null,
        description: c.businessSummary || null,
        contactPerson: c.representative || null,
        enrichedData: {
          corporateNumber: c.corporateNumber || null,
          address: c.address || null,
          prefecture: c.prefecture || null,
          representative: c.representative || null,
          capital: c.capital || null,
          employeeCount: c.employeeCount || null,
          foundedYear: c.foundedYear || null,
          businessSummary: c.businessSummary || null,
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
