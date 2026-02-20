/**
 * SEO記事テンプレート用バナー生成＆DB保存スクリプト
 *
 * 使い方:
 * cd 09_Cursol && set -a && source .env.local && set +a && npx tsx scripts/generate-seo-banners.ts
 */
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'

const prisma = new PrismaClient()

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// 生成対象テンプレート（design-library.jp風スタイリッシュデザイン）
const TEMPLATES = [
  {
    id: 'guide-1',
    title: 'ChatGPTの使い方\n完全ガイド',
    subtitle: '初心者でも5分で始められる',
    bgStyle: 'ダークネイビー〜ブラックのグラデーション背景',
    accentColor: '#818CF8（ラベンダー/バイオレット）',
    visualConcept: 'ミニマルなAIチャットUI画面のモックアップ（右寄り配置、半透明、奥行き感）。吹き出しアイコン、ニューラルネットワークの微細なライン装飾が背景にうっすら',
    layoutHint: 'テキスト左寄せ、右側にビジュアル。余白を大きくとり、洗練された"メディア記事"のアイキャッチ感',
  },
  {
    id: 'guide-2',
    title: '副業の始め方',
    subtitle: '月5万円ロードマップ',
    bgStyle: 'ウォームグレー〜ベージュの上品なグラデーション背景',
    accentColor: '#F59E0B（ゴールド/アンバー）',
    visualConcept: 'ノートPC＋コーヒーカップの俯瞰風景がうっすら透けた背景（低彩度）。右上の上昇グラフアイコン（シンプルな線画）',
    layoutHint: 'テキスト中央寄せ。ゴールドのアクセントラインで区切り。ナチュラル＆信頼感のある雰囲気',
  },
  {
    id: 'guide-3',
    title: 'マーケティングとは？',
    subtitle: '基礎から実践まで',
    bgStyle: '白〜ライトグレーのクリーンな背景',
    accentColor: '#2563EB（ロイヤルブルー）',
    visualConcept: '幾何学的なファネル図形やグラフのアイコンが右寄りにフロート配置（フラットデザイン、低彩度のブルー系）。アナリティクスダッシュボードの断片が装飾的に',
    layoutHint: 'テキスト左寄せ、大きな余白。白背景にブルーのアクセント。清潔感＋知的なメディアバナー感',
  },
  {
    id: 'guide-4',
    title: 'DX推進の進め方',
    subtitle: '成功する7ステップ',
    bgStyle: 'ディープブルー〜インディゴのグラデーション背景',
    accentColor: '#38BDF8（スカイブルー）＋#F472B6（ピンク）',
    visualConcept: 'デジタルトランスフォーメーションを象徴するシンプルなアイコン群（歯車→クラウド→グラフ）が横に並ぶ。幾何学パターンの微細な装飾',
    layoutHint: 'テキスト中央〜左。「7」の数字を大きくアクセント表示。未来感＋プロフェッショナルな雰囲気',
  },
]

function getApiKey(): string {
  const key = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!key) throw new Error('GOOGLE_GENAI_API_KEY not set')
  return key
}

async function resolveModel(apiKey: string): Promise<string> {
  // ListModelsからNano Banana Proを見つける
  const res = await fetch(`${GEMINI_API_BASE}/models`, {
    headers: { 'x-goog-api-key': apiKey },
  })
  if (!res.ok) throw new Error(`ListModels failed: ${res.status}`)
  const json = await res.json()
  const models = (json.models || []) as any[]

  // banana / gemini-3-pro-image を探す
  const candidates = models
    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: any) => String(m.name || '').replace(/^models\//, ''))

  const banana = candidates.find((n: string) => n.toLowerCase().includes('banana'))
  if (banana) return banana

  const imagey = candidates.find((n: string) => n.toLowerCase().includes('image'))
  if (imagey) return imagey

  // フォールバック
  return 'gemini-3-pro-image-preview'
}

function buildPrompt(tmpl: typeof TEMPLATES[0], size: string): string {
  const [width, height] = size.split('x')

  return `
あなたはバナーデザインギャラリーサイトに掲載される"スタイリッシュ・おしゃれ"カテゴリの
トップクオリティ記事バナーを制作するデザイナーです。

■ 制作するもの
記事アイキャッチバナー（${width}×${height}px、横長）

■ デザインの方向性（最重要）
・「シンプル」「スタイリッシュ」「高級感・きれいめ」がキーワード
・余白を大胆に使い、情報を詰め込みすぎない
・タイポグラフィ（文字組み）を主役にしたデザイン
・広告バナーではなく、メディア・マガジンの記事ヘッダー風
・洗練された大人っぽいトーン。ポップさ・イラスト感は排除

■ 背景
・${tmpl.bgStyle}
・微細なテクスチャやグラデーションで奥行きを出すのはOK
・ベタ塗りではなく、ほんの少し動きのある背景

■ アクセントカラー
・${tmpl.accentColor}
・アクセントは控えめに。線・小さなアイコン・文字の一部に使用

■ ビジュアル要素（控えめに）
・${tmpl.visualConcept}
・ビジュアル要素はあくまでテキストを引き立てる装飾。主役はテキスト
・要素の透明度を落としたり、背景に溶け込ませる
・人物は不要

■ テキスト（日本語・必ず画像内に含める）
・メインタイトル：「${tmpl.title}」
　→ 太めのゴシック体、大きく配置、可読性最優先
　→ テキストと背景のコントラストを十分確保
・サブタイトル：「${tmpl.subtitle}」
　→ メインより小さく、控えめに配置

■ レイアウト
・${tmpl.layoutHint}
・文字の周囲に十分な余白（パディング）をとること
・テキストがビジュアル要素に被って読めなくなるのは絶対NG

■ 禁止事項
・文字化け、存在しない漢字、意味不明な文字列
・ポップ・カワイイ・ガチャガチャしたデザイン
・CTA/ボタン要素
・ウォーターマーク、ロゴ、署名
・テキストの重複表示
・日本語が正しく表示できない場合はテキストなしで生成

■ 品質基準
「バナーデザインギャラリーの"スタイリッシュ・おしゃれ"カテゴリに
掲載されてもおかしくない、プロのデザイナーが作ったクオリティ」

=== 出力サイズ（必須） ===
**正確に ${width}×${height} ピクセル**
・幅${width}px × 高さ${height}px で出力
・アスペクト比厳守、キャンバス全体を使う
・レターボックス、余白パディング、ボーダーは禁止
・1枚のPNG画像を返すこと
`.trim()
}

async function generateBanner(apiKey: string, model: string, tmpl: typeof TEMPLATES[0]): Promise<string> {
  const size = '1200x628'
  const prompt = buildPrompt(tmpl, size)
  const [w, h] = size.split('x').map(Number)

  const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{
        text: [
          prompt,
          '',
          '=== MANDATORY OUTPUT CONSTRAINTS ===',
          `**TARGET SIZE: ${w}x${h} pixels (width x height)**`,
          '**ASPECT RATIO: landscape (horizontal)**',
          '',
          'CRITICAL REQUIREMENTS:',
          '- Generate image with landscape (horizontal) aspect ratio.',
          '- Fill the entire canvas edge-to-edge with content.',
          '- NO letterboxing, NO empty bars, NO padding, NO borders.',
          '',
          '=== JAPANESE TEXT QUALITY (CRITICAL) ===',
          '- Japanese text must be PERFECTLY CORRECT and READABLE.',
          '- ABSOLUTELY FORBIDDEN: garbled text, non-existent kanji, meaningless character combinations.',
          '- If you cannot render Japanese text correctly, DO NOT include any text in the image.',
          '- Better to have NO TEXT than WRONG TEXT.',
          '',
          'Return ONE PNG image.',
        ].join('\n'),
      }],
    }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      temperature: 0.4,
      candidateCount: 1,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  }

  console.log(`  Calling ${model}...`)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API error ${response.status}: ${errorText.substring(0, 300)}`)
  }

  const result = await response.json()
  const parts = result?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) throw new Error('No parts in response')

  for (const part of parts) {
    const inline = part?.inlineData || part?.inline_data
    if (inline?.data) {
      // Resize to exact dimensions
      const imageBuffer = Buffer.from(inline.data, 'base64')
      const resized = await sharp(imageBuffer)
        .resize({ width: w, height: h, fit: 'fill' })
        .png()
        .toBuffer()

      return `data:image/png;base64,${resized.toString('base64')}`
    }
  }

  throw new Error('No image data in response')
}

async function saveToDB(templateId: string, imageData: string) {
  const dbId = `seo-article-${templateId}`

  await prisma.bannerTemplate.upsert({
    where: { templateId: dbId },
    update: {
      previewUrl: imageData,
      imageUrl: imageData,
      isActive: true,
    },
    create: {
      templateId: dbId,
      industry: 'seo',
      category: 'article-banner',
      prompt: `SEO article banner for ${templateId}`,
      size: '1200x628',
      previewUrl: imageData,
      imageUrl: imageData,
      isActive: true,
    },
  })

  console.log(`  Saved to DB as ${dbId}`)
}

async function main() {
  console.log('=== SEO Article Banner Generator ===')

  const apiKey = getApiKey()
  console.log('API key found')

  const model = await resolveModel(apiKey)
  console.log(`Resolved model: ${model}`)

  const results: { id: string; success: boolean; error?: string }[] = []

  for (let i = 0; i < TEMPLATES.length; i++) {
    const tmpl = TEMPLATES[i]
    console.log(`\n[${i + 1}/${TEMPLATES.length}] ${tmpl.id}: ${tmpl.title}`)

    try {
      const imageData = await generateBanner(apiKey, model, tmpl)
      console.log(`  Generated (${Math.round(imageData.length / 1024)}KB)`)

      await saveToDB(tmpl.id, imageData)
      results.push({ id: tmpl.id, success: true })
    } catch (err: any) {
      console.error(`  FAILED: ${err.message}`)
      results.push({ id: tmpl.id, success: false, error: err.message })
    }

    // API rate limit
    if (i < TEMPLATES.length - 1) {
      console.log('  Waiting 3s...')
      await new Promise(r => setTimeout(r, 3000))
    }
  }

  console.log('\n=== Results ===')
  for (const r of results) {
    console.log(`${r.success ? 'OK' : 'NG'} ${r.id}${r.error ? ` - ${r.error}` : ''}`)
  }

  const ok = results.filter(r => r.success).length
  const ng = results.filter(r => !r.success).length
  console.log(`\nTotal: ${ok} success, ${ng} failed`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
