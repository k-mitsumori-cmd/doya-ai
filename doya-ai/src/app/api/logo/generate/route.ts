import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// NOTE: LOGO generator モジュールは doya-ai 配下に未移植のため、
// 一時的にスタブ化。本番では LOGO 機能は利用不可。
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'ロゴ生成機能は現在準備中です。' },
    { status: 503 }
  )
}
