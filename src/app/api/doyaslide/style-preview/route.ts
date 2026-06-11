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
    // 全ページ並列生成（直列だと cold cache 時に 3ページ×約130秒 > maxDuration=300 で関数が落ちる）
    const results = await Promise.all(
      SAMPLE_SLIDES.map(async (slide, page) => {
        try {
          // キャッシュ確認（Storage上に存在すれば再利用。HEADは公開URLで信頼できないため list で判定）
          if (await stylePreviewExists(style, page)) {
            return stylePreviewPublicUrl(style, page)
          }
          const prompt = buildImagePrompt({
            slide,
            themeColor,
            stylePreset: style,
            hasLogo: false,
            logoPosition: 'top-right',
            pageNumber: slide.index,
          })
          const img = await generateImageWithFallback({ prompt, size: '1536x1024', quality: 'high' })
          return await uploadStylePreview(style, img.base64, page)
        } catch (e: any) {
          // 1ページ失敗しても成功した他ページは返す（全体500にしない）
          console.error(`[doyaslide/style-preview] ${style}-${page} failed:`, e?.message)
          return null
        }
      })
    )
    const urls = results.filter((u): u is string => !!u)

    // 後方互換: 先頭ページを url としても返す（全滅時は null）
    return NextResponse.json({ url: urls[0] ?? null, urls })
  } catch (e: any) {
    console.error('[doyaslide/style-preview]', e?.message)
    return NextResponse.json({ error: 'プレビュー生成に失敗しました' }, { status: 500 })
  }
}
