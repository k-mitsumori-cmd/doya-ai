// ============================================
// ドヤコピーAI - Gemini AI連携
// ============================================

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

function getApiKey(): string {
  const key = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!key) throw new Error('Gemini API key not configured')
  return key
}

function getFlashModel(): string {
  return process.env.GEMINI_FLASH_MODEL || 'gemini-2.0-flash'
}

async function generateText(prompt: string, temperature = 0.8): Promise<string> {
  const apiKey = getApiKey()
  const model = getFlashModel()
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: 8192,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    let jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const start = jsonStr.indexOf('{')
    const end = jsonStr.lastIndexOf('}')
    if (start !== -1 && end !== -1) jsonStr = jsonStr.slice(start, end + 1)
    return JSON.parse(jsonStr) as T
  } catch (e) {
    console.error('Copy gemini JSON parse failed:', e)
    return fallback
  }
}

function parseJsonArray<T>(text: string, fallback: T[]): T[] {
  try {
    let jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const start = jsonStr.indexOf('[')
    const end = jsonStr.lastIndexOf(']')
    if (start !== -1 && end !== -1) jsonStr = jsonStr.slice(start, end + 1)
    return JSON.parse(jsonStr) as T[]
  } catch (e) {
    console.error('Copy gemini JSON array parse failed:', e)
    return fallback
  }
}

// ============================================
// URL解析
// ============================================

export interface ProductInfo {
  productName: string
  category: string
  targetAudience: string
  mainBenefit: string
  features: string[]
  priceRange: string
  tone: string
  uniqueValue: string
}

export async function analyzeProductUrl(url: string, htmlContent: string): Promise<ProductInfo> {
  const prompt = `以下のWebページの情報を分析して、広告コピー生成に必要な情報をJSON形式で抽出してください。

URL: ${url}
ページ内容（HTMLから抽出したテキスト）:
${htmlContent.slice(0, 3000)}

以下のJSON形式で回答してください（JSONのみ、説明文不要）:
{
  "productName": "商品・サービス名（20文字以内）",
  "category": "カテゴリ（例: SaaS, EC, 美容, 教育, 不動産 など）",
  "targetAudience": "ターゲット層（例: 20〜30代の働く女性 など）",
  "mainBenefit": "最大のベネフィット（50文字以内）",
  "features": ["特徴1", "特徴2", "特徴3"],
  "priceRange": "価格帯（例: 月額¥9,800〜、要問合せ など）",
  "tone": "ブランドトーン（professional|casual|luxury|playful|trustworthy のいずれか）",
  "uniqueValue": "競合との差別化ポイント（50文字以内）"
}`

  const text = await generateText(prompt, 0.3)
  return parseJson<ProductInfo>(text, {
    productName: '商品・サービス',
    category: 'その他',
    targetAudience: '一般ユーザー',
    mainBenefit: '便利で使いやすいサービスです',
    features: ['高品質', '使いやすい', 'お得'],
    priceRange: '要問合せ',
    tone: 'professional',
    uniqueValue: '独自の価値を提供',
  })
}

// ============================================
// ペルソナ生成
// ============================================

export interface PersonaData {
  name: string
  age: string
  gender: string
  occupation: string
  income: string
  painPoints: string[]
  desires: string[]
  keywords: string[]
  searchBehavior: string
  purchaseTrigger: string
}

export async function generatePersonaFromProduct(productInfo: ProductInfo): Promise<PersonaData> {
  const prompt = `以下の商品・サービス情報から、最もコンバージョンしやすいペルソナを生成してください。

商品名: ${productInfo.productName}
カテゴリ: ${productInfo.category}
ターゲット層: ${productInfo.targetAudience}
主なベネフィット: ${productInfo.mainBenefit}
特徴: ${productInfo.features.join('、')}
差別化ポイント: ${productInfo.uniqueValue}

以下のJSON形式で回答してください（JSONのみ、説明文不要）:
{
  "name": "架空の名前（例: 田中 恵子）",
  "age": "年齢層（例: 32歳）",
  "gender": "性別",
  "occupation": "職業（例: 会社員・マーケター）",
  "income": "年収帯（例: 400〜500万円）",
  "painPoints": ["悩み・課題1", "悩み・課題2", "悩み・課題3"],
  "desires": ["欲求・願望1", "欲求・願望2", "欲求・願望3"],
  "keywords": ["検索キーワード1", "検索キーワード2", "検索キーワード3", "検索キーワード4", "検索キーワード5"],
  "searchBehavior": "購買行動の特徴（50文字以内）",
  "purchaseTrigger": "購買のトリガー・決め手（50文字以内）"
}`

  const text = await generateText(prompt, 0.7)
  return parseJson<PersonaData>(text, {
    name: '田中 恵子',
    age: '30代前半',
    gender: '女性',
    occupation: '会社員',
    income: '300〜400万円',
    painPoints: ['時間が足りない', 'コストが気になる', '使い方がわからない'],
    desires: ['効率化したい', 'コストを抑えたい', 'すぐに使い始めたい'],
    keywords: ['おすすめ', '比較', '無料', '簡単', '評判'],
    searchBehavior: '比較サイトやSNSで口コミを確認してから検討する',
    purchaseTrigger: '無料トライアルや限定オファーをきっかけに即決することが多い',
  })
}

// ============================================
// 広告コピー生成（ディスプレイ）
// ============================================

export interface DisplayCopyItem {
  writerType: string
  appealAxis: string
  headline: string
  description: string
  catchcopy: string
  cta: string
}

export interface CopyRegulations {
  ngWords?: string[]
  requiredWords?: string[]
  maxHeadlineLength?: number
  maxDescriptionLength?: number
}

const WRITER_PROMPTS: Record<string, string> = {
  straight: '【ストレート型】ベネフィットを直接・明確に伝える。「〜できる」「〜が手に入る」という形式。感情に訴えず、事実とメリットで勝負。',
  emotional: '【エモーショナル型】ペインポイントや感情に訴求する。「〜で悩んでいませんか？」「もう〜は卒業」などの共感・解放型。',
  logical: '【ロジカル型】数字・実績・データを活用する。「〇〇%改善」「累計〇万人利用」など客観的な証拠で説得。',
  provocative: '【プロボカティブ型】常識を疑い、意外性や挑発で注目を集める。「なぜ〇〇するのか」「〇〇はもう古い」など。',
  story: '【ストーリー型】ビフォーアフターや変化の物語で共感を呼ぶ。「〜だった私が〇〇になれた理由」など。',
}

export const WRITER_TYPES = Object.keys(WRITER_PROMPTS)

/**
 * 1ライタータイプ分のコピーを生成（SSEストリーミング用）
 */
export async function generateDisplayCopiesForType(
  writerType: string,
  productInfo: ProductInfo,
  persona: PersonaData,
  regulations?: CopyRegulations,
  purpose?: string,
): Promise<DisplayCopyItem[]> {
  const writerInstruction = WRITER_PROMPTS[writerType]
  if (!writerInstruction) return []

  const maxHeadline = regulations?.maxHeadlineLength || 30
  const maxDesc = regulations?.maxDescriptionLength || 90
  const ngWords = regulations?.ngWords?.join('、') || 'なし'
  const requiredWords = regulations?.requiredWords?.join('、') || 'なし'

  const prompt = `あなたは優秀な広告コピーライターです。以下の情報をもとに、ディスプレイ広告コピーを4案生成してください。

【ライタースタイル】
${writerInstruction}

【商品情報】
商品名: ${productInfo.productName}
カテゴリ: ${productInfo.category}
主なベネフィット: ${productInfo.mainBenefit}
特徴: ${productInfo.features.join('、')}
差別化ポイント: ${productInfo.uniqueValue}
価格帯: ${productInfo.priceRange}
${purpose ? `訴求目的: ${purpose}` : ''}

【ターゲットペルソナ】
${persona.name}（${persona.age}、${persona.gender}、${persona.occupation}）
悩み: ${persona.painPoints.join('、')}
欲求: ${persona.desires.join('、')}
購買トリガー: ${persona.purchaseTrigger}

【レギュレーション】
NGワード: ${ngWords}
必須ワード: ${requiredWords}
ヘッドライン上限: ${maxHeadline}文字
説明文上限: ${maxDesc}文字

以下のJSON配列形式で4案を回答してください（JSONのみ、説明文不要）:
[
  {
    "writerType": "${writerType}",
    "appealAxis": "訴求軸（例: コスト削減、時間効率化、安心感 など）",
    "headline": "ヘッドライン（${maxHeadline}文字以内）",
    "description": "説明文（${maxDesc}文字以内）",
    "catchcopy": "キャッチコピー（15文字以内）",
    "cta": "CTA（10文字以内、例: 無料で試す、詳細を見る）"
  }
]`

  try {
    const text = await generateText(prompt, 0.9)
    const items = parseJsonArray<DisplayCopyItem>(text, [])
    return items.map(item => ({ ...item, writerType }))
  } catch (e) {
    console.error(`Copy generation failed for ${writerType}:`, e)
    return []
  }
}

/**
 * 全ライタータイプのコピーを一括生成
 */
export async function generateDisplayCopies(
  productInfo: ProductInfo,
  persona: PersonaData,
  regulations?: CopyRegulations,
  purpose?: string,
): Promise<DisplayCopyItem[]> {
  const allCopies: DisplayCopyItem[] = []
  for (const writerType of WRITER_TYPES) {
    const copies = await generateDisplayCopiesForType(writerType, productInfo, persona, regulations, purpose)
    allCopies.push(...copies)
  }
  return allCopies
}

// ============================================
// ブラッシュアップ
// ============================================

export async function brushupCopy(
  original: { headline: string; description: string; catchcopy: string; cta: string },
  instruction: string,
  productInfo: ProductInfo,
): Promise<{ headline: string; description: string; catchcopy: string; cta: string }> {
  const prompt = `以下の広告コピーを、指示に従って修正してください。

【元のコピー】
ヘッドライン: ${original.headline}
説明文: ${original.description}
キャッチコピー: ${original.catchcopy}
CTA: ${original.cta}

【修正指示】
${instruction}

【商品情報】
商品名: ${productInfo.productName}
主なベネフィット: ${productInfo.mainBenefit}

以下のJSON形式で修正後のコピーを回答してください（JSONのみ）:
{
  "headline": "修正後ヘッドライン（30文字以内）",
  "description": "修正後説明文（90文字以内）",
  "catchcopy": "修正後キャッチコピー（15文字以内）",
  "cta": "修正後CTA（10文字以内）"
}`

  const text = await generateText(prompt, 0.8)
  return parseJson(text, original)
}

// ============================================
// 検索広告コピー生成（RSA）
// ============================================

export interface SearchCopyItem {
  headlines: string[]
  descriptions: string[]
  displayPath: string[]
}

export async function generateSearchCopies(
  productInfo: ProductInfo,
  persona: PersonaData,
  platform: 'google' | 'yahoo',
  keywords: string[],
): Promise<SearchCopyItem> {
  const headlineMax = platform === 'google' ? 30 : 20
  const descMax = platform === 'google' ? 90 : 50
  const headlineCount = 15
  const descCount = 4

  const prompt = `${platform === 'google' ? 'Google' : 'Yahoo!'}広告のレスポンシブ検索広告（RSA）用コピーを生成してください。

【商品情報】
商品名: ${productInfo.productName}
主なベネフィット: ${productInfo.mainBenefit}
特徴: ${productInfo.features.join('、')}
差別化: ${productInfo.uniqueValue}

【ターゲット】
${persona.painPoints.slice(0, 2).join('、')}

【検索キーワード】
${keywords.join('、')}

【文字数制限】
ヘッドライン: ${headlineMax}文字以内 × ${headlineCount}案
説明文: ${descMax}文字以内 × ${descCount}案
表示URL（パス）: 15文字以内 × 2つ

以下のJSON形式で回答してください（JSONのみ）:
{
  "headlines": ["ヘッドライン1", ..., "ヘッドライン${headlineCount}"],
  "descriptions": ["説明文1", "説明文2", "説明文3", "説明文4"],
  "displayPath": ["パス1", "パス2"]
}`

  const text = await generateText(prompt, 0.85)
  return parseJson<SearchCopyItem>(text, {
    headlines: Array(headlineCount).fill('魅力的なヘッドライン'),
    descriptions: Array(descCount).fill('サービスの説明文です。詳細はこちらから。'),
    displayPath: [productInfo.category, '詳細'],
  })
}

// ============================================
// SNS広告コピー生成
// ============================================

export interface SnsCopyItem {
  platform: string
  primaryText: string
  headline: string
  description: string
  hashtags: string[]
  cta: string
}

export async function generateSnsCopies(
  productInfo: ProductInfo,
  persona: PersonaData,
  platforms: string[],
): Promise<SnsCopyItem[]> {
  const results: SnsCopyItem[] = []

  for (const platform of platforms) {
    const platformGuide: Record<string, string> = {
      meta: 'Facebook/Instagram広告。主テキスト125文字以内推奨。感情訴求が効果的。',
      x: 'X（Twitter）広告。280文字以内。簡潔でインパクト重視。',
      line: 'LINE広告。親しみやすいトーン。スタンプ的な絵文字OK。',
    }

    const prompt = `${platformGuide[platform] || `${platform}広告`}

【商品情報】
商品名: ${productInfo.productName}
主なベネフィット: ${productInfo.mainBenefit}
差別化: ${productInfo.uniqueValue}

【ターゲット】
${persona.name}（${persona.age}）
悩み: ${persona.painPoints.slice(0, 2).join('、')}

以下のJSON形式で回答してください（JSONのみ）:
{
  "platform": "${platform}",
  "primaryText": "メインテキスト",
  "headline": "ヘッドライン（30文字以内）",
  "description": "説明文（60文字以内）",
  "hashtags": ["タグ1", "タグ2", "タグ3"],
  "cta": "CTA（10文字以内）"
}`

    try {
      const text = await generateText(prompt, 0.85)
      const item = parseJson<SnsCopyItem>(text, {
        platform,
        primaryText: productInfo.mainBenefit,
        headline: productInfo.productName,
        description: productInfo.uniqueValue,
        hashtags: [productInfo.category],
        cta: '詳細を見る',
      })
      results.push(item)
    } catch (e) {
      console.error(`SNS copy generation failed for ${platform}:`, e)
    }
  }

  return results
}
