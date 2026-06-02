export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { generateImageWithFallback } from '@/lib/image-generator'
import { getUserId } from '@/lib/doyaslide/access'
import { buildImagePrompt } from '@/lib/doyaslide/prompts'
import { STYLE_PRESETS, getStylePreviewColor } from '@/lib/doyaslide/constants'
import { stylePreviewPublicUrl, uploadStylePreview, stylePreviewExists } from '@/lib/doyaslide/storage'

// スタイルの雰囲気を「何ページも」伝える共通サンプルスライド（表紙→特長→まとめ）
const SAMPLE_SLIDES = [
  {
    role: '表紙',
    headline: '新サービスのご提案',
    subText: '課題を解決する、その先へ',
    visualPrompt:
      'モダンなビジネスプレゼンの表紙。タイトルを主役に、抽象的なグラフィックと余白のバランス。サンプル見本として魅力的に。',
  },
  {
    role: '特長',
    headline: '3つの強み',
    subText: '導入がかんたん / コスト削減 / すぐに効果',
    visualPrompt:
      '3つの特長を横並びで見せる本文スライド。各項目にアイコン的なモチーフと短い見出し。情報が整理されたレイアウト。',
  },
  {
    role: 'まとめ',
    headline: 'まずは無料で体験',
    subText: 'お気軽にお問い合わせください',
    visualPrompt:
      '締めのCTAスライド。行動を促す力強い構図と大きな余白。連絡先やボタン風の要素を含む安心感のある仕上がり。',
  },
]

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
