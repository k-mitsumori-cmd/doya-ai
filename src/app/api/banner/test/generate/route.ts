import { NextRequest, NextResponse } from 'next/server'
import { generateBanners } from '@/lib/nanobanner'

export const runtime = 'nodejs'
export const maxDuration = 300

type TestGenerateRequest = {
  template?: string
  size?: string
  industry?: string
  mainTitle?: string
  subTitle?: string
  accentText?: string
  count?: number
  basePrompt?: string // テンプレートのベースプロンプト
  templateImageUrl?: string // 元のテンプレート画像URL（スタイル参照用）
  templateDisplayTitle?: string // テンプレートの表示名
  logoBase64?: string // ロゴ画像（Base64）
  personBase64?: string // 人物画像（Base64）
}

// テンプレート別のプロンプト生成（ユーザー例を参考に拡張可能）
function buildTestBannerPrompt(params: {
  template?: string
  size: string
  industry: string
  mainTitle: string
  subTitle?: string
  accentText?: string
  variationIndex: number
  basePrompt?: string // テンプレートのベースプロンプト
  templateDisplayTitle?: string // テンプレートの表示名
}): string {
  const { template, size, industry, mainTitle, subTitle, accentText, variationIndex, basePrompt, templateDisplayTitle } = params
  const [width, height] = size.split('x')
  
  // basePromptがある場合は、それをベースにカスタマイズ（スタイルを維持）
  if (basePrompt && basePrompt.length > 50) {
    // 元のプロンプトのスタイル部分を抽出して維持
    // レイアウトのバリエーションは最小限に（元のスタイルを維持するため）
    const layoutVariations = [
      '', // バリエーション0: 元のレイアウトをそのまま維持
      'わずかに構図を調整しつつ、全体のスタイルは維持',
      '同じスタイルで、テキスト配置を微調整',
    ]
    const layoutHint = layoutVariations[variationIndex % layoutVariations.length] || ''
    
    return `
【重要】以下のスタイル・デザインを完全に維持してください：
${basePrompt}

【変更点】テキストのみ以下に置き換え：
・メインテキスト：「${mainTitle}」

【維持すべき要素】
・色使い、配色パターン
・レイアウト構成
・フォントスタイル
・背景デザイン
・全体的な雰囲気とトーン
${templateDisplayTitle ? `・「${templateDisplayTitle}」のスタイル` : ''}

${layoutHint ? `【微調整】${layoutHint}` : ''}

【出力仕様】
・サイズ: ${width}×${height} px
・エッジまで埋める（余白なし）
・日本語テキストは可読性を確保
・元のデザインと同じクオリティを維持
`.trim()
  }

  // テンプレート別のスタイル調整
  const templateStyles: Record<string, { tone: string; colors: string; elements: string }> = {
    'dark-tech': {
      tone: 'ダークトーン（黒〜ダークグレー基調）',
      colors: 'ダークグレー、黒、ネオンイエロー（アクセント）',
      elements: 'Webページ、管理画面、スライドのUIが並んでいるモザイク・グリッド表現',
    },
    'minimal-clean': {
      tone: 'ミニマル、清潔感',
      colors: '白、グレー、アクセントカラー',
      elements: 'シンプルな形状、余白重視',
    },
    'gradient-modern': {
      tone: 'グラデーション、モダン',
      colors: 'グラデーションカラー、ビビッドカラー',
      elements: 'グラデーション背景、モダンなアイコン',
    },
  }

  const style = template ? templateStyles[template] || templateStyles['dark-tech'] : templateStyles['dark-tech']

  // バリエーションごとに異なるプロンプトを生成
  const variationHints = [
    'Layout: split-screen with large headline on left, visual elements on right. Dark background with UI mosaics.',
    'Layout: centered composition with large title at center-top, gradient background with subtle UI patterns.',
    'Layout: diagonal dynamic composition with headline angled, vibrant accent colors, modern tech aesthetic.',
    'Layout: minimal with lots of whitespace, headline in upper-left, subtle background textures.',
    'Layout: grid pattern with multiple small UI elements, large headline overlaid on top.',
    'Layout: hero section style with massive title, dark gradient background, clean UI elements.',
    'Layout: card-based with rounded corners, headline in card, modern shadow effects.',
    'Layout: asymmetric with headline offset to left, visual balance with accent elements on right.',
    'Layout: full-width banner with title spanning entire width, dark background with subtle patterns.',
    'Layout: magazine-style with clear hierarchy, headline in bold, subheading below, premium feel.',
  ]

  const variationHint = variationHints[variationIndex % variationHints.length] || variationHints[0]

  const prompt = `
目的：
「${mainTitle}」
${subTitle ? `+ 「${subTitle}」` : ''}
${accentText ? `+ 「${accentText}」` : ''}
という記事・特集ページ用のアイキャッチ兼バナー画像を制作したい。

参考イメージ：
・全体は${style.tone}
・背景に${style.elements}
・情報量が多いが、整理されていて"知的・プロ向け"な印象
・WEBディレクター / マーケター向けのクリエイティブナレッジ感

デザインテイスト：
・クール / 知的 / 信頼感 / 最新トレンド
・「情報を網羅的に比較・整理している」雰囲気
・広告っぽすぎず、メディア・ホワイトペーパー寄り
・2026年感のあるモダンなデザイン

構図：
・横長バナー（${width}×${height}想定）
・左〜中央に大きなタイトル文字
・右側または背景に、AIツール・文章・UI・比較表を想起させるビジュアル
・奥行き感（軽いボケ・レイヤー重なり）
${variationHint}

入れたいテキスト（日本語）：
${accentText ? `・上部またはアクセントとして小さく：「${accentText}」` : ''}
・メインタイトル（最重要）：「${mainTitle}」
${subTitle ? `・サブタイトル：「${subTitle}」` : ''}

文字表現：
・太めのゴシック体、日本語可読性重視
・メインタイトルは白文字
・一部キーワードは黄色 or ネオン系アクセントカラーで強調
・文字はボックスや下線で囲ってもOK

ビジュアル要素：
・PC画面、Webページ、文章、ダッシュボード、カードUIなどを想起させる背景
・「比較」「分析」「網羅」「ランキング」が伝わる
・人物は不要（入れる場合もシルエット程度）

避けたい点：
・ポップすぎる / かわいすぎる
・BtoC感が強いデザイン
・イラスト感が強すぎる表現

全体の印象：
「SEOやコンテンツマーケに本気な人がクリックしたくなる、"保存版・決定版"感のあるAIツール比較バナー」

出力サイズ：
・正確に ${width}×${height} px
・エッジまで埋める（レターボックスなし）
・日本語テキストは必ず可読性を確保
`.trim()

  return prompt
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TestGenerateRequest
    const {
      template,
      size = '1200x628',
      industry = '',
      mainTitle = '',
      subTitle = '',
      accentText = '',
      count = 10,
      basePrompt,
      templateImageUrl,
      templateDisplayTitle,
      logoBase64,
      personBase64,
    } = body

    if (!mainTitle.trim()) {
      return NextResponse.json({ error: 'メインタイトルは必須です' }, { status: 400 })
    }

    // カテゴリを業種から推測（簡易版）
    let category = 'it'
    if (industry.includes('美容') || industry.includes('コスメ')) category = 'beauty'
    else if (industry.includes('EC') || industry.includes('セール')) category = 'ec'
    else if (industry.includes('採用') || industry.includes('人材')) category = 'recruit'
    else if (industry.includes('教育') || industry.includes('スクール')) category = 'education'

    const targetCount = Math.max(1, Math.min(10, Math.floor(count || 10)))

    // 複数のバリエーションを生成（同じ入力でも異なるプロンプト）
    const banners: string[] = []
    const prompts: string[] = []

    // 並列生成のため、先に全プロンプトを生成
    for (let i = 0; i < targetCount; i++) {
      const prompt = buildTestBannerPrompt({
        template,
        size,
        industry,
        mainTitle,
        subTitle,
        accentText,
        variationIndex: i,
        basePrompt,
        templateDisplayTitle,
      })
      prompts.push(prompt)
    }

    // 各バリエーションを順次生成（Gemini 3.0で画像生成）
    for (let i = 0; i < targetCount; i++) {
      try {
        const prompt = prompts[i]
        const result = await generateBanners(
          category,
          mainTitle,
          size,
          {
            headlineText: mainTitle,
            subheadText: subTitle || undefined,
            customImagePrompt: prompt,
            variationMode: 'diverse',
          },
          1 // 1枚ずつ生成
        )

        if (result.banners && result.banners.length > 0) {
          banners.push(result.banners[0])
        } else if (result.error) {
          console.error(`Banner ${i + 1} generation error:`, result.error)
          // エラーでも続行（部分的な成功を許容）
        }
      } catch (err: any) {
        console.error(`Banner ${i + 1} generation failed:`, err)
        // エラーでも続行
      }
    }

    if (banners.length === 0) {
      return NextResponse.json({ error: 'バナーの生成に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({
      banners,
      prompts,
      count: banners.length,
    })
  } catch (err: any) {
    console.error('Test banner generation error:', err)
    return NextResponse.json({ error: err.message || '生成に失敗しました' }, { status: 500 })
  }
}
