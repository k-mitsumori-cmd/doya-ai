// ============================================
// ドヤ面接官 進行エンジン（F1-4, F1-5, F1-7）
// ============================================
// AIに丸投げすると面接が脱線し、全応募者に同じ質問という構造化面接の前提が崩れる。
// 「次へ進むか / 深掘りするか / 締めるか」はサーバがステートを持ち、
// Realtime の function calling から呼ばれてサーバが決める。
import { GUARDRAIL_PROMPT } from './guardrails'
import type { AdvanceResult } from './types'

/** 1つの主質問で許す深掘りの上限（F1-4） */
export const MAX_FOLLOW_UPS = 2

export interface AdvanceInput {
  /** 現在の主質問index（0始まり） */
  currentIndex: number
  /** 現質問での深掘り済み回数 */
  followUpCount: number
  /** 主質問の総数 */
  totalQuestions: number
  /** 面接開始からの経過秒 */
  elapsedSec: number
  /** 面接の想定所要（分） */
  durationMin: number
  /** 呼び出し元の意図: 深掘りしたい / 次へ進みたい */
  intent: 'follow_up' | 'next'
  /** 質問文の取得 */
  questions: Array<{ ord: number; text: string }>
}

/**
 * 次に何をするかを決める。
 * - 残り時間が尽きたら、未消化の質問があっても締めに入る（F1-7）
 * - 深掘りは MAX_FOLLOW_UPS まで
 */
export function advance(input: AdvanceInput): AdvanceResult {
  const { currentIndex, followUpCount, totalQuestions, elapsedSec, durationMin, intent, questions } = input

  const limitSec = durationMin * 60
  // 締めの挨拶ぶんを残す
  const closingReserveSec = 45
  const outOfTime = elapsedSec >= limitSec - closingReserveSec

  const remainingCount = Math.max(0, totalQuestions - currentIndex - 1)

  if (outOfTime) {
    return {
      action: 'close',
      questionOrd: null,
      questionText: null,
      followUpCount,
      remainingCount,
      shouldClose: true,
    }
  }

  if (intent === 'follow_up' && followUpCount < MAX_FOLLOW_UPS) {
    return {
      action: 'follow_up',
      questionOrd: currentIndex,
      questionText: questions.find((q) => q.ord === currentIndex)?.text ?? null,
      followUpCount: followUpCount + 1,
      remainingCount,
      shouldClose: false,
    }
  }

  // 次の主質問へ
  const nextIndex = currentIndex + 1
  if (nextIndex >= totalQuestions) {
    return {
      action: 'close',
      questionOrd: null,
      questionText: null,
      followUpCount: 0,
      remainingCount: 0,
      shouldClose: true,
    }
  }

  return {
    action: 'next_question',
    questionOrd: nextIndex,
    questionText: questions.find((q) => q.ord === nextIndex)?.text ?? null,
    followUpCount: 0,
    remainingCount: Math.max(0, totalQuestions - nextIndex - 1),
    shouldClose: false,
  }
}

export interface InstructionInput {
  companyName?: string | null
  jobTitle: string
  levelLabel: string
  durationMin: number
  intro?: string | null
  closing?: string | null
  questions: Array<{ ord: number; text: string; followUpHint?: string | null }>
  candidateName?: string | null
}

/**
 * Realtime API に渡す面接官の指示文。
 * 進行判断そのものはサーバ（advance）が持ち、モデルには「話し方」と「いつ関数を呼ぶか」を教える。
 */
export function buildInterviewerInstructions(input: InstructionInput): string {
  const { companyName, jobTitle, levelLabel, durationMin, intro, closing, questions, candidateName } = input

  return [
    `あなたは${companyName ? `「${companyName}」の` : ''}採用面接を担当するAI面接官です。`,
    `募集職種は「${jobTitle}」（${levelLabel}）、面接時間は約${durationMin}分です。`,
    candidateName ? `応募者のお名前は${candidateName}さんです。` : '',
    '',
    '【話し方】',
    '- 日本語。丁寧な敬語。落ち着いた自然な速度で話す。',
    '- 一度に話すのは2〜3文まで。長い説明を続けない。',
    '- 応募者が話し始めたら、直ちに自分の発話をやめて聞くこと。',
    '',
    '【繰り返しの禁止（重要）】',
    '- **同じ質問を3回以上尋ねてはいけない。繰り返しは最大2回まで。**',
    '  2回尋ねても答えが得られない場合は、それ以上粘らず advance_interview を intent="next" で呼んで次に進む。',
    '- 物音・雑音・第三者の声などで発話が中断された場合、**最初から言い直さない**。',
    '  中断された続きから話す。相手が「聞こえなかった」と明示的に言った場合のみ、言い換えて1回だけ繰り返す。',
    '- 直前に自分が言ったことと同じ内容を、言い方を変えただけで再度言わない。',
    '- 相手が答え終わったのに次に進めていないと感じたら、黙って待たずに advance_interview を呼ぶ。',
    '- 相手の回答を受けて短く受け止めてから、次の発言に移る（「ありがとうございます」等）。',
    '- 応募者を評価する言葉（良い/悪い、素晴らしい等の評価表明）は面接中には言わない。',
    '',
    '【絶対に守ること】',
    '- あなたはAIです。応募者に問われたら必ずAIであると答え、人間のふりをしない。',
    '- 合否や評価結果をその場で伝えない。「結果は追ってご担当者からご連絡します」と答える。',
    '- 下記の主質問は、表現を変えずに必ず全員に同じ内容で尋ねる（構造化面接）。',
    '',
    GUARDRAIL_PROMPT,
    '',
    '【進行の手順】',
    '1. 冒頭で挨拶し、AIが面接を行うこと・録音されることを伝え、進め方を説明する。',
    intro ? `   冒頭の文面の趣旨: ${intro}` : '',
    '2. 主質問を1問ずつ尋ねる。',
    '3. 回答が抽象的・具体性に欠ける場合は、深掘りの質問をする。',
    '4. 応募者の回答が一区切りついたら、必ず `advance_interview` 関数を呼ぶこと。',
    '   - もっと深掘りしたい場合は intent="follow_up"',
    '   - 次の主質問に移ってよい場合は intent="next"',
    '   関数の戻り値が次に尋ねるべき質問を返すので、それに従うこと。',
    '   戻り値の action が "close" の場合は、締めの挨拶をして面接を終える。',
    '5. 応募者が10秒以上黙っている場合は、質問を言い換えて助け舟を出す。それでも反応が無ければ advance_interview を intent="next" で呼ぶ。',
    '',
    closing ? `【締めの文面の趣旨】${closing}` : '',
    '',
    '【主質問リスト】',
    questions
      .map((q) => `${q.ord + 1}. ${q.text}${q.followUpHint ? `\n   （深掘り方針: ${q.followUpHint}）` : ''}`)
      .join('\n'),
  ]
    .filter(Boolean)
    .join('\n')
}

/** Realtime に登録する function tool の定義 */
export const ADVANCE_TOOL = {
  type: 'function' as const,
  name: 'advance_interview',
  description:
    '応募者の回答が一区切りついたら必ず呼ぶ。深掘りするか次の主質問へ進むかをサーバが判断し、次に尋ねる質問を返す。',
  parameters: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ['follow_up', 'next'],
        description: 'follow_up=もっと深掘りしたい / next=次の主質問へ進みたい',
      },
      answer_summary: {
        type: 'string',
        description: '直前の応募者の回答の要約（1〜2文）',
      },
    },
    required: ['intent'],
  },
}
