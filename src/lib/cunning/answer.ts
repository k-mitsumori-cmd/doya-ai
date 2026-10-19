// ============================================
// ドヤカンニング 回答生成
// ============================================
// 質問 + コンテキスト（商談=ナレッジ / 面接=企業×応募者）→ 要点＋話すスクリプト。
// 費用を抑えるため、安い gemini-2.5-flash だけを直接呼ぶ（2026-10 原価見直し）。
// ⚠️ 共通の geminiGenerateText() は ANTHROPIC_API_KEY があると Claude Sonnet を先に呼び、
//    最後は gpt-4o まで落ちる。自動回答は件数が多いので、ここでは使わない。
// ⚠️ 20秒を過ぎても gpt-4o へは切り替えない。要求を打ち切り、失敗として返す。
import { withTimeout } from '@/lib/fetch-timeout'
import { getMode } from './modes'
import type {
  AnswerSource,
  ApplicantProfileLite,
  CompanyProfileLite,
  CunningAnswerResult,
  CunningMode,
  KnowledgeChunkLite,
} from './types'

export interface BuildAnswerParams {
  mode: CunningMode
  question: string
  recentTranscript?: string // 直近の会話文脈
  chunks?: KnowledgeChunkLite[] // sales
  company?: CompanyProfileLite | null // interview
  applicant?: ApplicantProfileLite | null // interview
  personaNote?: string | null // 任意の前提/キャラ設定
  language?: 'ja' | 'en' | 'auto' // 出力言語: ja(既定)/en/auto(質問と同じ言語)
}

function buildPrompt(p: BuildAnswerParams): { prompt: string; sources: AnswerSource[] } {
  const def = getMode(p.mode)
  const sources: AnswerSource[] = []
  const lines: string[] = [...def.persona]

  // ユーザー指定のキャラ設定/前提（口調・世界観・名前・補足など）を最優先で反映
  if (p.personaNote && p.personaNote.trim()) {
    lines.push('', `【設定・前提（必ず守る）】 ${p.personaNote.trim()}`)
  }

  // コンテキスト注入（モード定義に従う）
  if (def.context === 'knowledge') {
    if (p.chunks && p.chunks.length > 0) {
      lines.push('', '--- 自社サービス参考情報 ---')
      p.chunks.forEach((c, i) => {
        lines.push(`[${i + 1}] ${c.content}`)
        sources.push({ label: c.sourceLabel || `ナレッジ${i + 1}`, url: c.sourceUrl || undefined })
      })
      lines.push('--- 参考情報ここまで ---')
    } else {
      lines.push('', '※ 参考情報が未登録のため、一般的なベストプラクティスで回答してください。')
    }
  } else if (def.context === 'company') {
    if (p.company) {
      lines.push('', '--- 応募先企業 ---')
      if (p.company.companyName) lines.push(`企業名: ${p.company.companyName}`)
      if (p.company.businessSummary) lines.push(`事業内容: ${p.company.businessSummary}`)
      if (p.company.requirements) lines.push(`求める人物像/要件: ${JSON.stringify(p.company.requirements)}`)
      sources.push({ label: p.company.companyName || '応募先企業情報' })
    }
    if (p.applicant) {
      lines.push('', '--- 応募者プロフィール ---')
      if (p.applicant.resume) lines.push(`経歴: ${p.applicant.resume}`)
      if (p.applicant.motivation) lines.push(`志望動機メモ: ${p.applicant.motivation}`)
    }
  }

  if (p.recentTranscript) {
    lines.push('', `直近の流れ: ${p.recentTranscript}`)
  }

  const langInstruction =
    p.language === 'en'
      ? 'Output in English. JSON only (no markdown, no code fences):'
      : p.language === 'auto'
        ? '質問と同じ言語で、JSONのみを出力してください（マークダウン・コードフェンス禁止）:'
        : '次の形式で、日本語・JSONのみを出力してください（マークダウン・コードフェンス禁止）:'

  lines.push(
    '',
    `${def.inputLabel}: 「${p.question}」`,
    '',
    langInstruction,
    '{',
    `  "summary": "${def.outputHint.summary}",`,
    `  "script": "${def.outputHint.script}"`,
    '}'
  )

  return { prompt: lines.join('\n'), sources }
}

function parseAnswer(text: string): { summary: string; script: string } {
  const cleaned = text.replace(/```json|```/g, '').trim()
  try {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      const obj = JSON.parse(cleaned.slice(start, end + 1))
      const summary = String(obj.summary || '').trim()
      const script = String(obj.script || '').trim()
      if (summary || script) return { summary: summary || script.slice(0, 40), script: script || summary }
    }
  } catch {
    /* fallthrough */
  }
  // JSONでなければ全文をスクリプト扱い・先頭をsummaryに
  const plain = cleaned.replace(/^\s*[{}\[\]"]+\s*/g, '').trim()
  return { summary: plain.slice(0, 40), script: plain }
}

/** 回答に使うモデル。生存確認済みの ID だけを使う（新しい ID を足すときは実APIで確認する） */
export const CUNNING_ANSWER_MODEL = 'gemini-2.5-flash'
/** 回答1件の出力上限（トークン）。要点＋話すスクリプトに十分な長さ */
export const CUNNING_ANSWER_MAX_OUTPUT_TOKENS = 800
/** 回答を待つ上限。これを過ぎたら要求を打ち切る（別モデルでのやり直しはしない） */
export const CUNNING_ANSWER_TIMEOUT_MS = 20000
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${CUNNING_ANSWER_MODEL}:generateContent`

function geminiApiKey(): string {
  // seo/lib/gemini.ts:getApiKey と同じ候補順
  const key = [
    process.env.GOOGLE_GENAI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ].find((v): v is string => typeof v === 'string' && v.trim().length > 0)
  if (!key) throw new Error('Gemini APIキーが設定されていません')
  return key.trim()
}

async function callGeminiFlash(prompt: string): Promise<string> {
  const apiKey = geminiApiKey()
  return withTimeout('gemini answer', CUNNING_ANSWER_TIMEOUT_MS, async (signal) => {
    const res = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: CUNNING_ANSWER_MAX_OUTPUT_TOKENS,
          // 思考トークンも出力上限に数えられるため、思考を止めて800を本文に使う
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal,
    })
    if (!res.ok) throw new Error(`gemini answer failed (${res.status})`)
    const json = await res.json()
    const parts = json?.candidates?.[0]?.content?.parts
    if (!Array.isArray(parts)) return ''
    return parts
      .filter((part: any) => part && !part.thought && typeof part.text === 'string')
      .map((part: any) => part.text)
      .join('')
  })
}

/** 質問→回答（要点＋スクリプト＋根拠）。gemini-2.5-flash のみ。失敗時は別モデルを呼ばない。 */
export async function generateAnswer(p: BuildAnswerParams): Promise<CunningAnswerResult> {
  const { prompt, sources } = buildPrompt(p)

  let raw = ''
  try {
    raw = await callGeminiFlash(prompt)
  } catch {
    // 要求は AbortSignal で打ち切り済み。裏で動き続ける処理は残らないので、
    // 受付を解放して再試行できるようにする（cunningAnswerMayBeRunning=false）。
    // 提供元のエラー本文はログにも応答にも出さない。
    console.warn('[cunning/answer] 回答を作れませんでした')
    throw Object.assign(new Error('Answer generation failed'), { cunningAnswerMayBeRunning: false })
  }

  const { summary, script } = parseAnswer(raw)
  return { summary, script, sources, model: CUNNING_ANSWER_MODEL }
}
