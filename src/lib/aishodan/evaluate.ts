// ============================================
// ドヤAI商談 商談後の要約・フィットスコア算出
// ============================================
// ⚠️ スコアは**参考値**。誰と商談を続けるかを決めるのは人であり、
//    AIの点数で見込み客を切り捨てさせない。画面にもその旨を必ず出す。
//    ホストは手動で上書きでき、上書きは記録して改善の材料にする。
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import type { Icp, Slot, Verdict } from './types'

export interface EvaluateInput {
  productName: string
  icp: Icp
  slots: Slot[]
  slotValues: Array<{ key: string; value: string }>
  turns: Array<{ speaker: string; text: string }>
  unansweredQuestions: string[]
}

export interface EvaluationResult {
  fitScore: number
  verdict: Verdict
  reason: string
  summary: {
    headline: string[]
    challenge: string
    proposed: string
    objections: string[]
  }
  nextAction: string
  /** ICP条件ごとの当たり外れ（根拠の可視化） */
  conditions: Array<{ key: string; label: string; met: boolean; weight: number; note: string }>
}

function verdictFor(score: number): Verdict {
  if (score >= 75) return 'hot'
  if (score >= 50) return 'warm'
  if (score >= 25) return 'cold'
  return 'unfit'
}

export async function evaluateSession(input: EvaluateInput): Promise<EvaluationResult> {
  const { productName, icp, slots, slotValues, turns, unansweredQuestions } = input

  const transcript = turns
    .map((t) => `${t.speaker === 'ai' ? '営業AI' : '見込み客'}: ${t.text}`)
    .join('\n')
    .slice(0, 24000)

  const slotText = slots
    .map((s) => {
      const v = slotValues.find((x) => x.key === s.key)
      return `- ${s.label}: ${v?.value || '（聞き取れず）'}`
    })
    .join('\n')

  const conditionsText = icp.conditions
    .map((c) => `- key="${c.key}" ${c.label}（重み${c.weight}）: ${c.match}`)
    .join('\n')

  const prompt = [
    'あなたは法人営業のマネージャーです。以下の一次商談のログを読み、内容を要約し、自社の理想顧客像との適合を判定してください。',
    '',
    '【判定のルール】',
    '- 各条件について、**ログの中に根拠があるときだけ** met=true にしてください。',
    '  言及が無い、はぐらかされた、判断がつかない場合は met=false です。',
    '  「たぶん当てはまるだろう」で true にしてはいけません。',
    '- note には、なぜそう判定したかを、できればログ中の相手の発言を引用して書いてください。',
    '- reason は、担当者が読んで次の動きを決められる文章にしてください（150字程度）。',
    '- nextAction は具体的に書いてください（「担当者から連絡」ではなく「予算確定時期の8月上旬に、費用対効果の試算を持って再提案」のように）。',
    '',
    '【出力するJSONの形式】',
    '{',
    '  "conditions": [{ "key": "条件のkey", "met": true, "note": "判定の根拠" }],',
    '  "reason": "総合的な判定理由",',
    '  "summary": {',
    '    "headline": ["商談の要点を3行で"],',
    '    "challenge": "相手が抱えている課題",',
    '    "proposed": "こちらが提案した内容",',
    '    "objections": ["相手が示した懸念・反論"]',
    '  },',
    '  "nextAction": "次にとるべきアクション"',
    '}',
    '',
    `【商材】${productName}`,
    '',
    '【理想顧客像の条件】',
    conditionsText,
    '',
    '【ヒアリング結果】',
    slotText,
    '',
    unansweredQuestions.length > 0 ? `【その場で答えられなかった質問】\n${unansweredQuestions.map((q) => `- ${q}`).join('\n')}` : '',
    '',
    '【商談ログ】',
    transcript,
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await geminiGenerateJson<any>({ prompt, model: GEMINI_TEXT_MODEL_DEFAULT }, 'AishodanEvaluation')

  // --- スコアはモデルに出させず、条件の重みからサーバで計算する ---
  // ⚠️ 点数そのものを生成させると、根拠（conditions）と数字が食い違う。
  //    判定は条件ごとの真偽だけをさせ、合計はコードで出す。
  const rawConditions: any[] = Array.isArray(raw?.conditions) ? raw.conditions : []
  const conditions = icp.conditions.map((c) => {
    const hit = rawConditions.find((r) => r && r.key === c.key)
    return {
      key: c.key,
      label: c.label,
      weight: c.weight,
      met: hit?.met === true,
      note: String(hit?.note || '').slice(0, 400),
    }
  })

  const totalWeight = conditions.reduce((n, c) => n + c.weight, 0)
  const gained = conditions.filter((c) => c.met).reduce((n, c) => n + c.weight, 0)
  const fitScore = totalWeight > 0 ? Math.round((gained / totalWeight) * 100) : 0

  return {
    fitScore,
    verdict: verdictFor(fitScore),
    reason: String(raw?.reason || '').slice(0, 1500),
    summary: {
      headline: (raw?.summary?.headline || []).filter((s: unknown) => typeof s === 'string').slice(0, 5),
      challenge: String(raw?.summary?.challenge || '').slice(0, 1000),
      proposed: String(raw?.summary?.proposed || '').slice(0, 1000),
      objections: (raw?.summary?.objections || []).filter((s: unknown) => typeof s === 'string').slice(0, 8),
    },
    nextAction: String(raw?.nextAction || '').slice(0, 800),
    conditions,
  }
}
