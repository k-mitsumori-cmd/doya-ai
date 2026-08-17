export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { analyzeUrlForBrand } from '@/lib/adbanner/scrape'
import { ADBANNER_RETIRED, retiredResponse } from '@/lib/adbanner/retired'

// POST /api/adbanner/analyze-url — URLからブランド情報（サービス名/概要/配色）を抽出
export async function POST(req: NextRequest) {
  // ⚠️ /adimage へ統合済み。入口だけ閉じる（本体は復旧の余地のため残す）
  if (ADBANNER_RETIRED) return retiredResponse()

  const body = await req.json().catch(() => ({}))
  const url = (body.url as string)?.trim()
  if (!url) return NextResponse.json({ success: false, error: 'URLを入力してください' }, { status: 400 })
  try {
    const brand = await analyzeUrlForBrand(url)
    return NextResponse.json({ success: true, data: brand })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: 'URLの解析に失敗しました' }, { status: 500 })
  }
}
