// ========================================
// ドヤインタビューAI - プロンプト生成
// ========================================

import { generateTextWithGemini } from '@/lib/gemini-text'

export interface ProposalInput {
  intervieweeName?: string
  intervieweeRole?: string
  intervieweeCompany?: string
  theme?: string
  purpose?: string
  targetAudience?: string
  tone?: string
  mediaType?: string
}

export interface Proposal {
  title: string
  summary: string
  questions: string[]
  value: string
}

// 企画提案を生成
export async function generateProposals(input: ProposalInput): Promise<Proposal[]> {
  const prompt = `
あなたはインタビュー記事の企画立案を支援する専門家です。
以下の情報を基に、3〜5件の企画案を提案してください。

【インタビュー対象者】
- 名前: ${input.intervieweeName || '未指定'}
- 役職・職業: ${input.intervieweeRole || '未指定'}
- 所属企業: ${input.intervieweeCompany || '未指定'}

【取材テーマ・目的】
${input.theme || '未指定'}

【目的】
${input.purpose || '未指定'}

【想定読者】
${input.targetAudience || '一般読者'}

【トーン】
${input.tone || 'friendly'}

【掲載媒体】
${input.mediaType || 'blog'}

以下のJSON形式で出力してください：
[
  {
    "title": "企画案のタイトル",
    "summary": "企画案の概要（100文字程度）",
    "questions": ["質問1", "質問2", "質問3", ...],
    "value": "この企画案の価値・読者へのメリット（100文字程度）"
  },
  ...
]

各企画案には5〜10個の質問を含めてください。
`

  try {
    const response = await generateTextWithGemini(prompt, {})
    // JSONをパース
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const proposals = JSON.parse(jsonMatch[0]) as Proposal[]
      return proposals
    }
    // フォールバック: デフォルト提案
    return [
      {
        title: 'インタビュー記事',
        summary: '対象者の経験や想いを伝える記事',
        questions: ['自己紹介をお願いします', '現在の取り組みについて教えてください', '今後の展望は？'],
        value: '読者が対象者の考えや経験を理解できる',
      },
    ]
  } catch (error) {
    console.error('[INTERVIEW] Proposal generation error:', error)
    throw error
  }
}

// 構成案を生成
export async function generateOutline(transcription: string, proposal?: Proposal | { title?: string; summary?: string; questions?: string[]; value?: string }): Promise<string> {
  const prompt = `
以下の文字起こしテキストと企画案を基に、記事の構成案を作成してください。

【企画案】
タイトル: ${proposal?.title || 'インタビュー記事'}
概要: ${proposal?.summary || ''}

【文字起こしテキスト】
${transcription.substring(0, 5000)}...

以下の形式で構成案を出力してください：
1. リード文（200文字程度）
2. 見出し1（段落の要約）
3. 見出し2（段落の要約）
...

各見出しには、その段落で扱う内容の要約と、引用したい発言の候補を含めてください。
`

  try {
    const outline = await generateTextWithGemini(prompt, {})
    return outline
  } catch (error) {
    console.error('[INTERVIEW] Outline generation error:', error)
    throw error
  }
}

// 記事ドラフトを生成
export async function generateDraft(transcription: string, outline: string, tone: string = 'friendly'): Promise<string> {
  const prompt = `
以下の文字起こしテキストと構成案を基に、完成度の高いインタビュー記事のドラフトを作成してください。

【構成案】
${outline}

【文字起こしテキスト】
${transcription.substring(0, 10000)}...

【トーン】
${tone}

以下の形式で記事を作成してください：
- リード文（300文字程度）
- 本文（各見出しごとに段落を構成）
- 引用は「」で囲む
- 読みやすく、自然な日本語で

記事全体で3000〜5000文字程度を目安にしてください。
`

  try {
    const draft = await generateTextWithGemini(prompt, {})
    return draft
  } catch (error) {
    console.error('[INTERVIEW] Draft generation error:', error)
    throw error
  }
}

// 校閲レポートを生成
export async function generateReview(draft: string): Promise<string> {
  const prompt = `
以下の記事ドラフトを校閲し、改善点を指摘してください。

【記事ドラフト】
${draft}

以下の観点でチェックしてください：
1. 誤字脱字・文法ミス
2. 事実確認が必要な箇所
3. 読みやすさ・自然な日本語
4. 一貫性
5. 改善提案

校閲レポートを出力してください。
`

  try {
    const review = await generateTextWithGemini(prompt, {})
    return review
  } catch (error) {
    console.error('[INTERVIEW] Review generation error:', error)
    throw error
  }
}

