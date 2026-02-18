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

// 生成対象テンプレート
const TEMPLATES = [
  {
    id: 'guide-1',
    title: 'ChatGPTの使い方 完全ガイド',
    category: 'it',
    genre: 'AI・テクノロジー',
    colors: ['#8B5CF6', '#6366F1'],
    visuals: 'AIチャットインターフェース、ニューラルネットワーク、デジタルブレイン、未来的なUI',
  },
  {
    id: 'guide-2',
    title: '副業の始め方｜月5万円ロードマップ',
    category: 'marketing',
    genre: '副業・収入',
    colors: ['#F59E0B', '#EAB308'],
    visuals: 'グラフの上昇、コイン、ノートPC、自由な働き方のイメージ',
  },
  {
    id: 'guide-3',
    title: 'マーケティングとは？基礎から実践',
    category: 'marketing',
    genre: 'マーケティング',
    colors: ['#F97316', '#FB923C'],
    visuals: 'アナリティクス、ファネル、グラフ、マーケティングダッシュボード',
  },
  {
    id: 'guide-4',
    title: 'DX推進の進め方｜成功する7ステップ',
    category: 'it',
    genre: 'DX・変革',
    colors: ['#6366F1', '#818CF8'],
    visuals: 'デジタル化のイメージ、変革のプロセス、ビフォーアフター',
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
  const mainTitle = tmpl.title.split('｜')[0].trim()

  return `
目的：
「${mainTitle}」
という記事・特集ページ用のアイキャッチ兼バナー画像を制作したい。

ジャンル：${tmpl.genre}

参考イメージ：
・全体は解説・ガイド記事の雰囲気、知識を伝えるクリーンなデザイン
・${tmpl.visuals}
・情報量が多いが、整理されていて"知的・プロ向け"な印象
・${tmpl.genre}に関心のある読者が惹かれるビジュアル

デザインテイスト：
・クール / 知的 / 信頼感 / 最新トレンド
・「情報を網羅的に比較・整理している」雰囲気
・広告っぽすぎず、メディア・ホワイトペーパー寄り
・2026年感のあるモダンなデザイン

構図：
・横長バナー（${width}×${height}想定）
・左〜中央に大きなタイトル文字
・右側または背景に、${tmpl.visuals}を想起させるビジュアル
・奥行き感（軽いボケ・レイヤー重なり）
Layout: split-screen with large headline on left, visual elements on right. Dark background with UI mosaics.

入れたいテキスト（日本語）：
・メインタイトル（最重要）：「${mainTitle}」

文字表現：
・太めのゴシック体、日本語可読性重視
・メインタイトルは白文字
・一部キーワードは黄色 or ネオン系アクセントカラーで強調
・文字はボックスや下線で囲ってもOK

配色：
・メインカラー：${tmpl.colors.join('、')}
・背景はダークトーン（黒〜ダークグレー基調）
・アクセントカラーで視認性を確保

ビジュアル要素：
・${tmpl.visuals}
・「比較」「分析」「網羅」「ランキング」が伝わる
・人物は不要（入れる場合もシルエット程度）

避けたい点：
・ポップすぎる / かわいすぎる
・BtoC感が強いデザイン
・イラスト感が強すぎる表現

全体の印象：
「${tmpl.genre}に本気な人がクリックしたくなる、"保存版・決定版"感のある記事バナー」

=== 出力サイズ（必須） ===
**正確に ${width}×${height} ピクセル**
・出力画像は必ず幅${width}px、高さ${height}pxで生成すること
・アスペクト比を絶対に変更しないこと
・キャンバス全体をコンテンツで埋める（レターボックス、余白、パディング、ボーダーなし）
・日本語テキストは必ず可読性を確保
・1枚のPNG画像を ${width}×${height} ピクセルで返すこと
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
