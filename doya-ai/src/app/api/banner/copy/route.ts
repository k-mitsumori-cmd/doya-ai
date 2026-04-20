import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
function getPrimaryTextModel(): string {
  return (
    process.env.DOYA_BANNER_TEXT_MODEL ||
    process.env.GEMINI_PRO3_MODEL ||
    process.env.GEMINI_PRO_3_MODEL ||
    process.env.GEMINI_TEXT_MODEL ||
    // 未設定時は Gemini 3 Flash（無料枠あり）を使用
    // Gemini 2.5以下は使用しない
    // 参照: https://ai.google.dev/gemini-api/docs/gemini-3?hl=ja
    'gemini-3-flash-preview'
  )
}
// フォールバックもGemini 3系（テキスト生成はGemini 3対応）
const GEMINI_FALLBACK_MODEL = 'gemini-3-flash-preview'

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
  // 任意（将来の拡張／UIから渡せるように）
  target?: string
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

function parseSuggestionsFallback(raw: string): string[] {
  const lines = String(raw || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    // コードフェンス等を除外
    .filter((l) => l !== '```' && !l.startsWith('```'))
    .map((l) => l.replace(/^[\-•\u2022]\s*/, ''))
    .map((l) => l.replace(/^\d+[\.\)]\s*/, ''))
    // 「suggestions:」や `"suggestions": [` など JSONキー/断片を除外
    .filter((l) => !/^"?suggestions"?\s*[:：]/i.test(l))
    .filter((l) => !/"suggestions"\s*[:：]\s*\[/i.test(l))
    // 「items:」や `"items": [` など JSONキー/断片を除外（誤って入力欄に入る事故を防ぐ）
    .filter((l) => !/^"?items"?\s*[:：]/i.test(l))
    .filter((l) => !/"items"\s*[:：]\s*\[/i.test(l))
    // JSON断片っぽい行を除外
    .filter((l) => !/^\{|\}$/.test(l))
    .filter((l) => !/^\s*\[\s*$/.test(l))
    .filter((l) => !/^\s*\]\s*,?\s*$/.test(l))
    // JSONっぽい括弧だけの断片を除外
    .filter((l) => !/^[\{\}\[\]]+$/.test(l))

  // 文字数レンジ外の極端なものは落とす（過度に長い文章を避ける）
  return uniqStrings(lines).filter((s) => s.length >= 4 && s.length <= 80).slice(0, 24)
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  // Gemini 3系のみ使用（Gemini 2.5以下は使用しない）
  // 参照: https://ai.google.dev/gemini-api/docs/gemini-3?hl=ja
  // gemini-3-flash-preview は無料枠あり
  const models = [getPrimaryTextModel(), 'gemini-3-pro-preview', 'gemini-3-flash-preview', GEMINI_FALLBACK_MODEL]
    .filter((v, i, a) => a.indexOf(v) === i) // 重複除去
  let lastError: string | null = null

  for (const model of models) {
    try {
      const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`
      
      // JSONモード（responseMimeType）はモデル/タイミングで弾かれることがあるため、
      // まずJSONモード→失敗したら自動で通常モードにフォールバックして安定性を上げる
      const buildBody = (jsonMode: boolean) => ({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800,
          topP: 0.95,
          topK: 40,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      })

      const attempt = async (jsonMode: boolean) =>
        fetch(`${endpoint}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildBody(jsonMode)),
        })

      // 502/503 が出ることがあるため軽いリトライ
      let res = await attempt(true)
      if (res.status === 502 || res.status === 503) {
        await new Promise((r) => setTimeout(r, 700))
        res = await attempt(true)
      }

      if (!res.ok) {
        const t = await res.text()
        // JSONモードが弾かれたら通常モードで再試行
        if (
          res.status === 400 &&
          (t.includes('responseMimeType') || t.includes('response_mime_type') || t.includes('INVALID_ARGUMENT'))
        ) {
          let retry = await attempt(false)
          if (retry.status === 502 || retry.status === 503) {
            await new Promise((r) => setTimeout(r, 700))
            retry = await attempt(false)
          }
          if (retry.ok) {
            const json = await retry.json()
            const text = Array.isArray(json?.candidates?.[0]?.content?.parts)
              ? json.candidates[0].content.parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('\n').trim()
              : ''
            if (text) return text
          } else {
            const t2 = await retry.text()
            lastError = `Gemini ${model} error (retry): ${retry.status} - ${t2.substring(0, 600)}`
            continue
          }
        }
        lastError = `Gemini ${model} error: ${res.status} - ${t.substring(0, 600)}`
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

const CATEGORY_LABEL_JP: Record<string, string> = {
  realestate: '不動産',
  it: 'IT／SaaS',
  recruit: '採用／人材',
  ec: 'EC／D2C',
  education: '教育／講座',
  food: '飲食／店舗',
  beauty: '美容',
  finance: '金融',
  health: 'ヘルスケア',
  telecom: '通信・モバイル',
  marketing: 'マーケティング・広告',
  other: 'その他',
}

const PURPOSE_LABEL_JP: Record<string, string> = {
  sns_ad: 'SNS広告',
  youtube: 'YouTube',
  display: 'Web広告（ディスプレイ）',
  webinar: 'ウェビナーバナー',
  lp_hero: 'LPファーストビュー',
  email: 'メール',
  campaign: 'キャンペーン',
}

function buildCopyPrompt(input: CopyRequest) {
  const purpose = (ALLOWED_PURPOSES as readonly string[]).includes(input.purpose) ? input.purpose : 'sns_ad'
  const category = (ALLOWED_CATEGORIES as readonly string[]).includes(input.category) ? input.category : 'other'
  const base = String(input.base || '').trim()
  const companyName = String(input.companyName || '').trim()
  const target = String((input as any).target || '').trim()

  const purposeConfig = PURPOSE_PROMPTS[purpose] || PURPOSE_PROMPTS.sns_ad
  const categoryConfig = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.other
  const industryJP = CATEGORY_LABEL_JP[category] || categoryConfig.name || 'その他'
  const purposeJP = PURPOSE_LABEL_JP[purpose] || purposeConfig.name || 'SNS広告'

  const system = [
    'あなたは、広告代理店で数多くの成果を出してきたトップクラスのコピーライター兼マーケターです。',
    '以下の条件をすべて理解し、「マーケティングバナーで実際に使われるコピー」を生成してください。',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '■ あなたの役割',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '・業種と用途に最適化されたコピーを考える',
    '・一瞬で内容が伝わるコピーを作る',
    '・広告・LP・SNSで“成果が出る”ことを最優先する',
    '・綺麗ごと・抽象論・AIっぽい言い回しは禁止',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '■ 入力情報',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `【業種】\n${industryJP}`,
    `\n【用途】\n${purposeJP}`,
    base ? `\n【訴求したい内容・特徴（任意）】\n${base}` : '\n【訴求したい内容・特徴（任意）】\n（未入力）',
    target ? `\n【ターゲット（任意）】\n${target}` : '\n【ターゲット（任意）】\n（未入力）',
    companyName ? `\n【ブランド名（任意）】\n${companyName}` : '',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '■ 出力するコピー内容（必須）',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '以下の3点を必ず出力してください。',
    '',
    '① キャッチコピー（メイン）',
    '・15〜25文字程度',
    '・一目で価値が伝わる',
    '・「誰向け・何が得られるか」が明確',
    '・抽象的なワードは禁止',
    '',
    '② サブコピー（補足説明）',
    '・キャッチを具体化する1文',
    '・なぜそれが良いのかが分かる',
    '・専門用語は使いすぎない',
    '',
    '③ CTA文言',
    '・短く、行動がイメージできる',
    '・「今やる理由」が伝わる表現',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '■ 業種別コピー設計ルール（必須）',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '・不動産：安心感・信頼感・生活イメージ。「失敗しない」「納得できる」「選ばれている」を活用。',
    '・IT／SaaS：効率化・成果・スピード感。「◯◯を減らす」「◯◯が早くなる」「属人化しない」など具体性重視。',
    '・採用／人材：共感・未来・前向きさ。「不安」「悩み」を言語化してから解決策を示す。',
    '・EC／D2C：メリット即伝達。「限定」「今だけ」「簡単」「お得」を分かりやすく。',
    '・教育／講座：信頼・学べる内容の明確化。「何が学べるか」「誰向けか」を必ず含める。',
    '・飲食／店舗：直感訴求。「美味しそう」「行きたい」と思わせる言葉選び。',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '■ 用途別コピー設計ルール（必須）',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '・SNS広告：スクロール中でも目に止まる強さ',
    '・LPファーストビュー：サービス理解が一瞬で進む',
    '・ウェビナー：参加メリットが明確',
    '・キャンペーン：今すぐ行動する理由を作る',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '■ 禁止事項（厳守）',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '・意味が曖昧な言葉（革新的・最適・次世代など）',
    '・誰にでも当てはまる表現',
    '・説明過多で読まれない文章',
    '・ポエム調、エモすぎる表現',
    '・AIっぽい整いすぎた文章',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '■ 生成指示',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '・12案作成してください（各案 = キャッチ/サブ/CTA の3点セット）',
    '・可能なら具体的な数字/期限/限定性を自然に入れてください（誇張しすぎはNG）',
    '・業種/用途に合わない表現は避けてください',
    '',
    '【参考：業種×用途のヒント（必ずしもそのまま使わなくてOK）】',
    `- クリックされやすいキーワード例: ${categoryConfig.ctrKeywords.slice(0, 6).join(' / ')}`,
    `- よくある悩み: ${categoryConfig.painPoints.slice(0, 3).join(' / ')}`,
    `- 訴求軸: ${categoryConfig.appealAxes.slice(0, 3).join(' / ')}`,
    '',
    '【出力JSONスキーマ】（JSON以外は一切出力しない）',
    '{',
    '  "items": [',
    '    { "catch": string, "sub": string, "cta": string }',
    '  ],',
    '  "suggestions": string[]',
    '}',
    '',
    '※ suggestions には items の catch だけを12個入れてください（UI互換のため）。',
  ].filter(Boolean).join('\n')

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
    const itemsRaw = Array.isArray((parsed as any)?.items) ? (parsed as any).items : []
    const suggestionsFromItems = itemsRaw
      .map((it: any) => String(it?.catch || '').trim())
      .filter(Boolean)

    const suggestionsRaw = Array.isArray((parsed as any)?.suggestions) ? (parsed as any).suggestions : []
    let suggestions = uniqStrings(
      [...suggestionsFromItems, ...suggestionsRaw.map((s: any) => String(s || '').trim())].filter(Boolean)
    ).slice(0, 12)

    // JSONが崩れても「候補抽出」で成功させる（UIの“エラー”体験を減らす）
    if (suggestions.length === 0) {
      const fallback = parseSuggestionsFallback(raw)
      suggestions = uniqStrings(fallback).slice(0, 12)
    }

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



