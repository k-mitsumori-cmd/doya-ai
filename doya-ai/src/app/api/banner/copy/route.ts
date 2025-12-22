import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
function getPrimaryTextModel(): string {
  return (
    process.env.DOYA_BANNER_TEXT_MODEL ||
    process.env.GEMINI_PRO3_MODEL ||
    process.env.GEMINI_PRO_3_MODEL ||
    process.env.GEMINI_TEXT_MODEL ||
    // 未設定時は Gemini 3 Pro Preview を優先（公式モデルID）
    // 参照: https://ai.google.dev/gemini-api/docs/gemini-3?hl=ja
    'gemini-3-pro-preview'
  )
}
const GEMINI_FALLBACK_MODEL = 'gemini-1.5-flash'

const ALLOWED_PURPOSES = ['sns_ad', 'youtube', 'display', 'webinar', 'lp_hero', 'email', 'campaign'] as const
const ALLOWED_CATEGORIES = [
  'telecom',
  'marketing',
  'ec',
  'recruit',
  'beauty',
  'food',
  'realestate',
  'education',
  'finance',
  'health',
  'it',
  'other',
] as const

type CopyRequest = {
  category: string
  purpose: string
  base?: string
  companyName?: string
}

function getGeminiKey(): string | null {
  return (
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    null
  )
}

function extractJsonObject(text: string): any | null {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    const slice = trimmed.slice(start, end + 1)
    try {
      return JSON.parse(slice)
    } catch {
      return null
    }
  }
}

function uniqStrings(arr: string[]) {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)))
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const models = [getPrimaryTextModel(), 'gemini-3-flash-preview', 'gemini-2.0-flash', GEMINI_FALLBACK_MODEL]
  let lastError: string | null = null

  for (const model of models) {
    try {
      const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`
      const res = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 800, topP: 0.95, topK: 40 },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        }),
      })

      if (!res.ok) {
        const t = await res.text()
        lastError = `Gemini ${model} error: ${res.status} - ${t.substring(0, 240)}`
        continue
      }

      const json = await res.json()
      const text = Array.isArray(json?.candidates?.[0]?.content?.parts)
        ? json.candidates[0].content.parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('\n').trim()
        : ''
      if (!text) {
        lastError = `Gemini ${model} returned empty`
        continue
      }
      return text
    } catch (e: any) {
      lastError = `Gemini ${model} failed: ${e?.message || e}`
      continue
    }
  }

  throw new Error(lastError || 'Gemini failed')
}

/**
 * 用途別の詳細プロンプト設定
 * - 文字数目安、フック例、表現パターンなど
 */
const PURPOSE_PROMPTS: Record<string, { name: string; charRange: string; style: string; hooks: string[]; examples: string[] }> = {
  sns_ad: {
    name: 'SNS広告（FB/IG/X）',
    charRange: '15〜30文字',
    style: 'スクロール停止を狙う。数字・具体性・感情を優先。疑問形や呼びかけも効果的。',
    hooks: ['数字訴求', 'ベネフィット直球', '問いかけ', '比較（○○ vs ××）'],
    examples: ['たった3日で売上2倍に', '知らないと損する○○の真実', 'まだ○○で消耗してるの？'],
  },
  youtube: {
    name: 'YouTubeサムネイル',
    charRange: '8〜20文字（短く強く）',
    style: '驚き・検証・暴露・保存版系が強い。【】や数字を積極的に使う。好奇心を刺激。',
    hooks: ['【保存版】', '【衝撃】', '【検証】', '〜の末路', '〜したら○○になった'],
    examples: ['【衝撃】○○の真実', '○○やってみた結果...', '知らないとヤバい○○'],
  },
  display: {
    name: 'ディスプレイ広告（GDN/YDA）',
    charRange: '5〜15文字（超短文）',
    style: '小サイズでも読める。核となる3〜8文字を意識。視認性重視。',
    hooks: ['今だけ', '無料', '○○%OFF', '限定'],
    examples: ['今だけ半額', '無料体験', '残り3日', '人気No.1'],
  },
  webinar: {
    name: 'ウェビナー告知',
    charRange: '20〜40文字',
    style: '参加メリット+限定感。無料/資料/限定公開/残席などを強調。日時を入れるのも効果的。',
    hooks: ['参加無料', '限定公開', '残席わずか', '資料プレゼント', '○月○日開催'],
    examples: ['【参加無料】売上3倍にした秘訣を公開', '残席10名！成功事例を徹底解説', '限定資料付き！○○セミナー'],
  },
  lp_hero: {
    name: 'LPファーストビュー',
    charRange: '15〜35文字',
    style: '価値提案を明快に。信頼感・実績も添える。課題→解決の流れ。',
    hooks: ['導入実績○○社', '満足度○○%', '○○の課題を解決', 'たった○○で'],
    examples: ['業務効率を劇的に改善', '導入3,000社の実績', '○○の悩みを解決するサービス'],
  },
  email: {
    name: 'メール件名/ヘッダー',
    charRange: '15〜30文字',
    style: '開封率重視。煽りすぎず、パーソナル感と緊急性のバランス。',
    hooks: ['○○様へ', '本日まで', 'ご案内', '特別'],
    examples: ['【重要】○○のご案内', '本日23:59まで！特別オファー', '○○様へ特別なお知らせ'],
  },
  campaign: {
    name: 'セール/キャンペーン',
    charRange: '12〜25文字',
    style: '%OFF/期間限定/本日まで/数量限定など緊急性を最優先。',
    hooks: ['○○%OFF', '期間限定', '本日まで', '先着○○名', '数量限定'],
    examples: ['MAX70%OFF！本日限り', '先着100名様限定', '期間限定！送料無料'],
  },
}

/**
 * 業種別の詳細プロンプト設定
 * - 訴求キーワード、ターゲット像、具体例など
 */
const CATEGORY_PROMPTS: Record<string, { name: string; keywords: string[]; targetHint: string; examples: string[] }> = {
  telecom: {
    name: '通信・モバイル',
    keywords: ['通信費削減', '乗り換え', '速度', 'キャッシュバック', 'GB', '月額'],
    targetHint: 'コスト重視のユーザー、速度・安定性を求めるユーザー',
    examples: ['月額○○円で乗り換え', '通信費が半額に', '今なら○万円キャッシュバック'],
  },
  marketing: {
    name: 'マーケティング・広告',
    keywords: ['CV改善', '広告費削減', 'ROAS', '成果', '無料診断', '事例', 'AI'],
    targetHint: 'マーケター、経営者、広告運用担当',
    examples: ['広告費50%削減の成功事例', 'CV率3倍を実現した方法', '無料で成果診断'],
  },
  ec: {
    name: 'EC・小売',
    keywords: ['割引', '送料無料', '限定', '人気No.1', 'レビュー', '在庫わずか', 'ポイント'],
    targetHint: 'お得さ・品質・レビューを重視する消費者',
    examples: ['レビュー★4.8の人気商品', '今なら送料無料', '残りわずか！人気商品'],
  },
  recruit: {
    name: '採用・HR',
    keywords: ['未経験OK', '年収UP', '福利厚生', 'リモート', '面談', '急募', '正社員'],
    targetHint: '転職希望者、キャリアアップ志向の求職者',
    examples: ['未経験から年収500万へ', 'フルリモート正社員募集', '面談だけでもOK'],
  },
  beauty: {
    name: '美容・コスメ',
    keywords: ['初回', '体験', '透明感', '毛穴', '時短', '上品', 'ツヤ', 'ハリ'],
    targetHint: '美容意識の高い女性、エイジングケアに関心のある層',
    examples: ['初回限定60%OFF', '透明感のある肌へ', '時短で叶える美肌ケア'],
  },
  food: {
    name: '食品・飲食',
    keywords: ['限定', '今だけ', 'セット', '送料無料', 'シズル', '産地直送', '手作り'],
    targetHint: 'グルメ志向、健康志向、ギフト需要',
    examples: ['産地直送の新鮮素材', '今だけ限定セット', '送料無料でお届け'],
  },
  realestate: {
    name: '不動産',
    keywords: ['来場特典', '内見', '安心', '理想', '相談', '駅近', '新築'],
    targetHint: '住宅購入検討者、投資家',
    examples: ['来場でギフト券進呈', '理想の住まいを見つけよう', '無料相談受付中'],
  },
  education: {
    name: '教育・スクール',
    keywords: ['最短', '合格', '無料体験', 'ロードマップ', '転職', '資格', 'スキルアップ'],
    targetHint: '学習意欲の高い社会人、資格取得希望者',
    examples: ['最短3ヶ月で資格取得', '無料体験レッスン実施中', '転職成功率95%'],
  },
  finance: {
    name: '金融・保険',
    keywords: ['家計改善', '手数料', '無料相談', '安心', '将来', '資産運用', '節税'],
    targetHint: '資産形成に関心のある層、家計見直し検討者',
    examples: ['手数料0円で始める資産運用', '将来の不安を解消', '無料でお金の相談'],
  },
  health: {
    name: '医療・ヘルスケア',
    keywords: ['予約', '相談', '安心', '専門', '負担軽減', '予防', 'サポート'],
    targetHint: '健康意識の高い層、症状に悩む患者',
    examples: ['専門医に無料相談', '予約カンタン即日対応', '負担を軽減するサポート'],
  },
  it: {
    name: 'IT・SaaS',
    keywords: ['業務効率', '自動化', 'AI', '導入', '無料トライアル', 'DX', 'コスト削減'],
    targetHint: 'IT担当者、経営者、業務改善を求める企業',
    examples: ['業務時間を50%削減', 'AIで自動化を実現', '無料トライアル実施中'],
  },
  other: {
    name: 'その他',
    keywords: ['成果', '時短', '無料', '今だけ', '安心', '簡単', '人気'],
    targetHint: '幅広いターゲット',
    examples: ['今だけ限定オファー', '簡単3ステップ', '人気No.1の理由'],
  },
}

function buildCopyPrompt(input: CopyRequest) {
  const purpose = (ALLOWED_PURPOSES as readonly string[]).includes(input.purpose) ? input.purpose : 'sns_ad'
  const category = (ALLOWED_CATEGORIES as readonly string[]).includes(input.category) ? input.category : 'other'
  const base = String(input.base || '').trim()
  const companyName = String(input.companyName || '').trim()

  const purposeConfig = PURPOSE_PROMPTS[purpose] || PURPOSE_PROMPTS.sns_ad
  const categoryConfig = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.other

  const system = [
    'あなたは日本の広告代理店でCTR改善に強いトップコピーライターです。',
    '以下の条件で「クリックされやすい広告コピー（見出し）」を生成してください。',
    '',
    '═══════════════════════════════════════════',
    '【用途】' + purposeConfig.name,
    '═══════════════════════════════════════════',
    '- 推奨文字数: ' + purposeConfig.charRange,
    '- スタイル: ' + purposeConfig.style,
    '- 効果的なフック: ' + purposeConfig.hooks.join('、'),
    '- 参考例: ' + purposeConfig.examples.join(' / '),
    '',
    '═══════════════════════════════════════════',
    '【業種】' + categoryConfig.name,
    '═══════════════════════════════════════════',
    '- 訴求キーワード: ' + categoryConfig.keywords.join('、'),
    '- ターゲット像: ' + categoryConfig.targetHint,
    '- 業種特有の例: ' + categoryConfig.examples.join(' / '),
    '',
    companyName ? '【ブランド名】' + companyName + '（適宜入れる、短く）' : '',
    base ? '【現在の文言】' + base + '（これをベースに改善してOK）' : '',
    '',
    '═══════════════════════════════════════════',
    '【生成ルール】',
    '═══════════════════════════════════════════',
    '1. 出力はJSONのみ（文章や```は禁止）',
    '2. 誇大/虚偽/断定的な医療効果など、規約違反になりうる表現は避ける',
    '3. 推奨文字数を守る（最大でも40文字以内）',
    '4. 数字・具体・限定・ベネフィットのいずれかを必ず入れる（可能なら2つ以上）',
    '5. 同じ言い回しの量産は禁止。アングルを変えて差別化する',
    '6. 用途と業種に最適化された、実際に使えるコピーを生成する',
    '',
    '【生成するアングル（全て混ぜて12案）】',
    '- ベネフィット直球（結果・成果を明示）',
    '- 数字訴求（%OFF/回数/時間/金額/実績数）',
    '- 限定/緊急（本日まで/先着/残席/期間限定）',
    '- 不安解消（無料/簡単/失敗しない/返金保証）',
    '- 社会的証明（人気No.1/導入社数/満足度/レビュー）',
    '- 好奇心/フック（知らないと損/裏ワザ/まだ○○してるの？）',
    '',
    '【出力JSONスキーマ】',
    '{ "suggestions": string[] }',
    '',
    '※ 必ず12個のコピーを生成してください。',
  ]
    .filter(Boolean)
    .join('\n')

  return system
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getGeminiKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AIコピー用のAPIキーが設定されていません（GOOGLE_AI_API_KEY / GEMINI_API_KEY / GOOGLE_GENAI_API_KEY）。' },
        { status: 503 }
      )
    }

    const body = (await req.json()) as CopyRequest
    const prompt = buildCopyPrompt(body)
    const raw = await callGemini(prompt, apiKey)
    const parsed = extractJsonObject(raw)
    const suggestionsRaw = Array.isArray(parsed?.suggestions) ? parsed.suggestions : []
    const suggestions = uniqStrings(
      suggestionsRaw.map((s: any) => String(s || '').trim()).filter(Boolean)
    ).slice(0, 12)

    if (suggestions.length === 0) {
      return NextResponse.json(
        { error: 'AIの出力を解析できませんでした。', raw },
        { status: 502 }
      )
    }

    return NextResponse.json({ suggestions })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'AIコピー生成に失敗しました。' },
      { status: 500 }
    )
  }
}



