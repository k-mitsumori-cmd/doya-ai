// ============================================
// ds/next-step-model — 次にやること帯・手順の札の、画面を持たない決まり
// ============================================
// 画面の部品（next-step.tsx）と回帰テスト（next-step.test.ts）の両方から使う。React も CSS も読まない。

/** 帯の状態: まだ何もない／作成中／できた／エラー */
export type NextStepState = 'empty' | 'working' | 'done' | 'error'
export const NEXT_STEP_STATES: readonly NextStepState[] = ['empty', 'working', 'done', 'error']

/** 手順の札の1段の状態 */
export type FlowStepState = 'done' | 'now' | 'next'

/** i 段目の状態。current は今の段（0 から）。current が段の数以上なら、すべて済み */
export function flowStepState(i: number, current: number): FlowStepState {
  if (i < current) return 'done'
  return i === current ? 'now' : 'next'
}

/** 帯の文とボタンの1組。ボタンが要らない状態（作成中など）は action を書かない */
export type NextStepCopy = { text: string; action?: string }

/** 文の長さ（1文字ずつ数える。サロゲートペアも1文字） */
export const copyLength = (s: string) => Array.from(s).length

export const NEXT_STEP_TEXT_MIN = 30
export const NEXT_STEP_TEXT_MAX = 45
export const NEXT_STEP_ACTION_MAX = 16

const EMOJI = /\p{Extended_Pictographic}/u
// 内部の言葉（モデル名・HTTP のコード・英語のエラー）を利用者に見せない
const INTERNAL = /(gpt|gemini|openai|api|http|error|failed|\b[45]\d\d\b)/i

/** 帯の文の決まりに合わないところを返す（空なら合っている） */
export function nextStepCopyProblems(c: NextStepCopy): string[] {
  const out: string[] = []
  const n = copyLength(c.text)
  if (n < NEXT_STEP_TEXT_MIN || n > NEXT_STEP_TEXT_MAX) out.push(`文が${n}字（${NEXT_STEP_TEXT_MIN}〜${NEXT_STEP_TEXT_MAX}字にする）: ${c.text}`)
  if (!c.text.endsWith('。')) out.push(`文が「。」で終わらない: ${c.text}`)
  // 1文にする（文の途中に「。」を入れない）
  if (c.text.slice(0, -1).includes('。')) out.push(`2文になっている: ${c.text}`)
  for (const s of [c.text, c.action ?? '']) {
    if (EMOJI.test(s)) out.push(`絵文字がある: ${s}`)
    if (INTERNAL.test(s)) out.push(`内部の言葉がある: ${s}`)
  }
  if (c.action !== undefined) {
    const a = copyLength(c.action)
    if (a === 0 || a > NEXT_STEP_ACTION_MAX) out.push(`ボタンが${a}字（1〜${NEXT_STEP_ACTION_MAX}字にする）: ${c.action}`)
    if (/[。、]$/.test(c.action)) out.push(`ボタンが句読点で終わる: ${c.action}`)
  }
  return out
}
