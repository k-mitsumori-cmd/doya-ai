// 有料の API を使う確認（1日1回）。モデルの情報を読むだけでは分からない「実際に生成できるか」
// （クレジット切れ・利用上限・課金の停止）を、いちばん安いモデルに短い文を1回返させて確かめる。
// ⚠️ 従量課金。SystemSetting の watch:v1:paid-enabled が 'true' のときだけ動く（ユーザーの承認後に有効にする。判定は paid-run.ts）。
//
// 見込み額（2026-10-26 時点の単価。1回あたりの入出力はおよそ 30 / 5 トークン）
//   Gemini gemini-2.5-flash（思考なし）  $0.30 / $2.50 per 1M → 約 $0.00002 / 回
//   Claude claude-haiku-4-5-20251001     $1.00 / $5.00 per 1M → 約 $0.00006 / 回
//   OpenAI gpt-4o-mini                   $0.15 / $0.60 per 1M → 約 $0.00001 / 回
//   合計 約 $0.0001 / 日、約 $0.003 / 月
import { callClaudeMessages } from '@/lib/mitsuboshi/_shared/anthropic'
import { bodySnippet, describeFetchError } from '@/lib/health-check-report'
import type { CheckDef, CheckOutcome } from './types'

export const PAID_ENABLED_KEY = 'watch:v1:paid-enabled'


async function postJson(url: string, headers: Record<string, string>, body: unknown, pick: (j: any) => string | undefined): Promise<CheckOutcome> {
  let res: Response
  try {
    res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) })
  } catch (e) {
    return { ok: false, url, error: describeFetchError(e, 30_000) }
  }
  const text = await res.text().catch(() => '')
  if (!res.ok) return { ok: false, url, status: res.status, error: `HTTP ${res.status}: ${bodySnippet(text, 200)}` }
  try {
    const out = pick(JSON.parse(text))
    return out ? { ok: true, url, status: res.status, detail: `返答「${out.slice(0, 20)}」` } : { ok: false, url, status: res.status, error: `返答が空です: ${bodySnippet(text, 160)}` }
  } catch {
    return { ok: false, url, status: res.status, error: `JSON として読めません: ${bodySnippet(text, 120)}` }
  }
}

const PROMPT = 'OK とだけ返してください。'

/** costYen は1回の見込み額（円、1ドル=150円）。1日の上限の計算に使う */
export function paidChecks(): (CheckDef & { costYen: number })[] {
  return [
    {
      id: 'paid:gemini-generate', area: '外部サービス', label: 'Gemini で実際に生成できるか（gemini-2.5-flash）', severity: 'urgent', threshold: 1, costYen: 0.003,
      hints: ['429 なら利用上限、403 ならキーの制限か課金の停止。Google AI Studio の課金と上限を見る', '記事作成・インタビュー・バナーの文章など、Gemini を使うツールがすべて止まっている可能性がある'],
      run: async () => {
        const key = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY
        if (!key) return { ok: false, error: 'GOOGLE_GENAI_API_KEY が本番に設定されていません' }
        return postJson('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', { 'x-goog-api-key': key },
          { contents: [{ role: 'user', parts: [{ text: PROMPT }] }], generationConfig: { maxOutputTokens: 16, thinkingConfig: { thinkingBudget: 0 } } },
          j => j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('').trim())
      },
    },
    {
      id: 'paid:claude-generate', area: '外部サービス', label: 'Claude で実際に生成できるか（claude-haiku-4-5）', severity: 'urgent', threshold: 1, costYen: 0.009,
      hints: ['400 で credit balance と出ていれば、Anthropic Console でクレジットを足す', '記事作成（SEO）・展開・ミツボシ・AIO が Claude を使っている'],
      run: async () => {
        try {
          const r = await callClaudeMessages({ systemPrompt: '短く答える。', userPrompt: PROMPT, model: 'claude-haiku-4-5-20251001', maxTokens: 16 })
          return r.text.trim() ? { ok: true, detail: `返答「${r.text.trim().slice(0, 20)}」（入力 ${r.inputTokens} / 出力 ${r.outputTokens} トークン）` } : { ok: false, error: '返答が空です' }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : String(e) }
        }
      },
    },
    {
      id: 'paid:openai-generate', area: '外部サービス', label: 'OpenAI で実際に生成できるか（gpt-4o-mini）', severity: 'action', threshold: 1, costYen: 0.002,
      hints: ['429 の insufficient_quota なら OpenAI の課金の残高を見る（画像生成の gpt-image-2 も止まる）'],
      run: async () => {
        if (!process.env.OPENAI_API_KEY) return { ok: false, error: 'OPENAI_API_KEY が本番に設定されていません' }
        return postJson('https://api.openai.com/v1/chat/completions', { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          { model: 'gpt-4o-mini', max_tokens: 5, messages: [{ role: 'user', content: PROMPT }] },
          j => j.choices?.[0]?.message?.content?.trim())
      },
    },
  ]
}
