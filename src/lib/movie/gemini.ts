// ============================================
// ドヤムービーAI - Gemini API 連携
// ============================================
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ProductInfo, MoviePersona, MoviePlan, SceneData } from './types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENAI_API_KEY ?? '')

const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

// ---- 商品情報解析 ----

export async function analyzeProduct(input: {
  name?: string
  url?: string
  description?: string
  features?: string[]
  target?: string
  usp?: string
  industry?: string
}): Promise<ProductInfo> {
  const prompt = `
あなたは動画広告の企画担当者です。以下の商品/サービス情報を分析して、JSON形式で返してください。

## 入力情報
商品名: ${input.name ?? '未入力'}
URL: ${input.url ?? 'なし'}
説明: ${input.description ?? '未入力'}
特徴: ${(input.features ?? []).join(', ') || '未入力'}
ターゲット: ${input.target ?? '未入力'}
USP: ${input.usp ?? '未入力'}
業種: ${input.industry ?? '未入力'}

## 出力形式（JSON）
{
  "name": "商品/サービス名",
  "description": "100字以内の簡潔な説明",
  "features": ["特徴1", "特徴2", "特徴3"],
  "target": "ターゲット顧客の説明",
  "usp": "他社との差別化ポイント（1行）",
  "industry": "業種（it_saas/ec_retail/food/real_estate/beauty/education/finance/medical/recruit/btob/generalのいずれか）"
}

JSONのみ返してください。説明文は不要です。
`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    return JSON.parse(json) as ProductInfo
  } catch {
    return {
      name: input.name ?? '不明',
      description: input.description ?? '',
      features: input.features ?? [],
      target: input.target ?? '',
      usp: input.usp ?? '',
      industry: input.industry ?? 'general',
    }
  }
}

// ---- 企画3案生成（SSEストリーム対応）----
// 3案を順番に1案ずつ yield する AsyncGenerator

export async function* generatePlansStream(
  productInfo: ProductInfo,
  persona: MoviePersona | null,
  config: { duration: number; platform: string; aspectRatio: string }
): AsyncGenerator<MoviePlan> {
  const prompt = `
あなたはプロの動画広告クリエイターです。以下の商品情報とペルソナに基づき、動画広告の企画を3案提案してください。

## 商品情報
商品名: ${productInfo.name}
説明: ${productInfo.description}
特徴: ${productInfo.features.join(', ')}
ターゲット: ${productInfo.target}
USP: ${productInfo.usp}

## ペルソナ
${persona ? `年齢: ${persona.age}, 性別: ${persona.gender}, 職業: ${persona.occupation}, 悩み: ${persona.pain}, ゴール: ${persona.goal}` : 'ペルソナ未設定（汎用訴求）'}

## 動画設定
尺: ${config.duration}秒, 配信先: ${config.platform}, アスペクト比: ${config.aspectRatio}

## 出力形式（JSON配列、必ず3要素）
[
  {
    "index": 0,
    "concept": "企画コンセプト（1行）",
    "storyline": { "opening": "起", "development": "承", "climax": "転", "conclusion": "結" },
    "scenes": [{ "order": 0, "duration": 3, "content": "シーン内容", "textSuggestion": "表示テキスト", "direction": "演出指示" }],
    "bgmMood": "コーポレート",
    "narrationStyle": "落ち着いた男性ナレーション"
  },
  { "index": 1 },
  { "index": 2 }
]
JSONのみ返してください。
`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const plans = JSON.parse(json) as MoviePlan[]
    if (!Array.isArray(plans)) throw new Error('not an array')
    for (const plan of plans.slice(0, 3)) {
      yield plan
      await new Promise(r => setTimeout(r, 200))
    }
  } catch (error) {
    console.error('[generatePlansStream]', error)
    const bgmMoods = ['コーポレート', 'エネルギッシュ', '感動的']
    for (let i = 0; i < 3; i++) {
      const plan: MoviePlan = {
        index: i,
        concept: `${productInfo.name} 訴求プラン${i + 1}`,
        storyline: {
          opening: `${productInfo.name}をご存知ですか？`,
          development: `多くの方が抱える${productInfo.target}の課題`,
          climax: `${productInfo.usp || productInfo.name}で解決`,
          conclusion: 'まずは試してみてください',
        },
        scenes: [
          { order: 0, duration: config.duration * 0.3, content: '商品紹介', textSuggestion: productInfo.name, direction: 'フェードイン' },
          { order: 1, duration: config.duration * 0.4, content: '特徴説明', textSuggestion: productInfo.usp || productInfo.description.slice(0, 30), direction: 'スライドイン' },
          { order: 2, duration: config.duration * 0.3, content: 'CTA', textSuggestion: '詳細はこちら', direction: 'ズームアウト' },
        ],
        bgmMood: bgmMoods[i],
        narrationStyle: '落ち着いた男性ナレーション',
      }
      yield plan
      await new Promise(r => setTimeout(r, 200))
    }
  }
}

// ---- シーンデータ生成 ----

export async function generateScenes(
  plan: MoviePlan,
  productInfo: ProductInfo,
  config: { duration: number; aspectRatio: string; templateId?: string }
): Promise<SceneData[]> {
  const prompt = `
あなたはRemotionを使った動画制作エンジニアです。以下の企画に基づき、動画のシーンデータをJSONで生成してください。

## 企画
コンセプト: ${plan.concept}
起: ${plan.storyline.opening} / 承: ${plan.storyline.development} / 転: ${plan.storyline.climax} / 結: ${plan.storyline.conclusion}

## 商品: ${productInfo.name} / USP: ${productInfo.usp}
## 設定: 総尺${config.duration}秒, アスペクト比${config.aspectRatio}

## 出力JSON配列
[
  {
    "order": 0, "duration": 3.0,
    "bgType": "gradient",
    "bgValue": "linear-gradient(135deg, #f43f5e, #ec4899)",
    "bgAnimation": "none",
    "texts": [{ "content": "テキスト", "x": 50, "y": 45, "fontSize": 40, "fontFamily": "Noto Sans JP", "color": "#ffffff", "animation": "fade-in", "delay": 0.3, "align": "center" }],
    "narrationText": "ナレーション原稿",
    "transition": "fade"
  }
]
bgTypeは"gradient"か"color"のみ。bgValueはgradientなら"linear-gradient(135deg,#色1,#色2)"、colorなら"#hex"。
animationは"fade-in"/"slide-up"/"typewriter"/"zoom-in"/"none"のいずれか。
transitionは"fade"/"slide"/"wipe"/"zoom"/"none"のいずれか。
総尺が${config.duration}秒になるよう調整。JSONのみ返してください。
`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    const scenes = JSON.parse(json) as SceneData[]
    if (!Array.isArray(scenes)) throw new Error('Invalid scenes')
    return scenes
  } catch {
    return [
      { order: 0, duration: config.duration * 0.25, bgType: 'gradient', bgValue: 'linear-gradient(135deg, #f43f5e, #ec4899)', bgAnimation: 'none', texts: [{ content: productInfo.name, x: 50, y: 45, fontSize: 40, fontFamily: 'Noto Sans JP', color: '#ffffff', animation: 'fade-in', delay: 0.3, align: 'center' }], transition: 'fade' },
      { order: 1, duration: config.duration * 0.35, bgType: 'color', bgValue: '#0f172a', bgAnimation: 'none', texts: [{ content: productInfo.description.slice(0, 40), x: 50, y: 50, fontSize: 24, fontFamily: 'Noto Sans JP', color: '#e2e8f0', animation: 'slide-up', delay: 0.3, align: 'center' }], transition: 'slide' },
      { order: 2, duration: config.duration * 0.25, bgType: 'gradient', bgValue: 'linear-gradient(135deg, #1e1b4b, #312e81)', bgAnimation: 'none', texts: [{ content: productInfo.usp || '今すぐ試す', x: 50, y: 45, fontSize: 32, fontFamily: 'Noto Sans JP', color: '#c7d2fe', animation: 'zoom-in', delay: 0.3, align: 'center' }], transition: 'wipe' },
      { order: 3, duration: config.duration * 0.15, bgType: 'gradient', bgValue: 'linear-gradient(135deg, #f43f5e, #ec4899)', bgAnimation: 'none', texts: [{ content: '詳細はこちら ▶', x: 50, y: 50, fontSize: 28, fontFamily: 'Noto Sans JP', color: '#ffffff', animation: 'fade-in', delay: 0.2, align: 'center' }], transition: 'fade' },
    ]
  }
}
