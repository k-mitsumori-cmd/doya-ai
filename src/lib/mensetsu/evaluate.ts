// ============================================
// ドヤ面接官 評価バッチ（F2）
// ============================================
// ⚠️ 評価は「面接中」ではなく「面接後」に実行する。
//    理由: 面接中の低遅延モデルに採点までさせると会話品質が落ちる。
//          また、全体を通して聞かないと軸ごとの相対評価ができない。
//
// ⚠️ 出力は「合否」ではなく推薦度（C2）。最終決定は人間が行う。
//    情報が足りない軸は insufficient=true とし、推測でスコアを埋めない（F2-4）。
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { GUARDRAIL_PROMPT } from './guardrails'
import type { CriterionScore, EvaluationResult, Rubric, Verdict } from './types'

const VALID_VERDICTS: Verdict[] = ['recommend', 'conditional', 'hold', 'reject']

export interface EvaluateInput {
  jobTitle: string
  levelLabel: string
  companyName?: string
  criteria: Array<{ key: string; name: string; description?: string | null; rubric: Rubric; weight: number }>
  questions: Array<{ ord: number; text: string }>
  turns: Array<{ speaker: string; text: string; questionOrd?: number | null }>
  /** 模範回答ライブラリ（few-shot。Phase 2で活用） */
  samples?: Array<{ criterionKey: string; questionText: string; answerText: string; label: string }>
}

function buildTranscript(turns: EvaluateInput['turns']): string {
  return turns
    .map((t) => `${t.speaker === 'interviewer' ? '面接官' : '応募者'}: ${t.text}`)
    .join('\n')
}

export async function evaluateSession(input: EvaluateInput): Promise<EvaluationResult> {
  const transcript = buildTranscript(input.turns)
  const candidateWordCount = input.turns
    .filter((t) => t.speaker === 'candidate')
    .reduce((n, t) => n + t.text.length, 0)

  const prompt = [
    'あなたは公正な採用評価を行う面接評価者です。以下の面接の逐語ログを、示された評価軸とルーブリックに厳密に従って採点してください。',
    '',
    GUARDRAIL_PROMPT,
    '',
    '【採点の原則】',
    '- スコアは必ずルーブリックの記述と照合して決める。印象で決めない。',
    '- 各スコアには、根拠となる「応募者の発言の引用」を必ず1つ以上つける。引用は逐語ログから一字一句そのまま抜き出すこと。',
    '- その軸を判断するだけの発言が無い場合は、score を null、insufficient を true にする。**推測でスコアを埋めてはならない。**',
    '- 応募者が話していない内容を、話したことにしてはならない。',
    '',
    '【総合判定】',
    '- verdict は recommend（推奨） / conditional（条件付き推奨） / hold（保留） / reject（見送り） のいずれか。',
    '- これは「合否」ではなく採用担当者への推薦度である。最終決定は人間が行う。',
    '- 情報不足の軸が多い場合は、安易に reject とせず hold を選ぶこと。',
    '',
    '【2種類の文面】',
    '- candidateFeedback: 応募者本人に見せる想定。強みと今後に活きる改善提案。敬体で、否定的な断定を避ける。',
    '- recruiterReport: 採用担当者向け。懸念点、確認しきれなかった点、次の面接で聞くべきことを率直に書く。',
    '',
    '【出力するJSONの形式】',
    '{',
    '  "scores": [',
    '    { "criterionKey": "key", "score": 1-5 または null, "insufficient": true/false,',
    '      "rationale": "採点理由", "quotes": ["応募者の発言の引用"] }',
    '  ],',
    '  "verdict": "recommend|conditional|hold|reject",',
    '  "overallComment": "総評（200字程度）",',
    '  "candidateFeedback": "応募者向けフィードバック（300字程度）",',
    '  "recruiterReport": "採用担当者向けレポート（400字程度）"',
    '}',
    '',
    `【募集】${input.companyName || ''} / ${input.jobTitle} / ${input.levelLabel}`,
    '',
    '【評価軸とルーブリック】',
    JSON.stringify(input.criteria, null, 2),
    '',
    '【主質問】',
    input.questions.map((q) => `${q.ord + 1}. ${q.text}`).join('\n'),
    '',
    input.samples && input.samples.length > 0
      ? `【自社の採点例（過去のラベル付け）】\n${JSON.stringify(input.samples.slice(0, 12), null, 2)}\n`
      : '',
    '【面接の逐語ログ】',
    transcript || '（発話なし）',
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await geminiGenerateJson<EvaluationResult>(
    { prompt, model: GEMINI_TEXT_MODEL_DEFAULT },
    'MensetsuEvaluation'
  )

  // --- 正規化と安全側への倒し込み ---
  const validKeys = new Set(input.criteria.map((c) => c.key))
  // 同じ軸を2回返してくることがある。MensetsuScore は [sessionId, criterionId] が unique なので、
  // 重複したまま createMany すると一意制約違反で評価全体が落ちる。ここで先頭だけ残す。
  const seenKeys = new Set<string>()
  const scores: CriterionScore[] = (raw.scores || [])
    .filter((s) => {
      if (!s || !validKeys.has(s.criterionKey)) return false
      if (seenKeys.has(s.criterionKey)) return false
      seenKeys.add(s.criterionKey)
      return true
    })
    .map((s) => {
      const n = Number(s.score)
      const valid = Number.isFinite(n) && n >= 1 && n <= 5
      // 引用が無いスコアは根拠不十分として情報不足に倒す（幻覚での加点を防ぐ）
      const quotes = Array.isArray(s.quotes) ? s.quotes.filter((q) => typeof q === 'string' && q.trim()) : []
      const insufficient = !!s.insufficient || !valid || quotes.length === 0
      return {
        criterionKey: s.criterionKey,
        score: insufficient ? null : Math.round(n),
        insufficient,
        rationale: String(s.rationale || ''),
        quotes,
      }
    })

  // 採点されなかった軸は「情報不足」として明示的に埋める（欠落と情報不足を区別する）
  for (const c of input.criteria) {
    if (!scores.some((s) => s.criterionKey === c.key)) {
      scores.push({
        criterionKey: c.key,
        score: null,
        insufficient: true,
        rationale: 'この軸を判断できる発言が確認できませんでした。',
        quotes: [],
      })
    }
  }

  let verdict: Verdict = VALID_VERDICTS.includes(raw.verdict) ? raw.verdict : 'hold'

  // 発話量が極端に少ない／過半の軸が情報不足なら、reject を確定させず hold に倒す。
  // AIの判定だけで応募者を落とさないための安全弁（C2）。
  const insufficientRatio = scores.filter((s) => s.insufficient).length / Math.max(1, scores.length)
  if (verdict === 'reject' && (insufficientRatio >= 0.5 || candidateWordCount < 200)) {
    verdict = 'hold'
  }

  return {
    scores,
    verdict,
    overallComment: String(raw.overallComment || ''),
    candidateFeedback: String(raw.candidateFeedback || ''),
    recruiterReport: String(raw.recruiterReport || ''),
  }
}

/** 重み付き平均スコア（情報不足の軸は分母から除く）。表示用の参考値。 */
export function weightedAverage(
  scores: CriterionScore[],
  criteria: Array<{ key: string; weight: number }>
): number | null {
  let sum = 0
  let w = 0
  for (const s of scores) {
    if (s.insufficient || s.score == null) continue
    const weight = criteria.find((c) => c.key === s.criterionKey)?.weight ?? 1
    sum += s.score * weight
    w += weight
  }
  if (w === 0) return null
  return Math.round((sum / w) * 10) / 10
}
