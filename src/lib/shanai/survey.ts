// ============================================
// ドヤ社内インタビュー アンケート設問
// ============================================
// ⚠️ アンケートから記事を作るには、具体的な文章量が要る。少ない回答のまま書かせると
//    AIが空白を想像で埋めてしまうため、設問ごとに最低文字数を置き、満たすまで提出できない。

import type { SurveyAnswers } from './types'

export interface SurveyQuestion {
  id: string
  section: string
  question: string
  hint: string
  minChars: number
  required: boolean
}

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  { id: 'career', section: 'これまで', question: '入社前はどのようなお仕事や経験をされていましたか。', hint: '前職の業界・職種、学生時代に打ち込んだことなど', minChars: 80, required: true },
  { id: 'reason', section: 'これまで', question: '当社に入社を決めた理由・きっかけを教えてください。', hint: '比較した会社、決め手になった出来事や人', minChars: 100, required: true },
  { id: 'gap', section: 'これまで', question: '入社前のイメージと、入社後に感じた違いはありましたか。', hint: '良い意味で驚いたこと、想像と違ったこと', minChars: 60, required: false },
  { id: 'work', section: 'いまの仕事', question: '現在の仕事内容を、知らない人にもわかるように説明してください。', hint: '1日の流れ、関わる人、使っている道具やサービス', minChars: 120, required: true },
  { id: 'service', section: 'いまの仕事', question: 'あなたの仕事は、当社のサービスやお客様とどうつながっていますか。', hint: '担当しているサービス、お客様への影響', minChars: 80, required: true },
  { id: 'episode', section: 'いまの仕事', question: 'これまでで一番印象に残っている仕事のエピソードを教えてください。', hint: 'いつ・何が起きて・どう動いて・どうなったか', minChars: 150, required: true },
  { id: 'hard', section: 'いまの仕事', question: '大変だったこと、壁にぶつかったことと、その乗り越え方を教えてください。', hint: '具体的な場面と、そのとき誰に助けられたか', minChars: 100, required: true },
  { id: 'joy', section: 'いまの仕事', question: '仕事のやりがいや、うれしかった瞬間はどんなときですか。', hint: 'お客様や同僚からの言葉など', minChars: 80, required: true },
  { id: 'value', section: '大切にしていること', question: '仕事をするうえで大切にしている考え方やこだわりは何ですか。', hint: 'そう考えるようになった理由も添えて', minChars: 80, required: true },
  { id: 'team', section: '職場', question: 'チームや職場の雰囲気を、具体的な場面を交えて教えてください。', hint: '会議の様子、相談のしやすさ、印象的な同僚', minChars: 100, required: true },
  { id: 'culture', section: '職場', question: '当社らしいと感じる文化・制度・習慣はありますか。', hint: '実際に使った制度、社内イベント、独自のルール', minChars: 60, required: false },
  { id: 'growth', section: '職場', question: '入社してから成長したと感じる点を教えてください。', hint: 'できるようになったこと、任されるようになったこと', minChars: 80, required: true },
  { id: 'future', section: 'これから', question: 'これから挑戦したいこと、目標を教えてください。', hint: '1年後・数年後に実現したいこと', minChars: 80, required: true },
  { id: 'message', section: 'これから', question: 'この記事を読む方（入社を考えている方など）へメッセージをお願いします。', hint: 'どんな人と一緒に働きたいか', minChars: 60, required: true },
  { id: 'offtime', section: 'あなたについて', question: '休日の過ごし方や、最近ハマっていることを教えてください。', hint: '人柄が伝わる内容なら何でも', minChars: 40, required: false },
]

/** 追加質問の対象にする設問（エピソード系）。回答が最低文字数ぎりぎりのときに深掘りする */
const FOLLOWUP_TARGETS = new Set(['reason', 'episode', 'hard', 'joy', 'team', 'work'])

export function findQuestion(id: string): SurveyQuestion | undefined {
  return SURVEY_QUESTIONS.find((q) => q.id === id)
}

export function countChars(text: string | undefined | null): number {
  return [...String(text || '').replace(/\s+/g, '')].length
}

export interface SurveyCheck {
  /** 0〜100 */
  score: number
  /** 文字数が足りない必須設問 */
  missing: { id: string; question: string; have: number; need: number }[]
  canSubmit: boolean
}

export function checkSurvey(answers: SurveyAnswers | null | undefined): SurveyCheck {
  const a = answers || {}
  const missing: SurveyCheck['missing'] = []
  let got = 0
  let total = 0
  for (const q of SURVEY_QUESTIONS) {
    const have = countChars(a[q.id]?.answer) + countChars(a[q.id]?.followupAnswer)
    total += q.minChars
    got += Math.min(have, q.minChars)
    if (q.required && have < q.minChars) missing.push({ id: q.id, question: q.question, have, need: q.minChars })
  }
  const score = total ? Math.round((got / total) * 100) : 0
  return { score, missing, canSubmit: missing.length === 0 }
}

/** 深掘りが必要な設問（最低文字数の1.5倍未満で、まだ追加質問が無いもの） */
export function followupCandidates(answers: SurveyAnswers): string[] {
  return SURVEY_QUESTIONS.filter((q) => {
    if (!FOLLOWUP_TARGETS.has(q.id)) return false
    const a = answers[q.id]
    if (!a?.answer || a.followupQuestion) return false
    return countChars(a.answer) < q.minChars * 1.5
  })
    .map((q) => q.id)
    .slice(0, 3)
}

/** 利用者から届いた回答を、既知の設問・長さに絞って正規化する */
export function sanitizeAnswers(raw: unknown, previous?: SurveyAnswers | null): SurveyAnswers {
  const out: SurveyAnswers = {}
  const src = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {}
  for (const q of SURVEY_QUESTIONS) {
    const v = src[q.id]
    const prev = previous?.[q.id]
    const answer = String(v?.answer ?? prev?.answer ?? '').slice(0, 3000)
    const followupAnswer = String(v?.followupAnswer ?? prev?.followupAnswer ?? '').slice(0, 2000)
    // 追加質問の文面はサーバーで作ったものだけを残す（利用者の書き換えを受け付けない）
    const followupQuestion = prev?.followupQuestion
    if (!answer && !followupAnswer && !followupQuestion) continue
    out[q.id] = { answer, ...(followupQuestion ? { followupQuestion } : {}), ...(followupAnswer ? { followupAnswer } : {}) }
  }
  return out
}
