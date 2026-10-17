// ============================================
// ドヤ社内インタビュー アンケートの保存・追加質問・提出
// ============================================
// 担当者の画面（ログイン）と、社員が開く公開画面（トークン）の両方から使う。
import { prisma } from '@/lib/prisma'
import { checkSurvey, sanitizeAnswers } from './survey'
import { generateFollowups } from './generate'
import type { SurveyAnswers } from './types'

/** 追加質問を作れる回数（1インタビューあたり。AI費用の乱用防止） */
export const MAX_FOLLOWUP_RUNS = 3

export async function saveSurveyAnswers(interviewId: string, raw: unknown) {
  const row = await prisma.shanaiInterview.findUnique({ where: { id: interviewId }, select: { surveyAnswers: true } })
  const answers = sanitizeAnswers(raw, (row?.surveyAnswers as unknown as SurveyAnswers) || null)
  await prisma.shanaiInterview.update({ where: { id: interviewId }, data: { surveyAnswers: answers as any } })
  return { answers, check: checkSurvey(answers) }
}

export async function addFollowups(interviewId: string): Promise<{ ok: true; answers: SurveyAnswers; added: number } | { ok: false; error: string }> {
  // 回数の確保を先に行う（同時押しで上限を超えない）
  const claimed = await prisma.shanaiInterview.updateMany({ where: { id: interviewId, followupRuns: { lt: MAX_FOLLOWUP_RUNS } }, data: { followupRuns: { increment: 1 } } })
  if (claimed.count === 0) return { ok: false, error: '追加質問はこれ以上作成できません。' }
  const row = await prisma.shanaiInterview.findUnique({ where: { id: interviewId }, select: { surveyAnswers: true, intervieweeName: true } })
  const answers = ((row?.surveyAnswers as unknown as SurveyAnswers) || {}) as SurveyAnswers
  const followups = await generateFollowups(answers, row?.intervieweeName || '')
  for (const [qid, question] of Object.entries(followups)) {
    if (answers[qid]) answers[qid] = { ...answers[qid], followupQuestion: question }
  }
  await prisma.shanaiInterview.update({ where: { id: interviewId }, data: { surveyAnswers: answers as any } })
  return { ok: true, answers, added: Object.keys(followups).length }
}

export async function submitSurvey(interviewId: string): Promise<{ ok: true } | { ok: false; error: string; missing: ReturnType<typeof checkSurvey>['missing'] }> {
  const row = await prisma.shanaiInterview.findUnique({ where: { id: interviewId }, select: { surveyAnswers: true } })
  const check = checkSurvey((row?.surveyAnswers as unknown as SurveyAnswers) || {})
  if (!check.canSubmit) return { ok: false, error: '文字数が足りない設問があります。具体的なエピソードを書き足してください。', missing: check.missing }
  await prisma.shanaiInterview.update({ where: { id: interviewId }, data: { surveySubmittedAt: new Date(), status: 'FACTS' } })
  return { ok: true }
}
