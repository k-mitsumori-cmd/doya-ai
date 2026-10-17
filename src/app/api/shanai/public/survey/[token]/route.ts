// 社員が開く公開アンケート（ログイン不要。URLのトークンで開く）
// GET  — 設問・保存済みの回答
// PUT  { answers } — 下書き保存
// POST { action: 'followups' | 'submit', answers? } — 追加質問の作成／回答の提出
// ⚠️ 返すのは本人の名前・会社名・設問・回答だけ。担当者の情報や他の社員の情報は返さない。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SURVEY_QUESTIONS, checkSurvey } from '@/lib/shanai/survey'
import { addFollowups, saveSurveyAnswers, submitSurvey } from '@/lib/shanai/survey-service'
import type { SurveyAnswers } from '@/lib/shanai/types'
import { isSurveyToken } from '@/lib/shanai/token'

type Ctx = { params: Promise<{ token: string }> }

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: HEADERS })

async function findByToken(token: string) {
  if (!isSurveyToken(token)) return null
  return prisma.shanaiInterview.findUnique({
    where: { surveyToken: token },
    select: { id: true, userId: true, mode: true, intervieweeName: true, surveyAnswers: true, surveySubmittedAt: true, followupRuns: true },
  })
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { token } = await ctx.params
    const row = await findByToken(token)
    if (!row || row.mode !== 'survey') return reply({ error: 'このアンケートは見つかりません。URLをご確認ください。' }, 404)
    const company = await prisma.shanaiCompany.findUnique({ where: { userId: row.userId }, select: { name: true, brandColor: true } })
    // ⚠️ 提出後は回答を返さない（URL が転送・漏えいしても、提出済みの内容は読めない）
    const answers = row.surveySubmittedAt ? {} : (row.surveyAnswers as unknown as SurveyAnswers) || {}
    return reply({
      success: true,
      intervieweeName: row.intervieweeName,
      companyName: company?.name || '',
      brandColor: company?.brandColor || '',
      questions: SURVEY_QUESTIONS,
      answers,
      check: checkSurvey(row.surveySubmittedAt ? (row.surveyAnswers as unknown as SurveyAnswers) || {} : answers),
      submittedAt: row.surveySubmittedAt?.toISOString() ?? null,
      canAskFollowups: row.followupRuns < 3,
    })
  } catch (e) {
    console.error('[shanai/public/survey][GET] failed', (e as Error)?.name)
    return reply({ error: '読み込みに失敗しました。時間をおいてもう一度お試しください。' }, 500)
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { token } = await ctx.params
    const row = await findByToken(token)
    if (!row || row.mode !== 'survey') return reply({ error: 'このアンケートは見つかりません。' }, 404)
    if (row.surveySubmittedAt) return reply({ error: '回答はすでに提出されています。修正が必要な場合は担当者にご連絡ください。' }, 409)
    const body = await req.json().catch(() => ({}))
    const saved = await saveSurveyAnswers(row.id, body.answers)
    return reply({ success: true, ...saved })
  } catch (e) {
    console.error('[shanai/public/survey][PUT] failed', (e as Error)?.name)
    return reply({ error: '保存に失敗しました。時間をおいてもう一度お試しください。' }, 500)
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { token } = await ctx.params
    const row = await findByToken(token)
    if (!row || row.mode !== 'survey') return reply({ error: 'このアンケートは見つかりません。' }, 404)
    if (row.surveySubmittedAt) return reply({ error: '回答はすでに提出されています。' }, 409)
    const body = await req.json().catch(() => ({}))
    if (body.answers) await saveSurveyAnswers(row.id, body.answers)

    if (body.action === 'followups') {
      const result = await addFollowups(row.id)
      if (!result.ok) return reply({ error: result.error }, 429)
      return reply({ success: true, answers: result.answers, added: result.added, check: checkSurvey(result.answers) })
    }
    const result = await submitSurvey(row.id)
    if (!result.ok) return reply({ error: result.error, missing: result.missing }, 400)
    return reply({ success: true, submitted: true })
  } catch (e) {
    console.error('[shanai/public/survey][POST] failed', (e as Error)?.name)
    return reply({ error: '送信に失敗しました。時間をおいてもう一度お試しください。' }, 500)
  }
}
