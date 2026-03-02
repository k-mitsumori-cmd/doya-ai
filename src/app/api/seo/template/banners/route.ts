import { NextRequest, NextResponse } from 'next/server'
import { generateBanners, isNanobannerConfigured } from '@/lib/nanobanner'
import { articleTemplates } from '@/app/seo/template/data'

export const runtime = 'nodejs'
export const maxDuration = 300

// 記事タイプに基づいてカテゴリをマッピング
function getCategoryFromTemplate(template: typeof articleTemplates[0]): string {
  if (template.category === 'howto' || template.category === 'case') {
    return 'marketing'
  }
  if (template.category === 'compare' || template.articleType === 'comparison' || template.articleType === 'ranking') {
    return 'it'
  }
  return 'it'
}

// 記事タイトルからバナープロンプト用のキーワードを抽出
function extractKeyword(title: string): string {
  const mainPart = title.split('｜')[0].trim()
  return mainPart || title
}

// 記事タイトルからジャンルを推定
function detectGenre(title: string): string {
  const lowerTitle = title.toLowerCase()
  
  if (lowerTitle.includes('chatgpt') || lowerTitle.includes('ai') || lowerTitle.includes('claude') || lowerTitle.includes('gemini')) {
    return 'AI・テクノロジー'
  }
  if (lowerTitle.includes('notion') || lowerTitle.includes('プロジェクト管理') || lowerTitle.includes('タスク')) {
    return '生産性・ツール'
  }
  if (lowerTitle.includes('副業') || lowerTitle.includes('稼ぎ') || lowerTitle.includes('収入')) {
    return '副業・収入'
  }
  if (lowerTitle.includes('プログラミング') || lowerTitle.includes('エンジニア') || lowerTitle.includes('コード')) {
    return 'プログラミング'
  }
  if (lowerTitle.includes('投資') || lowerTitle.includes('nisa') || lowerTitle.includes('資産')) {
    return '投資・金融'
  }
  if (lowerTitle.includes('デザイン') || lowerTitle.includes('ui') || lowerTitle.includes('ux')) {
    return 'デザイン'
  }
  if (lowerTitle.includes('マーケティング') || lowerTitle.includes('seo') || lowerTitle.includes('広告')) {
    return 'マーケティング'
  }
  if (lowerTitle.includes('リモート') || lowerTitle.includes('在宅') || lowerTitle.includes('働き方')) {
    return '働き方'
  }
  if (lowerTitle.includes('会計') || lowerTitle.includes('freee') || lowerTitle.includes('経理')) {
    return '会計・経理'
  }
  if (lowerTitle.includes('動画') || lowerTitle.includes('youtube') || lowerTitle.includes('編集')) {
    return '動画・クリエイティブ'
  }
  if (lowerTitle.includes('英会話') || lowerTitle.includes('英語') || lowerTitle.includes('学習')) {
    return '学習・教育'
  }
  if (lowerTitle.includes('crm') || lowerTitle.includes('salesforce') || lowerTitle.includes('営業')) {
    return '営業・CRM'
  }
  if (lowerTitle.includes('dx') || lowerTitle.includes('デジタル') || lowerTitle.includes('変革')) {
    return 'DX・変革'
  }
  if (lowerTitle.includes('スタートアップ') || lowerTitle.includes('資金調達') || lowerTitle.includes('vc')) {
    return 'スタートアップ'
  }
  if (lowerTitle.includes('saas') || lowerTitle.includes('クラウド')) {
    return 'SaaS・クラウド'
  }
  if (lowerTitle.includes('採用') || lowerTitle.includes('人事') || lowerTitle.includes('応募')) {
    return '採用・HR'
  }
  if (lowerTitle.includes('ec') || lowerTitle.includes('売上') || lowerTitle.includes('cvr')) {
    return 'EC・コマース'
  }
  if (lowerTitle.includes('sns') || lowerTitle.includes('instagram') || lowerTitle.includes('フォロワー')) {
    return 'SNS'
  }
  
  return 'ビジネス'
}

// ジャンルに応じたビジュアル要素を取得
function getGenreVisuals(genre: string): string {
  const visuals: Record<string, string> = {
    'AI・テクノロジー': 'AIチャットインターフェース、ニューラルネットワーク、デジタルブレイン、未来的なUI',
    '生産性・ツール': 'カンバンボード、チェックリスト、カレンダー、整理されたダッシュボード',
    '副業・収入': 'グラフの上昇、コイン、ノートPC、自由な働き方のイメージ',
    'プログラミング': 'コードエディタ、ターミナル、プログラミング言語のロゴ、開発環境',
    '投資・金融': 'チャート、グラフ、資産推移、金融ダッシュボード',
    'デザイン': 'カラーパレット、レイアウトグリッド、デザインツール、美しいUI',
    'マーケティング': 'アナリティクス、ファネル、グラフ、マーケティングダッシュボード',
    '働き方': 'ホームオフィス、デスク環境、オンラインミーティング、快適な作業空間',
    '会計・経理': '帳簿、電卓、財務諸表、会計ソフトのUI',
    '動画・クリエイティブ': 'タイムライン、動画プレビュー、編集ツール、クリエイティブな要素',
    '学習・教育': 'オンライン授業、学習プラットフォーム、進捗グラフ、教材',
    '営業・CRM': '顧客リスト、パイプライン、商談管理、営業ダッシュボード',
    'DX・変革': 'デジタル化のイメージ、変革のプロセス、ビフォーアフター',
    'スタートアップ': 'ピッチデッキ、成長グラフ、チームミーティング、投資家プレゼン',
    'SaaS・クラウド': 'クラウドアイコン、サブスクリプション、SaaSダッシュボード',
    '採用・HR': '人材、チームビルディング、採用フロー、組織図',
    'EC・コマース': 'ショッピングカート、商品一覧、決済画面、売上グラフ',
    'SNS': 'ソーシャルメディアアイコン、フィード、エンゲージメント、フォロワー数',
    'ビジネス': 'ビジネスダッシュボード、グラフ、プレゼン資料、会議室',
  }
  
  return visuals[genre] || visuals['ビジネス']
}

// ジャンルに応じたカラースキームを取得
function getGenreColors(genre: string): string[] {
  const colors: Record<string, string[]> = {
    'AI・テクノロジー': ['#8B5CF6', '#6366F1'],
    '生産性・ツール': ['#3B82F6', '#0EA5E9'],
    '副業・収入': ['#F59E0B', '#EAB308'],
    'プログラミング': ['#10B981', '#14B8A6'],
    '投資・金融': ['#059669', '#10B981'],
    'デザイン': ['#EC4899', '#F472B6'],
    'マーケティング': ['#F97316', '#FB923C'],
    '働き方': ['#06B6D4', '#22D3EE'],
    '会計・経理': ['#2563EB', '#3B82F6'],
    '動画・クリエイティブ': ['#EF4444', '#F87171'],
    '学習・教育': ['#8B5CF6', '#A78BFA'],
    '営業・CRM': ['#F59E0B', '#FBBF24'],
    'DX・変革': ['#6366F1', '#818CF8'],
    'スタートアップ': ['#EC4899', '#F472B6'],
    'SaaS・クラウド': ['#0EA5E9', '#38BDF8'],
    '採用・HR': ['#14B8A6', '#2DD4BF'],
    'EC・コマース': ['#F97316', '#FB923C'],
    'SNS': ['#E11D48', '#F43F5E'],
    'ビジネス': ['#2563EB', '#6366F1'],
  }
  
  return colors[genre] || colors['ビジネス']
}

// 記事の性質に応じたビジュアル説明を生成
function getImageDescription(template: typeof articleTemplates[0]): string {
  const descriptions: string[] = []
  const genre = detectGenre(template.title)

  // ジャンル固有のビジュアル
  descriptions.push(getGenreVisuals(genre))

  // カテゴリに基づく説明
  if (template.category === 'guide') {
    descriptions.push('解説・ガイド記事の雰囲気、知識を伝えるクリーンなデザイン')
  } else if (template.category === 'compare') {
    descriptions.push('比較・検討記事の雰囲気、複数の選択肢を整理したビジュアル')
  } else if (template.category === 'howto') {
    descriptions.push('実践的なHowTo記事の雰囲気、ステップバイステップのビジュアル')
  } else if (template.category === 'case') {
    descriptions.push('事例・トレンド記事の雰囲気、データと実績を伝えるビジュアル')
  }

  // 記事タイプに基づく説明
  if (template.articleType === 'explanation') {
    descriptions.push('初心者にもわかりやすい、親しみやすいデザイン')
  } else if (template.articleType === 'comparison' || template.articleType === 'ranking') {
    descriptions.push('比較検討をサポートする、信頼感のあるデザイン')
  } else if (template.articleType === 'howto') {
    descriptions.push('手順を追って実践できる、行動を促すデザイン')
  } else if (template.articleType === 'case') {
    descriptions.push('実績・成功事例を伝える、説得力のあるデザイン')
  }

  return descriptions.join('、')
}

// 記事タイプに応じたブランドカラーを取得
function getBrandColors(template: typeof articleTemplates[0]): string[] {
  // まずカテゴリベースのカラーを試す
  if (template.category === 'guide') return ['#2563EB', '#3B82F6']
  if (template.category === 'compare') return ['#F59E0B', '#F97316']
  if (template.category === 'howto') return ['#10B981', '#059669']
  if (template.category === 'case') return ['#8B5CF6', '#A855F7']
  // フォールバック: ジャンルから推定
  const genre = detectGenre(template.title)
  return getGenreColors(genre)
}

// ドヤバナーAIスタイルのプロンプト生成（記事バナー用）
function buildArticleBannerPrompt(params: {
  template: typeof articleTemplates[0]
  mainTitle: string
  subTitle?: string
  size: string
  variationIndex: number
  imageDescription?: string
  brandColors?: string[]
  customPrompt?: string
}): string {
  const { template, mainTitle, subTitle, size, variationIndex, imageDescription, brandColors, customPrompt } = params
  const [width, height] = size.split('x')
  
  // バリエーションヒント（ドヤバナーAIと同じパターン）
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
  
  // スタイル定義
  const styleDesc = getImageDescription(template)
  const colors = brandColors && brandColors.length > 0 
    ? brandColors.join('、')
    : getBrandColors(template).join('、')
  
  // ジャンルを検出
  const genre = detectGenre(mainTitle)
  const genreVisuals = getGenreVisuals(genre)
  
  const prompt = `
目的：
「${mainTitle}」
${subTitle ? `+ 「${subTitle}」` : ''}
という記事・特集ページ用のアイキャッチ兼バナー画像を制作したい。

ジャンル：${genre}

参考イメージ：
・全体は${styleDesc}
・情報量が多いが、整理されていて"知的・プロ向け"な印象
・${genre}に関心のある読者が惹かれるビジュアル

デザインテイスト：
・クール / 知的 / 信頼感 / 最新トレンド
・「情報を網羅的に比較・整理している」雰囲気
・広告っぽすぎず、メディア・ホワイトペーパー寄り
・2026年感のあるモダンなデザイン

構図：
・横長バナー（${width}×${height}想定）
・左〜中央に大きなタイトル文字
・右側または背景に、${genreVisuals}を想起させるビジュアル
・奥行き感（軽いボケ・レイヤー重なり）
${variationHint}

入れたいテキスト（日本語）：
・メインタイトル（最重要）：「${mainTitle}」
${subTitle ? `・サブタイトル：「${subTitle}」` : ''}

文字表現：
・太めのゴシック体、日本語可読性重視
・メインタイトルは白文字
・一部キーワードは黄色 or ネオン系アクセントカラーで強調
・文字はボックスや下線で囲ってもOK

配色：
・メインカラー：${colors}
・背景はダークトーン（黒〜ダークグレー基調）
・アクセントカラーで視認性を確保

ビジュアル要素：
・${genreVisuals}
・「比較」「分析」「網羅」「ランキング」が伝わる
・人物は不要（入れる場合もシルエット程度）

${imageDescription ? `ユーザー指定のビジュアル要素：
${imageDescription}
上記の要素を優先的に反映してください。
` : ''}

避けたい点：
・ポップすぎる / かわいすぎる
・BtoC感が強いデザイン
・イラスト感が強すぎる表現

全体の印象：
「${genre}に本気な人がクリックしたくなる、"保存版・決定版"感のある記事バナー」

${customPrompt ? `
=== カスタム指示（エンタープライズ） ===
${customPrompt}
` : ''}

=== 出力サイズ（必須） ===
**正確に ${width}×${height} ピクセル**
・出力画像は必ず幅${width}px、高さ${height}pxで生成すること
・アスペクト比を絶対に変更しないこと
・キャンバス全体をコンテンツで埋める（レターボックス、余白、パディング、ボーダーなし）
・日本語テキストは必ず可読性を確保
・1枚のPNG画像を ${width}×${height} ピクセルで返すこと
`.trim()

  return prompt
}

// 単一テンプレートのバナーを生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      templateId,
      mainTitle,
      subTitle,
      size = '1200x628',
      count = 3,
      imageDescription,
      brandColors,
      customPrompt,
    } = body

    if (!templateId) {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
    }

    if (!mainTitle || !mainTitle.trim()) {
      return NextResponse.json({ error: 'mainTitle is required' }, { status: 400 })
    }

    const template = articleTemplates.find(t => t.id === templateId)
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // API設定チェック
    if (!isNanobannerConfigured()) {
      return NextResponse.json(
        { error: 'バナー生成APIが設定されていません。管理者にお問い合わせください。' },
        { status: 503 }
      )
    }

    const category = getCategoryFromTemplate(template)
    const keyword = extractKeyword(mainTitle)
    const targetCount = Math.max(1, Math.min(10, Math.floor(count || 3)))

    console.log(`Generating banner for template: ${templateId} - ${mainTitle}`)

    const banners: string[] = []
    const prompts: string[] = []

    // 各バリエーションを生成
    for (let i = 0; i < targetCount; i++) {
      try {
        const prompt = buildArticleBannerPrompt({
          template,
          mainTitle,
          subTitle,
          size,
          variationIndex: i,
          imageDescription,
          brandColors,
          customPrompt,
        })
        prompts.push(prompt)

        const result = await generateBanners(
          category,
          keyword,
          size,
          {
            purpose: 'article_banner',
            headlineText: mainTitle,
            subheadText: subTitle || undefined,
            imageDescription: imageDescription || getImageDescription(template),
            brandColors: brandColors || getBrandColors(template),
            customImagePrompt: prompt,
          },
          1
        )

        if (result.banners && result.banners.length > 0 && !result.banners[0].startsWith('https://placehold')) {
          banners.push(result.banners[0])
        } else {
          console.error(`Banner ${i + 1} generation failed:`, result.error)
        }

        // API制限を考慮して待機
        if (i < targetCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } catch (error: any) {
        console.error(`Banner ${i + 1} generation error:`, error.message)
      }
    }

    if (banners.length === 0) {
      return NextResponse.json({
        success: false,
        templateId,
        error: 'バナーの生成に失敗しました',
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      templateId,
      banners,
      prompts,
      count: banners.length,
    })
  } catch (error: any) {
    console.error('Banner generation error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 })
  }
}

// 全テンプレートのバナーを一括生成（バッチ処理用）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { templateIds } = body

    const targets = templateIds
      ? articleTemplates.filter(t => templateIds.includes(t.id))
      : articleTemplates

    const results: Array<{ templateId: string; imageUrl: string | null; error?: string }> = []

    for (const template of targets) {
      try {
        const category = getCategoryFromTemplate(template)
        const keyword = extractKeyword(template.title)
        const size = '1200x628'

        const prompt = buildArticleBannerPrompt({
          template,
          mainTitle: template.title,
          size,
          variationIndex: 0,
        })

        const result = await generateBanners(
          category,
          keyword,
          size,
          {
            purpose: 'article_banner',
            headlineText: template.title,
            imageDescription: getImageDescription(template),
            brandColors: getBrandColors(template),
            customImagePrompt: prompt,
          },
          1
        )

        if (result.banners && result.banners.length > 0 && !result.banners[0].startsWith('https://placehold')) {
          results.push({
            templateId: template.id,
            imageUrl: result.banners[0],
          })
        } else {
          results.push({
            templateId: template.id,
            imageUrl: null,
            error: result.error || 'Generation failed',
          })
        }

        // API制限を考慮して待機
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (error: any) {
        results.push({
          templateId: template.id,
          imageUrl: null,
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      total: results.length,
      successCount: results.filter(r => r.imageUrl).length,
      failCount: results.filter(r => !r.imageUrl).length,
    })
  } catch (error: any) {
    console.error('Batch banner generation error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 })
  }
}
