export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { STYLE_PRESETS, STYLE_PREVIEW_SAMPLE_SLIDES } from '@/lib/doyaslide/constants'
import { stylePreviewPublicUrl, stylePreviewExists } from '@/lib/doyaslide/storage'

const SAMPLE_SLIDES = STYLE_PREVIEW_SAMPLE_SLIDES

// GET /api/doyaslide/style-preview?style=flashy
// スタイルごとの「仕上がりイメージ」のうち、保存済みのものだけを返す（全ユーザー共有）。
// ⚠️ この GET では画像を生成しない（2026-10-19 原価見直し）。
//    以前は新規作成の画面を開くだけで、見本の無いスタイルの画像を有料APIで自動生成していた。
//    保存に失敗し続けると開くたびに生成が走り、月に最大で約3.4万円の原価になりえた。
//    見本が無いスタイルは、画面側が色とレイアウトだけの静的な見本（src/lib/doyaslide/style-placeholder.ts）を出す。
//    見本画像は管理者が scripts/regenerate-doyaslide-style-previews.ts で明示的に作る。
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const style = searchParams.get('style') || ''
    if (!STYLE_PRESETS.some((s) => s.value === style)) {
      return NextResponse.json({ error: '無効なスタイルです' }, { status: 400 })
    }

    // Storage の確認に失敗したら 500 を返す。読み取りの障害を「未生成」と取り違えない。
    const cached = await Promise.all(SAMPLE_SLIDES.map((_, page) => stylePreviewExists(style, page)))
    const urls = cached
      .map((exists, page) => (exists ? stylePreviewPublicUrl(style, page) : null))
      .filter((url): url is string => !!url)
    return NextResponse.json({ url: urls[0] ?? null, urls, pending: false })
  } catch {
    console.error('[doyaslide/style-preview] lookup failed')
    return NextResponse.json({ error: 'プレビューを取得できませんでした' }, { status: 500 })
  }
}
