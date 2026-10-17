// PUT /api/shanai/interviews/[id]/survey — 担当者がアンケート回答を代わりに入力・保存
// POST 同上 { action: 'submit' } — 回答を確定（文字数が足りなければ 400）
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShanaiUserId, json, notFound, ownInterview, unauthorized } from '@/lib/shanai/access'
import { saveSurveyAnswers, submitSurvey } from '@/lib/shanai/survey-service'
import { interviewDetailDto } from '@/lib/shanai/dto'
import { isCuid } from '@/lib/shanai/types'

type Ctx = { params: Promise<{ id: string }> }

async function own(userId: string, id: string) {
  if (!isCuid(id)) return null
  return prisma.shanaiInterview.findFirst({ where: ownInterview(userId, id), select: { id: true, mode: true } })
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    const row = await own(userId, id)
    if (!row) return notFound()
    if (row.mode !== 'survey') return json({ error: 'このインタビューは録音で作成しています。' }, 400)
    const body = await req.json().catch(() => ({}))
    const saved = await saveSurveyAnswers(id, body.answers)
    return json({ success: true, ...saved })
  } catch (e) {
    console.error('[shanai/survey][PUT] failed', (e as Error)?.name)
    return json({ error: '回答の保存に失敗しました。' }, 500)
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    const row = await own(userId, id)
    if (!row) return notFound()
    const body = await req.json().catch(() => ({}))
    if (body.answers) await saveSurveyAnswers(id, body.answers)
    const result = await submitSurvey(id)
    if (!result.ok) return json({ error: result.error, missing: result.missing }, 400)
    return json({ success: true, interview: await interviewDetailDto(id, userId) })
  } catch (e) {
    console.error('[shanai/survey][POST] failed', (e as Error)?.name)
    return json({ error: '回答の確定に失敗しました。' }, 500)
  }
}
