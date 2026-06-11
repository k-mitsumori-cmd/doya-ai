export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { generateImageWithFallback } from '@/lib/image-generator'
import { getUserId } from '@/lib/doyaslide/access'
import { buildImagePrompt } from '@/lib/doyaslide/prompts'
import { STYLE_PRESETS, getStylePreviewColor, STYLE_PREVIEW_SAMPLE_SLIDES } from '@/lib/doyaslide/constants'
import { stylePreviewPublicUrl, uploadStylePreview, stylePreviewExists } from '@/lib/doyaslide/storage'

const SAMPLE_SLIDES = STYLE_PREVIEW_SAMPLE_SLIDES

// GET /api/doyaslide/style-preview?style=flashy
// スタイルごとの「仕上がりイメージ」を複数ページ生成（全ユーザー共有でキャッシュ）
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const style = searchParams.get('style') || ''
    if (!STYLE_PRESETS.some((s) => s.value === style)) {
      return NextResponse.json({ error: '無効なスタイルです' }, { status: 400 })
    }

    // スタイルごとに代表カラーを変えて、一覧を多彩に見せる
    const themeColor = getStylePreviewColor(style)
    const urls: string[] = []
    for (let page = 0; page < SAMPLE_SLIDES.length; page++) {
      try {
        // キャッシュ確認（Storage上に存在すれば再利用。HEADは公開URLで信頼できないため list で判定）
        if (await stylePreviewExists(style, page)) {
          urls.push(stylePreviewPublicUrl(style, page))
          continue
        }
        const prompt = buildImagePrompt({
          slide: SAMPLE_SLIDES[page],
          themeColor,
          stylePreset: style,
          hasLogo: false,
          logoPosition: 'top-right',
          pageNumber: SAMPLE_SLIDES[page].index,
        })
        const img = await generateImageWithFallback({ prompt, size: '1536x1024', quality: 'high' })
        urls.push(await uploadStylePreview(style, img.base64, page))
      } catch (e: any) {
        // 1ページ失敗しても成功した他ページは返す（全体500にしない）
        console.error(`[doyaslide/style-preview] ${style}-${page} failed:`, e?.message)
      }
    }

    // 後方互換: 先頭ページを url としても返す（全滅時は null）
    return NextResponse.json({ url: urls[0] ?? null, urls })
  } catch (e: any) {
    console.error('[doyaslide/style-preview]', e?.message)
    return NextResponse.json({ error: 'プレビュー生成に失敗しました' }, { status: 500 })
  }
}
