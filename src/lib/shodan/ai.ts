// ============================================
// ドヤ商談準備（Shodan）AI生成（全プラン標準搭載）
// テキスト生成は @seo/lib/gemini（プライマリ Claude Sonnet 4.6、JSONは geminiGenerateJson）。
//  - analyzeCompany: 現状分析（はっきりめ）＋課題仮説＋解決策＋論点＋最初の一言
//  - generateProposal: 提案資料（Markdown）を一括生成
// ============================================
import { geminiGenerateJson, geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import type { CompanyResearch, CompanyAnalysis } from './types'

export interface OwnCompanyProfile {
  companyName?: string | null
  url?: string | null
  description?: string | null
  valueProp?: string | null
  products?: string | null
  targetCustomer?: string | null
  pricingNote?: string | null
  caseStudies?: string | null
}

const FREQ_LABEL: Record<string, string> = {
  high: '高頻度（週1ペース前後）', medium: '中頻度（月1〜2回）', low: '低頻度（散発的）', inactive: 'ほぼ停止', unknown: '不明',
}
const SCALE_LABEL: Record<string, string> = { large: '大規模', medium: '中規模', small: '小規模', unknown: '不明' }

/** リサーチ結果を、AIに渡す「調査事実」テキストへ整形 */
export function researchToFacts(r: CompanyResearch): string {
  return [
    `企業名: ${r.companyName || '（不明）'}`,
    `URL: ${r.url}`,
    r.industry ? `業種: ${r.industry}` : '',
    r.employeeCount != null ? `実従業員数: 約${r.employeeCount}名（出典: ${r.employeeCountSource === 'gbizinfo' ? 'gBizINFO公的データ' : r.employeeCountSource === 'website' ? '自社サイト記載' : '不明'}）` : '実従業員数: 公的データ・サイトともに明示なし',
    r.capital ? `資本金: ${r.capital}` : '',
    r.foundedYear ? `設立: ${r.foundedYear}` : '',
    r.representative ? `代表者: ${r.representative}` : '',
    r.address ? `所在地: ${r.address}` : '',
    r.description ? `事業内容: ${r.description}` : '',
    r.services?.length ? `主なサービス/製品: ${r.services.join('、')}` : '',
    '',
    '【マーケティング実施状況】',
    `- SNS: ${r.marketing.snsChannels.length ? r.marketing.snsChannels.join('、') : '確認できず'}`,
    `- 計測/MAツール: ${r.marketing.martechTools.length ? r.marketing.martechTools.join('、') : '検出なし'}`,
    `- 問い合わせ/資料請求の導線: ${r.marketing.hasContactForm ? 'あり' : '確認できず'}`,
    `- リード獲得施策（資料DL/メルマガ等）: ${r.marketing.hasLeadMagnet ? 'あり' : '確認できず'}`,
    `- 広告運用の痕跡: ${r.marketing.runsAds ? 'あり' : '確認できず'}`,
    '',
    '【オウンドメディア・サイト規模】',
    `- オウンドメディア/ブログ/ニュース: ${r.ownedMedia.hasOwnedMedia ? 'あり' : '見当たらない'}`,
    r.ownedMedia.mediaUrls.length ? `- 該当URL: ${r.ownedMedia.mediaUrls.join(' , ')}` : '',
    `- 記事数の概算: 約${r.ownedMedia.articleCountEstimate}件（サイト規模感: ${SCALE_LABEL[r.ownedMedia.siteScale]}）`,
    `- 最新記事の日付: ${r.ownedMedia.latestArticleDate || '取得できず'}`,
    `- 更新頻度: ${FREQ_LABEL[r.ownedMedia.updateFrequency]}（${r.ownedMedia.frequencyNote}）`,
  ].filter(Boolean).join('\n')
}

function ownToText(o?: OwnCompanyProfile | null): string {
  if (!o) return '（自社情報は未登録。一般的なBtoB支援の立場で提案すること）'
  return [
    o.companyName ? `自社名: ${o.companyName}` : '',
    o.url ? `自社URL: ${o.url}` : '',
    o.description ? `自社事業: ${o.description}` : '',
    o.valueProp ? `提供価値・強み(USP): ${o.valueProp}` : '',
    o.products ? `主な商材: ${o.products}` : '',
    o.targetCustomer ? `ターゲット顧客: ${o.targetCustomer}` : '',
    o.pricingNote ? `価格帯・導入条件: ${o.pricingNote}` : '',
    o.caseStudies ? `導入事例・実績: ${o.caseStudies}` : '',
  ].filter(Boolean).join('\n') || '（自社情報は未登録）'
}

/** 現状分析（はっきりめ）＋課題仮説＋解決策＋論点＋最初の一言 */
export async function analyzeCompany(research: CompanyResearch, own?: OwnCompanyProfile | null): Promise<CompanyAnalysis> {
  const facts = researchToFacts(research)
  const ownText = ownToText(own)

  const prompt = [
    'あなたは日本のBtoB営業/コンサルティングのトップパフォーマーです。',
    '以下の「調査事実」と「自社情報」をもとに、商談前の準備として相手企業の現状分析・課題仮説・解決策を作成してください。',
    '',
    '# 厳守する方針',
    '- 現状分析(currentStateAssessment)は、忖度せず“はっきりめ”に書く。良い点と弱点を遠慮なく言語化する（ただし誹謗ではなく事実ベース）。',
    '- すべての仮説・指摘は、必ず調査事実（従業員数/マーケ実施状況/オウンドメディア規模/記事更新頻度 等）に紐づける。事実が乏しい箇所は「未確認」と明示し、断定しすぎない。',
    '- 解決策(solutions)は、必ず自社情報の商材・強みに紐づける。自社が未登録なら一般的なBtoB支援として現実的に提案する。',
    '- 抽象語（「最適化」「強化」だけ等）で終わらせず、具体的な打ち手と期待効果を書く。',
    '',
    '# 調査事実',
    facts,
    '',
    '# 自社情報',
    ownText,
    '',
    '# 出力（次のJSONのみ。日本語。マークダウン・コードフェンス禁止）',
    '{',
    '  "currentStateAssessment": "現状分析を300〜500字で。はっきりめに。",',
    '  "strengths": ["相手企業の強み", "..."],',
    '  "weaknesses": ["弱み・伸びしろ（はっきり）", "..."],',
    '  "hypotheses": [{"issue": "課題仮説", "basis": "どの調査事実から言えるか", "impact": "放置した場合の悪影響"}],',
    '  "solutions": [{"title": "解決策タイトル", "detail": "自社商材に紐づけた具体策", "expectedEffect": "期待効果"}],',
    '  "talkingPoints": ["商談で刺さる論点（簡潔に）", "..."],',
    '  "firstMessage": "商談冒頭の最初の一言（30〜80字。相手の状況に触れて本題へ橋渡し）"',
    '}',
  ].join('\n')

  const r = await geminiGenerateJson<CompanyAnalysis>({ prompt, model: GEMINI_TEXT_MODEL_DEFAULT }, 'ShodanAnalysis')
  return {
    currentStateAssessment: r?.currentStateAssessment || '',
    strengths: Array.isArray(r?.strengths) ? r!.strengths.filter(Boolean).slice(0, 6) : [],
    weaknesses: Array.isArray(r?.weaknesses) ? r!.weaknesses.filter(Boolean).slice(0, 6) : [],
    hypotheses: Array.isArray(r?.hypotheses) ? r!.hypotheses.filter((h) => h && (h as any).issue).slice(0, 6) : [],
    solutions: Array.isArray(r?.solutions) ? r!.solutions.filter((s) => s && (s as any).title).slice(0, 6) : [],
    talkingPoints: Array.isArray(r?.talkingPoints) ? r!.talkingPoints.filter(Boolean).slice(0, 8) : [],
    firstMessage: r?.firstMessage || '',
  }
}

/** 提案資料（Markdown）を一括生成 */
export async function generateProposal(
  research: CompanyResearch,
  analysis: CompanyAnalysis,
  own?: OwnCompanyProfile | null
): Promise<string> {
  const facts = researchToFacts(research)
  const ownText = ownToText(own)
  const analysisJson = JSON.stringify(analysis, null, 2)
  const targetName = research.companyName || '貴社'
  const ownName = own?.companyName || '弊社'

  const prompt = [
    `あなたは${ownName}のトップ営業です。${targetName}への商談で実際に使える「提案資料」をMarkdownで作成してください。`,
    '提案先がそのまま読んで意思決定できる、説得力のある営業提案書にすること。',
    '',
    '# 構成（この見出し構成・順序で。Markdownの##見出しを使う）',
    '1. # 提案書タイトル（相手企業名を含める）',
    '2. ## エグゼクティブサマリー（3〜4行。結論先出し）',
    '3. ## 御社の現状理解（調査事実に基づく。数字・固有名詞を入れる。はっきりめでよいが敬体）',
    '4. ## 想定される課題（課題仮説を、根拠とともに）',
    '5. ## ご提案（解決策。自社商材に紐づけ、各施策に「何を/なぜ/期待効果」を書く）',
    '6. ## 期待できる効果（できれば定量の見立て。前提も明記）',
    '7. ## 進め方（初回〜導入のステップ）',
    '8. ## 商談で必ず触れるポイント（営業担当向けメモ。箇条書き）',
    '',
    '# 制約',
    '- 事実が未確認の箇所は断定せず「〜と推察されます」等にする。捏造禁止。',
    '- 表や箇条書きを適切に使い、読みやすく。冗長な前置きは不要。',
    '- 文体は敬体（です・ます）。ただし現状理解は遠慮しすぎない。',
    '',
    '# 調査事実',
    facts,
    '',
    '# 分析結果（JSON）',
    analysisJson,
    '',
    '# 自社情報',
    ownText,
    '',
    'では、Markdownの提案資料だけを出力してください（前置き・後書き不要）。',
  ].join('\n')

  const md = await geminiGenerateText({
    model: GEMINI_TEXT_MODEL_DEFAULT,
    parts: [{ text: prompt }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 8192 },
  })
  return (md || '').trim()
}

// ---- 自社情報の自動ドラフト（自社URLのリサーチ結果から下書きを作る） ----
export interface OwnProfileDraft {
  companyName: string
  description: string
  valueProp: string
  products: string
  targetCustomer: string
  pricingNote: string
  caseStudies: string
  /** 公開情報からは十分に書けず、ユーザーの加筆が必要なフィールドキー */
  gaps: string[]
}

const PROFILE_FIELD_KEYS = ['companyName', 'description', 'valueProp', 'products', 'targetCustomer', 'pricingNote', 'caseStudies'] as const

/**
 * 自社サイトのリサーチ結果から、自社情報フォームの下書きを生成する。
 * 公開情報で確証を持って書けない項目は gaps に入れて「加筆すべき領域」を明示する。
 */
export async function draftOwnProfile(research: CompanyResearch): Promise<OwnProfileDraft> {
  const facts = researchToFacts(research)
  const prompt = [
    'あなたは日本のBtoBマーケティングの編集者です。以下は「自社」のWebサイトを調査した事実です。',
    'この事実をもとに、営業提案で使う「自社紹介情報」の下書きを作成してください。',
    '',
    '# 方針',
    '- 事実から無理なく言える範囲で各項目を埋める。誇張・捏造はしない。',
    '- 公開情報だけでは確証を持って書けない（推測に頼る）項目は、それらしい下書きは入れた上で、その項目キーを gaps 配列に入れる（＝ユーザーに加筆を促す）。',
    '- 各項目は簡潔に（1〜3文、または短い箇条書き相当のテキスト）。',
    '',
    '# 調査事実',
    facts,
    '',
    '# 出力（次のJSONのみ。日本語。マークダウン・コードフェンス禁止）',
    '{',
    '  "companyName": "自社名",',
    '  "description": "事業内容（何をしている会社か）",',
    '  "valueProp": "提供価値・強み・USP",',
    '  "products": "主な商材・サービス",',
    '  "targetCustomer": "想定ターゲット顧客像",',
    '  "pricingNote": "価格帯・導入条件（不明なら推測せず簡潔に）",',
    '  "caseStudies": "導入事例・実績（サイトに記載があれば）",',
    '  "gaps": ["公開情報からは十分に書けずユーザー加筆が必要な項目キー", "..."]',
    '}',
  ].join('\n')

  const r = await geminiGenerateJson<OwnProfileDraft>({ prompt, model: GEMINI_TEXT_MODEL_DEFAULT }, 'ShodanOwnProfileDraft')
  const str = (v: any) => (typeof v === 'string' ? v.trim() : '')
  const draft: OwnProfileDraft = {
    companyName: str(r?.companyName) || research.companyName || '',
    description: str(r?.description) || research.description || '',
    valueProp: str(r?.valueProp),
    products: str(r?.products) || (research.services?.length ? research.services.join('、') : ''),
    targetCustomer: str(r?.targetCustomer),
    pricingNote: str(r?.pricingNote),
    caseStudies: str(r?.caseStudies),
    gaps: [],
  }
  // gaps はAIの申告＋「実際に空/極端に短い」項目を統合（加筆すべき領域を確実に拾う）
  const aiGaps = Array.isArray(r?.gaps) ? r!.gaps.filter((g): g is string => typeof g === 'string') : []
  const gapSet = new Set(aiGaps.filter((g) => (PROFILE_FIELD_KEYS as readonly string[]).includes(g)))
  for (const k of PROFILE_FIELD_KEYS) {
    const v = (draft as any)[k] as string
    if (!v || v.length < 8) gapSet.add(k)
  }
  draft.gaps = Array.from(gapSet)
  return draft
}
