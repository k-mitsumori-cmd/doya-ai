// ============================================
// ドヤカンニング セッション終了レポート（議事録＋評価）
// ============================================
// セッションの文字起こし＋生成した回答から、議事録(要約/決定事項/ToDo)と
// サクッとした評価(スコア＋良かった点/改善点)をモード別に生成する。
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { getMode } from './modes'
import type { CunningMode } from './types'

export interface CunningReport {
  title: string
  summary: string // 議事録の要約 / 配信ハイライト
  decisions: string[] // 決定事項（ビジネス）
  todos: string[] // ネクストアクション / ToDo
  score: number // 0-100
  scoreLabel: string // スコアの見出し（対応品質 / 神対応度 等）
  feedback: string // 総評（1〜2文）
  good: string[] // 良かった点
  improve: string[] // 改善点
}

export interface BuildReportParams {
  mode: CunningMode
  transcripts: string[] // 相手の発話（時系列）
  answers: { question: string; summary: string; script: string }[]
  personaNote?: string | null
  language?: 'ja' | 'en' | 'auto' // 出力言語: ja(既定)/en/auto(会話の主要言語に追従)
}

export async function generateReport(p: BuildReportParams): Promise<CunningReport> {
  const def = getMode(p.mode)
  const business = def.category === 'business'
  const scoreLabel = business ? '対応品質スコア' : '神対応・盛り上がりスコア'

  const lines: string[] = [
    business
      ? 'あなたは会議/商談/面接の議事録作成と対応評価を行うアシスタントです。'
      : 'あなたはライブ配信の振り返り（ハイライト＋ノリの評価）を行うアシスタントです。',
    `モード: ${def.label}`,
  ]
  if (p.personaNote) lines.push(`前提/設定: ${p.personaNote}`)

  lines.push('', '--- 会話の発話（時系列・話者別）---')
  lines.push(p.transcripts.join('\n') || '(記録なし)')
  lines.push('', '--- こちらが用意した回答カンペ ---')
  p.answers.forEach((a, i) => {
    lines.push(`${i + 1}. Q「${a.question}」→ ${a.summary}｜${a.script}`)
  })
  const langLine =
    p.language === 'en'
      ? '上記から、次のJSONのみを出力（全ての文字列値は英語で・マークダウン/コードフェンス禁止）:'
      : p.language === 'auto'
        ? '上記から、次のJSONのみを出力（会話の主要言語に合わせる・マークダウン/コードフェンス禁止）:'
        : '上記から、次のJSONのみを日本語で出力（マークダウン・コードフェンス禁止）:'

  lines.push(
    '',
    langLine,
    '{',
    '  "title": "セッションの短いタイトル",',
    business
      ? '  "summary": "議事録の要約(3〜5文)",'
      : '  "summary": "配信のハイライト要約(3〜5文)",',
    business
      ? '  "decisions": ["決定事項の箇条書き(無ければ空配列)"],'
      : '  "decisions": [],',
    business ? '  "todos": ["ネクストアクション/ToDo"],' : '  "todos": ["次回やると良いこと"],',
    '  "score": 0から100の整数,',
    `  "scoreLabel": "${scoreLabel}",`,
    '  "feedback": "総評(1〜2文)",',
    '  "good": ["良かった点"],',
    '  "improve": ["改善点/もっと良くする提案"]',
    '}'
  )

  const r = await geminiGenerateJson<CunningReport>(
    { prompt: lines.join('\n'), model: GEMINI_TEXT_MODEL_DEFAULT },
    'CunningReport'
  )
  // Invalid provider output must not be persisted as an empty report or a zero score.
  const requiredText = ['title', 'summary', 'scoreLabel', 'feedback'] as const
  const requiredLists = ['decisions', 'todos', 'good', 'improve'] as const
  if (!r || requiredText.some((key) => typeof r[key] !== 'string' || !r[key].trim()) ||
      requiredLists.some((key) => !Array.isArray(r[key]) || r[key].some((item) => typeof item !== 'string')) ||
      typeof r.score !== 'number' || !Number.isFinite(r.score) || r.score < 0 || r.score > 100) {
    throw new Error('議事録の生成結果が不完全です。再試行してください。')
  }
  return {
    title: r.title.trim(), summary: r.summary.trim(), decisions: r.decisions, todos: r.todos,
    score: Math.round(r.score), scoreLabel: r.scoreLabel.trim(), feedback: r.feedback.trim(),
    good: r.good, improve: r.improve,
  }
}
