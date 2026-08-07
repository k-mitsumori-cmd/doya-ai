// ============================================
// ドヤ面接官 分岐の選択
// ============================================
// 直前の回答から、どの枝へ進むかを決める。
//
// ⚠️ 幹（主質問）は分岐させない。枝は「どの深掘りをするか」と
//    「前提が崩れたときにどこまで飛ばすか」だけを決める。
//    面接は全員に同じ主質問を尋ねることが公正な比較の前提であり、
//    幹まで分岐させると応募者ごとに聞かれた内容が変わって比較できなくなる。
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

export interface BranchOption {
  id: string
  ord: number
  label: string
  matchHint: string
  text: string | null
  skipToOrd: number | null
}

export interface BranchChoice {
  branch: BranchOption | null
  reason: string
}

/**
 * 回答テキストから枝を選ぶ。
 * 判定に失敗したら null（＝分岐せず通常の深掘りへ）。
 * 迷ったら分岐しない側に倒すのは、誤った枝に入って
 * 聞くべきことを聞き逃す方が損失が大きいため。
 */
export async function chooseBranch(
  answer: string,
  options: BranchOption[]
): Promise<BranchChoice> {
  if (options.length === 0 || !answer.trim()) return { branch: null, reason: 'no_options' }

  // 相槌だけ・極端に短い回答はモデルに問い合わせるまでもなく判断材料が無い。
  // 呼び出しを減らすと同時に、そこでの誤判定も消える。
  const stripped = answer.replace(/[\s、。！？!?ー…]/g, '')
  if (stripped.length < 12) return { branch: null, reason: 'too_short' }

  // ⚠️ 実測で「うーん、そうですね、まあ、はい。」のような中身の無い回答に対し、
  //    最も肯定的な枝を選んでしまった。答えられていない応募者が
  //    「答えられた前提」の深掘りに進むのは実害があるため、
  //    判断材料の有無を先に自己申告させてから枝を選ばせる二段構えにする。
  const prompt = [
    'あなたは面接の進行を制御する分類器です。',
    '応募者の回答が、次のどの枝に当てはまるかを判定してください。',
    '',
    '【手順】',
    '1. まず、その回答に「枝を判別できるだけの具体的な内容」が含まれているかを判定する。',
    '   相槌のみ（「はい」「そうですね」「うーん」）、言い淀み、無言、質問の聞き返し、',
    '   一般論だけで自分の経験に触れていない回答は **すべて判断材料なし** とする。',
    '2. 判断材料がない場合は、その時点で index を null にする。枝を推測してはならない。',
    '3. 判断材料がある場合のみ、どの枝に当てはまるかを1つ選ぶ。',
    '',
    '【重要】',
    '- 迷ったら必ず null。誤った枝に入ると、答えられていない応募者に',
    '  「答えられた前提」の深掘りをすることになり、面接が破綻する。',
    '- 「どちらかといえば近い」程度では選ばない。明確に当てはまる場合だけ選ぶ。',
    '',
    '【出力するJSON】',
    '{ "hasEvidence": true/false, "index": 0 または null, "reason": "判断の理由（30字以内）" }',
    '  hasEvidence が false のときは index を必ず null にすること。',
    '',
    '【枝の一覧】',
    ...options.map((o, i) => `${i}: ${o.label} — ${o.matchHint}`),
    '',
    '【応募者の回答】',
    answer.slice(0, 2000),
  ].join('\n')

  try {
    const r = await geminiGenerateJson<{ hasEvidence?: boolean; index: number | null; reason?: string }>(
      { prompt, model: GEMINI_TEXT_MODEL_DEFAULT },
      'MensetsuBranchChoice'
    )
    // 判断材料が無いと自己申告したら、index が入っていても採用しない
    if (r?.hasEvidence === false) {
      return { branch: null, reason: r?.reason || 'no_evidence' }
    }
    const i = Number(r?.index)
    if (!Number.isFinite(i) || i < 0 || i >= options.length) {
      return { branch: null, reason: r?.reason || 'unmatched' }
    }
    return { branch: options[i], reason: String(r?.reason || '') }
  } catch {
    // 判定に失敗しても面接は止めない。通常の深掘りへ倒す。
    return { branch: null, reason: 'error' }
  }
}
