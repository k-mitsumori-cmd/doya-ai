// POST /api/shanai/interviews/[id]/followups — 回答が短い設問への追加質問をAIで作る（担当者用）
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShanaiUserId, json, notFound, ownInterview, unauthorized } from '@/lib/shanai/access'
import { addFollowups, saveSurveyAnswers } from '@/lib/shanai/survey-service'
import { checkSurvey } from '@/lib/shanai/survey'
import { isCuid } from '@/lib/shanai/types'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    if (!isCuid(id)) return notFound()
    const row = await prisma.shanaiInterview.findFirst({ where: ownInterview(userId, id), select: { id: true, mode: true } })
    if (!row) return notFound()
    if (row.mode !== 'survey') return json({ error: 'このインタビューは録音で作成しています。' }, 400)
    const body = await req.json().catch(() => ({}))
    if (body.answers) await saveSurveyAnswers(id, body.answers)
    const result = await addFollowups(id)
    if (!result.ok) return json({ error: result.error }, 429)
    return json({ success: true, answers: result.answers, added: result.added, check: checkSurvey(result.answers) })
  } catch (e) {
    console.error('[shanai/followups] failed', (e as Error)?.name)
    return json({ error: '追加質問の作成に失敗しました。' }, 500)
  }
}
