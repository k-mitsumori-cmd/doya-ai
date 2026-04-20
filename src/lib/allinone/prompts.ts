/**
 * ドヤマーケAI AI プロンプト集
 * 構造化された JSON アウトプットを Claude に要求するためのテンプレート。
 */

import type { ScrapeResult, PageSpeedResult } from './types'

// ============================================
// 共通の system prompt（役割定義）
// ============================================

export const SYSTEM_ANALYST = `あなたは日本市場に精通したシニアマーケティングコンサルタントです。
Webサイトの URL と抽出済みデータから、事業主視点で「何が足りないか」「どう直すか」を最短で指摘します。

制約:
- 必ず有効な JSON のみで回答してください。前置き・あいさつ・コードブロック記号は禁止。
- 想像で事実を作らない。抽出済みデータにない固有名詞は出さない。
- 日本語で回答。数値は int、スコアは 0-100 の int。
- 提案はすべて具体的に。抽象論（「ユーザーに寄り添う」等）は禁止。`

export const SYSTEM_PERSONA = `あなたは戦略ペルソナ設計のプロフェッショナルです。
サイトの情報から、顧客になりそうな代表的なペルソナを3名生成します。
ペルソナは具体的・人間味があり、実在しそうな日本人像にしてください。
必ず有効な JSON のみで回答。想像で事実を作らない（抽出データ範囲内）。`

export const SYSTEM_BRANDING = `あなたはブランドアイデンティティ専門家です。
Webサイトのビジュアル要素（色・画像・言葉遣い）から、ブランドトーンを診断します。
必ず有効な JSON のみで回答。`

export const SYSTEM_VISUAL = `あなたは広告クリエイティブディレクター。
サイト訴求にマッチするキービジュアル案を3案（A:王道 / B:攻め / C:ミニマル）で設計します。
各案にキャッチコピー・サブコピー・画像プロンプトを用意してください。
必ず有効な JSON のみで回答。`

export const SYSTEM_ACTION = `あなたはマーケティング施策の優先度設計の専門家。
分析結果を踏まえ、優先度付きのアクションプランを 10件作成してください。
・priority は 1-5（1 が最優先）
・effort は 低/中/高
・durationDays は現実的な日数
・relatedService は ドヤAI のサービスID（seo|lp|banner|persona|copy|adsim|movie|voice）を必要なら付与

必ず有効な JSON のみで回答。`

export const SYSTEM_SUMMARY = `あなたはサイト診断の総合評価を書く編集者。
全分析結果を統合して、経営者が 30秒で理解できるサマリを作ります。
overallScore は 0-100 の int。radar の 5軸はそれぞれ 0-100 の int。
必ず有効な JSON のみで回答。`

// チャット
export const SYSTEM_CHAT_BASE = `あなたはドヤマーケAIのアシスタント。ユーザーはサイト診断結果を見ながら相談してきます。
日本語で、フレンドリーかつ具体的に答えてください。
- ユーザーの質問に対して、必ず診断結果と紐づけて答える
- 抽象論禁止、具体的な改善案・例文・目安値を必ず1つ含める
- 敬語すぎず、プロの先輩マーケターが話すトーンで
- 最後に「次の一手」を1つ提示する`

export const SYSTEM_CHAT_VERBOSE = `${SYSTEM_CHAT_BASE}

【冗長モード】
- より詳しく、長文で答えてください
- 「なぜ直すべきか」「具体例を3つ以上」「所要時間の目安」「想定される結果」「リスク」を必ず含める
- 参考になる実装サンプルやコピー例があれば添える
- 800〜1500字を目安に回答`

// ============================================
// ユーザープロンプト生成
// ============================================

function summarizeScrape(s: ScrapeResult): string {
  const pageSpeedInfo = ''
  return [
    `URL: ${s.finalUrl}`,
    `タイトル: ${s.title || '(なし)'}`,
    `説明: ${s.description || '(なし)'}`,
    `H1: ${s.headings.h1.slice(0, 3).join(' / ')}`,
    `H2 (代表): ${s.headings.h2.slice(0, 6).join(' / ')}`,
    `文字数(本文): ${s.wordCount}`,
    `画像数: ${s.imageCount}`,
    `内部リンク: ${s.internalLinks.length} / 外部リンク: ${s.externalLinks.length}`,
    `メタ: OGP=${s.hasOgp} Favicon=${s.hasFavicon} Canonical=${s.hasCanonical} Viewport=${s.hasViewport} StructuredData=${s.hasStructuredData} Analytics=${s.hasAnalytics}`,
    `主要カラー: ${s.mainColors.slice(0, 6).join(', ')}`,
    `CTA例: ${s.ctaTexts.slice(0, 6).join(' / ') || '(見つからず)'}`,
    `ソーシャル: ${s.socialLinks.map((x) => x.platform).join(', ') || 'なし'}`,
    pageSpeedInfo,
    '',
    '--- 本文抜粋 ---',
    s.textSample.slice(0, 3500),
  ].join('\n')
}

function pagespeedSnippet(mobile: PageSpeedResult | null, desktop: PageSpeedResult | null): string {
  if (!mobile && !desktop) return '※ PageSpeed データなし（APIキー未設定または取得失敗）'
  const lines: string[] = []
  for (const [label, r] of [
    ['Mobile', mobile],
    ['Desktop', desktop],
  ] as const) {
    if (!r) continue
    lines.push(
      `${label}: performance=${r.performanceScore ?? 'n/a'} / a11y=${r.accessibilityScore ?? 'n/a'} / bp=${r.bestPracticesScore ?? 'n/a'} / seo=${r.seoScore ?? 'n/a'} / LCP=${r.lcp ? Math.round(r.lcp) + 'ms' : 'n/a'} / CLS=${r.cls?.toFixed(2) ?? 'n/a'}`
    )
    const topOpp = r.opportunities.slice(0, 3).map((o) => `・${o.title}`)
    if (topOpp.length) lines.push(`  主な改善機会: ${topOpp.join(' / ')}`)
  }
  return lines.join('\n')
}

// ============================================
// サイト分析プロンプト
// ============================================

export function buildSitePrompt(s: ScrapeResult, ps: { mobile: PageSpeedResult | null; desktop: PageSpeedResult | null }): string {
  return `次のサイトを診断して、以下の JSON スキーマで返してください。

--- 入力データ ---
${summarizeScrape(s)}

--- PageSpeed ---
${pagespeedSnippet(ps.mobile, ps.desktop)}

--- 出力 JSON スキーマ ---
{
  "firstImpression": "初回閲覧者が抱く第一印象の一言評（80字以内）",
  "firstImpressionScore": 0-100,
  "strengths": ["強み1","強み2","強み3"],
  "weaknesses": ["弱み1","弱み2","弱み3"],
  "issues": [
    { "category": "performance|mobile|a11y|meta|security|structure|trust",
      "severity": "high|medium|low",
      "title": "問題タイトル",
      "description": "何が起きているか",
      "suggestion": "具体的な直し方（例文・目安値つき）"
    }
  ],
  "mobileFriendly": true|false,
  "hasHttps": true|false,
  "mainColors": ["#hex"],
  "fonts": ["font"],
  "ctaEvaluation": "CTA の配置・文言・量の評価（120字）",
  "trustSignals": ["実績","事例","認証など見つけた要素"]
}

issues は最低5件、多くて8件。小手先でなく重要度が高いもの。JSON のみ返す。`
}

// ============================================
// SEO 分析プロンプト
// ============================================

export function buildSeoPrompt(s: ScrapeResult, userKeyword?: string): string {
  return `次のサイトをSEO観点で診断してください。特に「どんなコンテンツ・事例記事を増やすべきか」を具体的に指摘してください。

--- 入力データ ---
${summarizeScrape(s)}
${userKeyword ? `ユーザー指定の注目キーワード: ${userKeyword}` : ''}

--- 出力 JSON スキーマ ---
{
  "estimatedTargetKeywords": ["このサイトが実際に狙っていそうなキーワード8〜12個"],
  "missingKeywords": ["本来拾えるのに今カバーできていないキーワード6〜10個"],
  "topicClusters": [
    { "theme": "テーマ名",
      "keywords": ["キーワード群"],
      "priority": "high|medium|low" }
  ],
  "headingIssues": ["見出し構造の問題点"],
  "contentGaps": [
    { "type": "content|keyword|structure|internal_link|meta|schema",
      "severity": "high|medium|low",
      "title": "例: 事例記事が不足",
      "description": "なぜギャップなのか",
      "evidence": "根拠（抽出データから）",
      "suggestion": "具体的に何を作るか。例: 「BtoB SaaS 導入事例3選」のテンプレで5本",
      "relatedService": "seo|lp|banner|persona|copy"
    }
  ],
  "internalLinkScore": 0-100,
  "quickWins": [
    { "title": "30分で出来る改善",
      "effort": "低|中|高",
      "impact": "大|中|小",
      "detail": "具体的な手順" }
  ]
}

contentGaps は最低4件、多くて8件。事例記事・FAQ・比較記事・用語解説などコンテンツ型の提案を含めてください。JSON のみ返す。`
}

// ============================================
// ペルソナプロンプト
// ============================================

export function buildPersonaPrompt(s: ScrapeResult, userKeyword?: string): string {
  return `次のサイトの代表的な顧客ペルソナを3名生成してください。日本人、実在感重視。

--- 入力データ ---
${summarizeScrape(s)}
${userKeyword ? `注目キーワード: ${userKeyword}` : ''}

--- 出力 JSON スキーマ ---
{
  "personas": [
    { "id": "persona-1",
      "name": "想定しやすい日本人名",
      "age": 28,
      "gender": "男性|女性|その他",
      "occupation": "職業・役職",
      "lifestyle": "生活の様子（120字）",
      "motivation": "このサイトにアクセスする動機（100字）",
      "painPoint": "困っていること（100字）",
      "buyingTrigger": "購入/問合せを決断する瞬間（80字）",
      "objection": "申込前に引っかかる懸念（80字）",
      "informationSource": ["日常的に見る情報源"],
      "quote": "ペルソナが言いそうな一人称セリフ（40字以内、吹き出し用）",
      "palette": "#hex（性格に合う色1つ）"
    }
  ]
}

3名は世代・動機が異なるようバラけさせる。JSON のみ返す。`
}

// ============================================
// ブランディング分析プロンプト
// ============================================

export function buildBrandingPrompt(s: ScrapeResult): string {
  return `次のサイトのブランディングを診断してください。

--- 入力データ ---
${summarizeScrape(s)}

--- 出力 JSON スキーマ ---
{
  "tone": "ブランドトーンの一言（例: 誠実で温かみのあるプロフェッショナル）",
  "toneTags": ["タグ1","タグ2","タグ3","タグ4"],
  "palette": ["#hex","#hex", ... 最大6色],
  "fontImpression": "フォント選択から受ける印象（80字）",
  "visualStyle": "ビジュアルスタイルの要約（120字）",
  "consistency": 0-100,
  "improvements": ["改善提案1","改善提案2","改善提案3"]
}

JSON のみ返す。`
}

// ============================================
// キービジュアル設計プロンプト
// ============================================

export function buildVisualPrompt(s: ScrapeResult, tone: string, palette: string[]): string {
  return `次のサイト向けに、ファーストビュー用キービジュアルを3案作ります。

--- サイト情報 ---
タイトル: ${s.title}
説明: ${s.description}
トーン: ${tone || '(未診断)'}
パレット: ${palette.slice(0, 6).join(', ') || '(未診断)'}

--- 出力 JSON スキーマ ---
{
  "visuals": [
    { "id": "A",
      "concept": "王道：ターゲットに刺さる直球設計（要点のみ・写真主体）",
      "headline": "キャッチコピー（15〜25字）",
      "subcopy": "サブコピー（30〜50字）",
      "palette": ["#hex","#hex","#hex"],
      "prompt": "画像生成AIに渡すための英語プロンプト。写真のスタイル、構図、照明、被写体、空気感を具体的に。"
    },
    { "id": "B",
      "concept": "攻め：意外性を出す尖った設計",
      "headline": "...",
      "subcopy": "...",
      "palette": ["#hex","#hex","#hex"],
      "prompt": "..."
    },
    { "id": "C",
      "concept": "ミニマル：余白と型で魅せる設計",
      "headline": "...",
      "subcopy": "...",
      "palette": ["#hex","#hex","#hex"],
      "prompt": "..."
    }
  ]
}

prompt は英語で、被写体・構図・照明・質感を細かく指定してください。日本市場向けで、人物がいる場合はアジア人。JSON のみ返す。`
}

// ============================================
// アクションプロンプト
// ============================================

export function buildActionPrompt(context: string): string {
  return `以下の診断コンテキストから、優先度付きのアクションプラン 10件を作成してください。

--- コンテキスト ---
${context}

--- 出力 JSON スキーマ ---
{
  "actions": [
    { "id": "act-1",
      "priority": 1,
      "title": "アクションのタイトル（30字以内）",
      "description": "何を・どのようにやるか（120字）",
      "expectedImpact": "期待されるインパクト（80字）",
      "effort": "低|中|高",
      "durationDays": 7,
      "relatedService": "seo|lp|banner|persona|copy|adsim|movie|voice"
    }
  ]
}

priority は 1〜5、小さいほど優先。10件全て異なる観点で。短期(1〜7日)・中期(14〜30日)・長期(30日以上)のバランス良く含める。

**必ず含めてください**:
- SEO/記事コンテンツのアクション 1件以上（relatedService: 'seo'）
- バナー・キービジュアルのアクション 1件以上（relatedService: 'banner'）
- **広告運用のアクション 1件以上**（relatedService: 'adsim'。媒体配分・月次シミュ・提案資料作成のいずれか）
- ペルソナ詳細化 もしくは LP のアクション 1件以上

JSON のみ返す。`
}

// ============================================
// サマリープロンプト
// ============================================

export function buildSummaryPrompt(context: string): string {
  return `以下の診断結果を統合し、経営者視点の総合評価を作成してください。

--- 診断コンテキスト ---
${context}

--- 出力 JSON スキーマ ---
{
  "headline": "一文サマリ（40字以内・驚きのある評価）",
  "overallScore": 0-100,
  "radar": {
    "site": 0-100,
    "seo": 0-100,
    "content": 0-100,
    "targeting": 0-100,
    "appeal": 0-100
  },
  "topThreeActions": [
    { "title": "最優先アクションのタイトル", "why": "なぜ最優先か（60字）" },
    { "title": "...", "why": "..." },
    { "title": "...", "why": "..." }
  ],
  "elevatorPitch": "このサイトを30秒で説明する文（100〜150字）",
  "competitorHint": "類似ポジションの競合傾向（120字）"
}

辛口かつ建設的に。JSON のみ返す。`
}
