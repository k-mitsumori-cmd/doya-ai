export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { analyzeCompanyUrl } from '@/lib/cunning/company'

// POST /api/cunning/company/analyze — 採用URL解析 → 企業プロファイル保存
// body: { url: string }
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const url = (body.url as string)?.trim()
    if (!url) return NextResponse.json({ error: 'URLを入力してください' }, { status: 400 })

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
    })

    return NextResponse.json({ profile })
  } catch (e: any) {
    console.error('[cunning/company/analyze]', e?.message)
    return NextResponse.json({ error: '企業ページの解析に失敗しました' }, { status: 500 })
  }
}
