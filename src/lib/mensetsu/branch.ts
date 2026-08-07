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

  const prompt = [
    'あなたは面接の進行を制御する分類器です。',
    '応募者の回答が、次のどの枝に当てはまるかを1つだけ選んでください。',
    '',
    '【判断のルール】',
    '- 回答から明確に判断できる場合のみ選ぶこと。',
    '- どれにも当てはまらない、または判断材料が足りない場合は index を null にする。',
    '- 迷ったら null。誤った枝に入って聞くべきことを聞き逃す方が損失が大きい。',
    '',
    '【出力するJSON】',
    '{ "index": 0 または null, "reason": "判断の理由（30字以内）" }',
    '',
    '【枝の一覧】',
    ...options.map((o, i) => `${i}: ${o.label} — ${o.matchHint}`),
    '',
    '【応募者の回答】',
    answer.slice(0, 2000),
  ].join('\n')

  try {
    const r = await geminiGenerateJson<{ index: number | null; reason?: string }>(
      { prompt, model: GEMINI_TEXT_MODEL_DEFAULT },
      'MensetsuBranchChoice'
    )
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
