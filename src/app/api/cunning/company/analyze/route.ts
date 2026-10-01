export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { analyzeCompanyUrl } from '@/lib/cunning/company'
import { reserveCunningCompanyAnalysis, CUNNING_COMPANY_DAILY_LIMIT, CunningCompanyDailyLimitError } from '@/lib/cunning/company-budget'
import { CunningScrapeTooLargeError } from '@/lib/cunning/scraper'

// POST /api/cunning/company/analyze — 採用URL解析 → 企業プロファイル保存
// body: { url: string }
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const url = body && typeof body === 'object' && !Array.isArray(body) && typeof body.url === 'string'
      ? body.url.trim() : ''
    if (!url) return NextResponse.json({ error: 'URLを入力してください' }, { status: 400 })
    if (url.length > 2048 || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'httpまたはhttpsのURLを入力してください' }, { status: 400 })
    }
    try { new URL(url) } catch {
      return NextResponse.json({ error: 'URLの形式を確認してください' }, { status: 400 })
    }

    await reserveCunningCompanyAnalysis(userId)

    const { extract, rawText } = await analyzeCompanyUrl(url)

    const profile = await prisma.cunningCompanyProfile.create({
      data: {
        userId,
        url,
        companyName: extract.companyName?.slice(0, 200) || null,
        businessSummary: extract.businessSummary || null,
        requirements: extract.requirements as any,
        rawText: rawText.slice(0, 20000),
      },
      // rawText（取得した生本文）はレスポンスに含めない（SSRFでの内容エコー流出を防ぐ多層防御）
      select: {
        id: true,
        url: true,
        companyName: true,
        businessSummary: true,
        requirements: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ profile })
  } catch (e: any) {
    if (e instanceof CunningScrapeTooLargeError) {
      return NextResponse.json({ error: 'ページが大きすぎます。別の採用ページのURLをお試しください。' }, { status: 413 })
    }
    if (e instanceof CunningCompanyDailyLimitError) {
      return NextResponse.json({
        code: 'CUNNING_COMPANY_DAILY_LIMIT',
        error: `本日の企業URL解析の運用上限（${CUNNING_COMPANY_DAILY_LIMIT}回）に達しました。明日お試しください。`,
      }, { status: 429 })
    }
    console.error('[cunning/company/analyze]')
    return NextResponse.json({ error: '企業ページの解析に失敗しました' }, { status: 500 })
  }
}
