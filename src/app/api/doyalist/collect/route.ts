export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import {
  getUserDoyalistLimits,
  countMonthlyCompanies,
} from '@/lib/doyalist/limits'

interface GeneratedCompany {
  name: string
  website?: string
  industry?: string
  region?: string
  size?: string
  description?: string
  score?: number
}

/**
 * POST /api/doyalist/collect
 * Geminiで企業候補を生成し、DoyalistCompany レコードを作成
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

    const industry = project.industry || '指定なし'
    const region = project.region || '日本全国'
    const targetSize = project.targetSize || '指定なし'
    const keywords = project.keywords || ''

    const prompt = [
      `「${industry}」業界、${region}地域、${targetSize}規模の架空でリアルな日本企業を${count}社、JSON形式で提案してください。`,
      keywords ? `関連キーワード: ${keywords}` : '',
      '出力は { "companies": [...] } のオブジェクト形式で、companies配列の各要素は以下のフィールドを持つこと:',
      '- name: 企業名（架空でも実在感のある日本企業名）',
      '- website: ウェブサイトURL（架空のドメインでよい。例: https://example-corp.co.jp）',
      '- industry: 業種',
      '- region: 所在地（都道府県・市区町村）',
      '- size: 規模（従業員数の目安。例: "50〜100名"）',
      '- description: 事業概要（100字程度）',
      '- score: 営業優先度スコア（0-100の整数。営業対象として魅力的なほど高スコア）',
      '注意: 実在企業を模倣しない。あくまで営業ターゲットとして参考になる架空企業を提案する。',
    ]
      .filter(Boolean)
      .join('\n')

    let result: { companies?: GeneratedCompany[] }
    try {
      result = await geminiGenerateJson<{ companies?: GeneratedCompany[] }>({
        prompt,
        model: GEMINI_TEXT_MODEL_DEFAULT,
      })
    } catch (e: any) {
      console.error('[doyalist/collect] gemini error', e)
      return NextResponse.json(
        { error: 'AIによる企業生成に失敗しました。しばらく経ってから再試行してください' },
        { status: 502 }
      )
    }

    const generated = Array.isArray(result?.companies) ? result.companies : []
    if (generated.length === 0) {
      return NextResponse.json(
        { error: 'AIから企業候補を取得できませんでした' },
        { status: 502 }
      )
    }

    // DB保存（createManyで一括挿入: パフォーマンス改善）
    const rows = generated.slice(0, count).map((c: any) => ({
      projectId,
      name: (c.name || '名称未設定').toString().slice(0, 200),
      website: c.website || null,
      industry: c.industry || project.industry || null,
      region: c.region || project.region || null,
      size: c.size || project.targetSize || null,
      description: c.description || null,
      score: typeof c.score === 'number' && c.score >= 0 && c.score <= 100
        ? Math.round(c.score)
        : Math.floor(Math.random() * 46) + 50,
      status: 'new',
      source: 'collected',
    }))
    await prisma.doyalistCompany.createMany({ data: rows })

    // 直近作成データを取得して返す（createManyはレコードを返さないため）
    const created = await prisma.doyalistCompany.findMany({
      where: { projectId, source: 'collected' },
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
