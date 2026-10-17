// POST /api/shanai/interviews/[id]/facts — 素材と会社プロフィールから事実を抽出（作り直し）
// PUT  { facts: [{ id, statement?, approved?, delete? }] } — 担当者の確認・修正
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { claimFactRun, getShanaiUserId, json, notFound, ownInterview, quotaExceeded, unauthorized } from '@/lib/shanai/access'
import { interviewDetailDto } from '@/lib/shanai/dto'
import { extractFacts } from '@/lib/shanai/generate'
import { checkSurvey } from '@/lib/shanai/survey'
import { clip, isCuid, type SurveyAnswers, type TranscriptSegmentDto } from '@/lib/shanai/types'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    if (!isCuid(id)) return notFound()
    const interview = await prisma.shanaiInterview.findFirst({ where: ownInterview(userId, id) })
    if (!interview) return notFound()

    const segments = (interview.transcriptSegments as unknown as TranscriptSegmentDto[]) || []
    const answers = (interview.surveyAnswers as unknown as SurveyAnswers) || {}
    if (interview.mode === 'voice' && segments.length === 0) return json({ error: '先に録音を文字起こししてください。' }, 400)
    if (interview.mode === 'survey' && !checkSurvey(answers).canSubmit) {
      return json({ error: 'アンケートの回答がまだ足りません。すべての必須設問が最低文字数に達してから抽出できます。' }, 400)
    }

    // ⚠️ 回数の確保は LLM 呼び出しの前
    const claim = await claimFactRun(userId, id)
    if (!claim.ok) return claim.quota ? quotaExceeded(claim.quota) : json({ error: claim.reason }, 429)

    const company = await prisma.shanaiCompany.findUnique({
      where: { userId },
      include: { profileItems: { where: { approved: true }, select: { id: true, category: true, statement: true, quote: true, sourceId: true } } },
    })

    const facts = await extractFacts({
      mode: interview.mode === 'survey' ? 'survey' : 'voice',
      intervieweeName: interview.intervieweeName,
      segments,
      answers,
      companyItems: company?.profileItems || [],
      serviceSourceIds: (interview.serviceSourceIds as unknown as string[]) || [],
    })
    if (facts.filter((f) => f.sourceType !== 'company').length === 0) {
      return json({ error: '記事にできる具体的な内容を見つけられませんでした。録音や回答の内容をご確認ください。' }, 422)
    }

    await prisma.$transaction([
      prisma.shanaiFact.deleteMany({ where: { interviewId: id } }),
      prisma.shanaiFact.createMany({ data: facts.map((f, i) => ({ interviewId: id, ...f, sortOrder: i })) }),
      prisma.shanaiInterview.update({ where: { id }, data: { status: 'WRITING' } }),
    ])
    return json({ success: true, interview: await interviewDetailDto(id, userId) })
  } catch (e) {
    console.error('[shanai/facts][POST] failed', (e as Error)?.name)
    return json({ error: '事実の抽出に失敗しました。時間をおいてもう一度お試しください。' }, 500)
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    if (!isCuid(id)) return notFound()
    const interview = await prisma.shanaiInterview.findFirst({ where: ownInterview(userId, id), select: { id: true } })
    if (!interview) return notFound()
    const body = await req.json().catch(() => ({}))
    const list: any[] = Array.isArray(body.facts) ? body.facts.slice(0, 200) : []
    await prisma.$transaction(async (tx) => {
      for (const f of list) {
        if (typeof f?.id !== 'string') continue
        // ⚠️ 原文（quote）は書き換えさせない。根拠の改ざんを防ぐ
        if (f.delete) {
          await tx.shanaiFact.deleteMany({ where: { id: f.id, interviewId: id } })
          continue
        }
        const statement = clip(f.statement, 300)
        await tx.shanaiFact.updateMany({
          where: { id: f.id, interviewId: id },
          data: { approved: f.approved !== false, ...(statement ? { statement } : {}) },
        })
      }
    })
    return json({ success: true, interview: await interviewDetailDto(id, userId) })
  } catch (e) {
    console.error('[shanai/facts][PUT] failed', (e as Error)?.name)
    return json({ error: '事実の保存に失敗しました。' }, 500)
  }
}
