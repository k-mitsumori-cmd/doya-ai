export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { generateImageWithFallback } from '@/lib/image-generator'
import { getUserId } from '@/lib/doyaslide/access'
import { buildImagePrompt } from '@/lib/doyaslide/prompts'
import { STYLE_PRESETS, getStylePreviewColor, STYLE_PREVIEW_SAMPLE_SLIDES } from '@/lib/doyaslide/constants'
import { stylePreviewPublicUrl, uploadStylePreview, stylePreviewExists } from '@/lib/doyaslide/storage'
import { normalizeGeneratedSlide } from '@/lib/doyaslide/aspect'
import { claimStylePreviewLease, releaseStylePreviewLease, reserveStylePreviewImages, StylePreviewBudgetError, StylePreviewInProgressError } from '@/lib/doyaslide/style-preview-lease'

const SAMPLE_SLIDES = STYLE_PREVIEW_SAMPLE_SLIDES

// GET /api/doyaslide/style-preview?style=flashy
// スタイルごとの「仕上がりイメージ」を複数ページ生成（全ユーザー共有でキャッシュ）
export async function GET(req: NextRequest) {
  try {
    // プレビューは全ユーザー共有。未ログインでも生成済みキャッシュは閲覧可能にし、
    // キャッシュが無い場合だけログインユーザーによる生成を許可する。
    const userId = await getUserId()

    const { searchParams } = new URL(req.url)
    const style = searchParams.get('style') || ''
    if (!STYLE_PRESETS.some((s) => s.value === style)) {
      return NextResponse.json({ error: '無効なスタイルです' }, { status: 400 })
    }

    // Storageの確認失敗時は生成しない。読み取り障害を「未生成」と誤判定しない。
    const cached = await Promise.all(SAMPLE_SLIDES.map((_, page) => stylePreviewExists(style, page)))
    const cachedUrls = cached.map((exists, page) => exists ? stylePreviewPublicUrl(style, page) : null)
    if (!userId || cached.every(Boolean)) {
      const urls = cachedUrls.filter((url): url is string => !!url)
      return NextResponse.json({ url: urls[0] ?? null, urls, pending: false })
    }

    let token: string
    try {
      token = await claimStylePreviewLease(style)
    } catch (error) {
      if (!(error instanceof StylePreviewInProgressError)) throw error
      const urls = cachedUrls.filter((url): url is string => !!url)
      return NextResponse.json({ url: urls[0] ?? null, urls, pending: true }, { status: 202 })
    }

    try {
      // 別の要求が先に生成している可能性があるため、lease取得後に再確認する。
      const current = await Promise.all(SAMPLE_SLIDES.map((_, page) => stylePreviewExists(style, page)))
      const missing = current.filter(exists => !exists).length
      if (missing > 0) await reserveStylePreviewImages(missing)
      const themeColor = getStylePreviewColor(style)
      const results = await Promise.all(SAMPLE_SLIDES.map(async (slide, page) => {
        if (current[page]) return stylePreviewPublicUrl(style, page)
        try {
          const prompt = buildImagePrompt({
            slide,
            themeColor,
            stylePreset: style,
            hasLogo: false,
            logoPosition: 'top-right',
            pageNumber: slide.index,
            aspectRatio: 'wide',
          })
          const img = await generateImageWithFallback({ prompt, size: '1536x1024', quality: 'medium' })
          const normalized = await normalizeGeneratedSlide(img.base64, img.mimeType, 'wide')
          return await uploadStylePreview(style, normalized.base64, page)
        } catch (e: any) {
          console.error(`[doyaslide/style-preview] ${style}-${page} failed:`, e?.message)
          return null
        }
      }))
      const urls = results.filter((url): url is string => !!url)
      return NextResponse.json({ url: urls[0] ?? null, urls, pending: false })
    } finally {
      await releaseStylePreviewLease(style, token).catch(error => {
        console.error('[doyaslide/style-preview] lease release failed', error)
      })
    }
  } catch (e: any) {
    if (e instanceof StylePreviewBudgetError) return NextResponse.json({ error: '本日のスタイル見本生成枠に達しました。既存の見本をご利用ください。', code: 'STYLE_PREVIEW_DAILY_CAP' }, { status: 429 })
    console.error('[doyaslide/style-preview]', e?.message)
    return NextResponse.json({ error: 'プレビュー生成に失敗しました' }, { status: 500 })
  }
}
