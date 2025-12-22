import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
function getPrimaryTextModel(): string {
  return (
    process.env.DOYA_BANNER_TEXT_MODEL ||
    process.env.GEMINI_PRO3_MODEL ||
    process.env.GEMINI_PRO_3_MODEL ||
    process.env.GEMINI_TEXT_MODEL ||
    // 未設定時は Gemini 1.5 Flash を使用（安定版）
    // Gemini 3系はテキスト生成でもエラーが発生する場合があるため
    'gemini-1.5-flash'
  )
}
const GEMINI_FALLBACK_MODEL = 'gemini-1.5-pro'

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
  // Gemini 1.5系を優先して使用（安定版）
  // Gemini 3系はテキスト生成でもエラーが発生することがあるため後回し
  const models = [getPrimaryTextModel(), 'gemini-1.5-pro', 'gemini-1.5-flash', GEMINI_FALLBACK_MODEL]
  let lastError: string | null = null

  for (const model of models) {
    try {
      const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`
      
      // JSONモードをサポートしているか簡易チェック
      const isJsonSupported = model.includes('1.5') || model.includes('2.0') || model.includes('3')
      
      const res = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { 
            temperature: 0.7, 
            maxOutputTokens: 800, 
            topP: 0.95, 
            topK: 40,
            ...(isJsonSupported ? { responseMimeType: 'application/json' } : {})
          },
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
 * 用途別のCTR最大化プロンプト設定
 * - CTRが高まるフレーズパターン、心理トリガー、具体例
 */
const PURPOSE_PROMPTS: Record<string, { name: string; charRange: string; ctrTriggers: string[]; patterns: string[]; examples: string[] }> = {
  sns_ad: {
    name: 'SNS広告（FB/IG/X）',
    charRange: '15〜30文字',
    ctrTriggers: ['スクロール停止', '即時価値訴求', '感情喚起', 'FOMO（見逃し恐怖）'],
    patterns: ['【数字】で【成果】', '【疑問形】○○していませんか？', 'たった【期間】で【結果】', 'まだ【旧方法】で消耗してるの？'],
    examples: ['たった3日で売上2倍に', '知らないと損する○○の真実', '97%が実感した○○'],
  },
  youtube: {
    name: 'YouTubeサムネイル',
    charRange: '8〜20文字（短く強く）',
    ctrTriggers: ['好奇心ギャップ', '衝撃・驚き', '検証・暴露', '保存版'],
    patterns: ['【衝撃】○○の真実', '○○やってみた結果...', '【保存版】○○完全ガイド', '知らないとヤバい○○'],
    examples: ['【衝撃】プロが教える裏技', '○○したら人生変わった', '絶対やってはいけない○○'],
  },
  display: {
    name: 'ディスプレイ広告（GDN/YDA）',
    charRange: '5〜15文字（超短文）',
    ctrTriggers: ['視認性最優先', '一瞬で伝わる', 'シンプル＆インパクト'],
    patterns: ['今だけ【割引】', '【無料】○○', '残り【数量】', '人気No.1'],
    examples: ['今だけ半額', '無料体験', '残り3日', '人気No.1'],
  },
  webinar: {
    name: 'ウェビナー告知',
    charRange: '20〜40文字',
    ctrTriggers: ['限定感', '参加メリット明示', '専門家訴求', '資料プレゼント'],
    patterns: ['【参加無料】○○の秘訣を公開', '残席【数】名！○○セミナー', '【限定資料付き】○○解説', '○月○日開催'],
    examples: ['【参加無料】売上3倍にした秘訣を公開', '残席10名！成功事例を徹底解説', '限定資料付き！○○セミナー'],
  },
  lp_hero: {
    name: 'LPファーストビュー',
    charRange: '15〜35文字',
    ctrTriggers: ['価値提案明確化', '実績・信頼', '課題→解決', 'ベネフィット直球'],
    patterns: ['【課題】を【期間】で解決', '導入【数】社の実績', '【満足度】%の○○', 'たった【アクション】で【成果】'],
    examples: ['業務効率を劇的に改善', '導入3,000社の実績', '満足度98%のサービス'],
  },
  email: {
    name: 'メール件名/ヘッダー',
    charRange: '15〜30文字',
    ctrTriggers: ['開封率最優先', 'パーソナル感', '緊急性', '特別感'],
    patterns: ['【重要】○○のご案内', '本日【時間】まで！', '○○様へ特別なお知らせ', '【先行案内】○○'],
    examples: ['【重要】○○のご案内', '本日23:59まで！特別オファー', '○○様へ特別なお知らせ'],
  },
  campaign: {
    name: 'セール/キャンペーン',
    charRange: '12〜25文字',
    ctrTriggers: ['緊急性最優先', '割引インパクト', '数量限定', '期間限定'],
    patterns: ['MAX【割引】%OFF！', '先着【数】名様限定', '本日【時間】まで！', '【期間】限定！'],
    examples: ['MAX70%OFF！本日限り', '先着100名様限定', '期間限定！送料無料'],
  },
}

/**
 * 業種別のCTR最大化プロンプト設定
 * - 業種特有のCTR向上キーワード、ペインポイント、訴求軸
 */
const CATEGORY_PROMPTS: Record<string, { name: string; ctrKeywords: string[]; painPoints: string[]; appealAxes: string[]; examples: string[] }> = {
  telecom: {
    name: '通信・モバイル',
    ctrKeywords: ['月額○○円', '○万円キャッシュバック', '速度○倍', '乗り換えで○○円お得', '○GB'],
    painPoints: ['通信費が高い', '速度が遅い', '契約が複雑'],
    appealAxes: ['コスト削減', '速度改善', '手続き簡単'],
    examples: ['月額○○円で乗り換え', '通信費が半額に', '今なら○万円キャッシュバック'],
  },
  marketing: {
    name: 'マーケティング・広告',
    ctrKeywords: ['CV率○倍', '広告費○%削減', 'ROAS○倍', '無料診断', '成功事例○社'],
    painPoints: ['広告費がかさむ', 'CVが取れない', '効果測定が難しい'],
    appealAxes: ['費用対効果', '成果保証', '実績証明'],
    examples: ['広告費50%削減の成功事例', 'CV率3倍を実現した方法', '無料で成果診断'],
  },
  ec: {
    name: 'EC・小売',
    ctrKeywords: ['○%OFF', '送料無料', '★○.○の人気商品', '残り○点', 'ポイント○倍'],
    painPoints: ['欲しい商品が見つからない', '価格が高い', '届くか不安'],
    appealAxes: ['お得感', '品質保証', '安心配送'],
    examples: ['レビュー★4.8の人気商品', '今なら送料無料', '残りわずか！人気商品'],
  },
  recruit: {
    name: '採用・HR',
    ctrKeywords: ['年収○万円〜', '未経験OK', 'フルリモート', '土日祝休み', '○日で内定'],
    painPoints: ['年収が上がらない', '働き方が合わない', '将来が不安'],
    appealAxes: ['年収アップ', 'ワークライフバランス', 'キャリアアップ'],
    examples: ['未経験から年収500万へ', 'フルリモート正社員募集', '面談だけでもOK'],
  },
  beauty: {
    name: '美容・コスメ',
    ctrKeywords: ['初回○%OFF', '○日で実感', '満足度○%', '透明感UP', '毛穴レス'],
    painPoints: ['肌荒れが治らない', '時間がない', '効果がわからない'],
    appealAxes: ['即効性', '時短', 'ビフォーアフター'],
    examples: ['初回限定60%OFF', '7日で透明感UP', '時短で叶える美肌ケア'],
  },
  food: {
    name: '食品・飲食',
    ctrKeywords: ['○食セット', '送料無料', '産地直送', '○時間限定', '○%増量'],
    painPoints: ['美味しいものが見つからない', '価格が高い', '鮮度が心配'],
    appealAxes: ['味・品質', 'お得感', '新鮮さ'],
    examples: ['産地直送の新鮮素材', '今だけ限定セット', '送料無料でお届け'],
  },
  realestate: {
    name: '不動産',
    ctrKeywords: ['来場で○万円分', '駅徒歩○分', '○万円台〜', '○件限定', '即入居可'],
    painPoints: ['理想の物件がない', '価格が高い', '手続きが面倒'],
    appealAxes: ['立地・条件', 'コスパ', 'サポート充実'],
    examples: ['来場でギフト券進呈', '駅徒歩5分の新築', '無料相談受付中'],
  },
  education: {
    name: '教育・スクール',
    ctrKeywords: ['○ヶ月で合格', '合格率○%', '無料体験○日間', '転職成功率○%', '○万円OFF'],
    painPoints: ['続かない', '効果が出ない', '費用が高い'],
    appealAxes: ['短期成果', '実績', 'コスパ'],
    examples: ['最短3ヶ月で資格取得', '無料体験レッスン実施中', '転職成功率95%'],
  },
  finance: {
    name: '金融・保険',
    ctrKeywords: ['手数料○円', '○万円節約', '利回り○%', '○秒で診断', '○年連続No.1'],
    painPoints: ['お金が増えない', '将来が不安', 'よくわからない'],
    appealAxes: ['利益・節約', '安心感', 'わかりやすさ'],
    examples: ['手数料0円で始める資産運用', '年間○万円節約', '無料でお金の相談'],
  },
  health: {
    name: '医療・ヘルスケア',
    ctrKeywords: ['予約○分で完了', '○%の方が改善', '初診料○円', '○日以内対応', '専門医○名在籍'],
    painPoints: ['症状が改善しない', '予約が取れない', '費用が心配'],
    appealAxes: ['専門性', 'スピード対応', '安心・信頼'],
    examples: ['専門医に無料相談', '予約カンタン即日対応', '負担を軽減するサポート'],
  },
  it: {
    name: 'IT・SaaS',
    ctrKeywords: ['業務時間○%削減', '導入○社突破', '○日間無料', 'AI搭載', '初期費用○円'],
    painPoints: ['業務が非効率', 'コストがかかる', '使いこなせない'],
    appealAxes: ['効率化', 'コスト削減', '簡単導入'],
    examples: ['業務時間を50%削減', 'AIで自動化を実現', '無料トライアル実施中'],
  },
  other: {
    name: 'その他',
    ctrKeywords: ['○%OFF', '○日限定', '満足度○%', '○分で完了', '○名突破'],
    painPoints: ['時間がない', '費用が心配', '効果がわからない'],
    appealAxes: ['時短', 'コスパ', '実績'],
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
    '🎯 あなたはCTR（クリック率）最大化の専門家です。',
    '広告業界で10年以上の経験を持ち、数字でクリックを勝ち取るプロです。',
    '',
    '╔══════════════════════════════════════════════════════════════════╗',
    '║  📊 目標：CTR（クリック率）を最大化するキーワードを生成する  ║',
    '╚══════════════════════════════════════════════════════════════════╝',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '📌 業種：' + categoryConfig.name,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '【CTRが高まるキーワード（必ず使う）】',
    categoryConfig.ctrKeywords.map((kw, i) => `  ${i + 1}. ${kw}`).join('\n'),
    '',
    '【ターゲットのペインポイント（課題・悩み）】',
    categoryConfig.painPoints.map((p, i) => `  ${i + 1}. ${p}`).join('\n'),
    '',
    '【効果的な訴求軸】',
    categoryConfig.appealAxes.map((a, i) => `  ${i + 1}. ${a}`).join('\n'),
    '',
    '【この業種の高CTRコピー例】',
    categoryConfig.examples.map((ex, i) => `  ${i + 1}. ${ex}`).join('\n'),
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '📌 用途：' + purposeConfig.name,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '【推奨文字数】' + purposeConfig.charRange,
    '',
    '【CTRを上げる心理トリガー】',
    purposeConfig.ctrTriggers.map((t, i) => `  ${i + 1}. ${t}`).join('\n'),
    '',
    '【効果的なパターン】',
    purposeConfig.patterns.map((p, i) => `  ${i + 1}. ${p}`).join('\n'),
    '',
    companyName ? '【ブランド名】' + companyName : '',
    base ? '【ベース文言】' + base + '（これを改善してCTRを上げる）' : '',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🔥 CTR最大化の絶対ルール',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '1. ⚠️ 必ず具体的な「数字」を入れる（○%、○円、○日、○名など）',
    '2. ⚠️ 必ず上記「CTRが高まるキーワード」を各コピーに1つ以上含める',
    '3. ⚠️ 必ず「' + categoryConfig.name + '」業種に特化した内容にする',
    '4. 緊急性・限定感・損失回避のいずれかを含める',
    '5. 疑問形・呼びかけ・驚きのフックを活用',
    '6. 汎用的・抽象的なコピーは厳禁（業種文脈を必ず入れる）',
    '7. 出力はJSONのみ（文章や```は禁止）',
    '8. 推奨文字数を守る',
    '',
    '【生成する12案のバリエーション】',
    '- 数字訴求×3案（○%OFF / ○万円 / ○日で など）',
    '- 緊急性訴求×2案（今だけ / 残り○名 / 本日まで など）',
    '- ベネフィット直球×2案（業種特有の成果を明示）',
    '- 不安解消×2案（失敗しない / 返金保証 / 無料 など）',
    '- 社会的証明×2案（○社導入 / 満足度○% / No.1 など）',
    '- 好奇心フック×1案（まだ○○してるの？ / 知らないと損 など）',
    '',
    '【出力JSONスキーマ】',
    '{ "suggestions": string[] }',
    '',
    '※ 必ず「' + categoryConfig.name + '」×「' + purposeConfig.name + '」に最適化された12個の高CTRキーワードを生成してください。',
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



