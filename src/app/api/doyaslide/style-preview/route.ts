export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { generateImageWithFallback } from '@/lib/image-generator'
import { getUserId } from '@/lib/doyaslide/access'
import { buildImagePrompt } from '@/lib/doyaslide/prompts'
import { STYLE_PRESETS } from '@/lib/doyaslide/constants'
import { stylePreviewPublicUrl, uploadStylePreview, stylePreviewExists } from '@/lib/doyaslide/storage'

// スタイルの雰囲気を伝える共通サンプルスライド
const SAMPLE_SLIDE = {
  role: '表紙',
  headline: '新サービスのご提案',
  subText: '課題を解決する、その先へ',
  visualPrompt:
    'モダンなビジネスプレゼンの表紙。抽象的なグラフィックと余白のバランス。サンプル見本として魅力的に。',
}

// GET /api/doyaslide/style-preview?style=flashy
// スタイルごとの「仕上がりイメージ」画像を生成（全ユーザー共有でキャッシュ）
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const style = searchParams.get('style') || ''
    if (!STYLE_PRESETS.some((s) => s.value === style)) {
      return NextResponse.json({ error: '無効なスタイルです' }, { status: 400 })
    }

    // キャッシュ確認（Storage上に存在すれば再利用。HEADは公開URLで信頼できないため list で判定）
    if (await stylePreviewExists(style)) {
      return NextResponse.json({ url: stylePreviewPublicUrl(style), cached: true })
    }

    const prompt = buildImagePrompt({
      slide: SAMPLE_SLIDE,
      themeColor: '#7f19e6',
      stylePreset: style,
      hasLogo: false,
      logoPosition: 'top-right',
    })
    const img = await generateImageWithFallback({ prompt, size: '1536x1024', quality: 'medium' })
    const url = await uploadStylePreview(style, img.base64)

    return NextResponse.json({ url, cached: false })
  } catch (e: any) {
    console.error('[doyaslide/style-preview]', e?.message)
    return NextResponse.json({ error: 'プレビュー生成に失敗しました' }, { status: 500 })
  }
}
