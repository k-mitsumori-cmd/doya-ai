// ============================================
// ドヤカンニング 回答生成
// ============================================
// 質問 + コンテキスト（商談=ナレッジ / 面接=企業×応募者）→ 要点＋話すスクリプト。
// 低レイテンシ優先で gemini-2.0-flash、失敗時は gpt-4o にフォールバック。
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { withTimeout, raceTimeout } from '@/lib/fetch-timeout'
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

  lines.push(
    '',
    `${def.inputLabel}: 「${p.question}」`,
    '',
    '次の形式で、日本語・JSONのみを出力してください（マークダウン・コードフェンス禁止）:',
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

async function gpt4oFallback(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY が設定されていません')
  return withTimeout('gpt-4o answer', 25000, async (signal) => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      }),
      signal,
    })
    if (!res.ok) throw new Error(`gpt-4o failed (${res.status})`)
    const json = await res.json()
    return json?.choices?.[0]?.message?.content || ''
  })
}

/** 質問→回答（要点＋スクリプト＋根拠）。gemini-flash 優先、失敗時 gpt-4o。 */
export async function generateAnswer(p: BuildAnswerParams): Promise<CunningAnswerResult> {
  const { prompt, sources } = buildPrompt(p)

  let raw = ''
  let model = GEMINI_TEXT_MODEL_DEFAULT
  try {
    raw = await raceTimeout(
      'gemini answer',
      20000,
      geminiGenerateText({
        model: GEMINI_TEXT_MODEL_DEFAULT,
        parts: [{ text: prompt }],
        generationConfig: { temperature: 0.5 },
      })
    )
  } catch (e) {
    console.warn('[cunning/answer] gemini失敗、gpt-4oにフォールバック:', (e as any)?.message)
    raw = await gpt4oFallback(prompt)
    model = 'gpt-4o'
  }

  const { summary, script } = parseAnswer(raw)
  return { summary, script, sources, model }
}
