// GET/PUT/DELETE /api/shanai/interviews/[id] — インタビュー詳細・基本情報の更新・削除
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShanaiUserId, json, notFound, ownInterview, unauthorized } from '@/lib/shanai/access'
import { interviewDetailDto } from '@/lib/shanai/dto'
import { getInterviewDetail } from '@/lib/shanai/interviews-read'
import { removeFiles } from '@/lib/shanai/storage'
import { clip, isCuid, oneOf } from '@/lib/shanai/types'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    if (!isCuid(id)) return notFound()
    const interview = await getInterviewDetail(userId, id)
    if (!interview) return notFound()
    return json({ success: true, interview })
  } catch (e) {
    console.error('[shanai/interview][GET] failed', (e as Error)?.name)
    return json({ error: 'インタビューの取得に失敗しました。' }, 500)
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    if (!isCuid(id)) return notFound()
    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}
    if (body.intervieweeName !== undefined) {
      const name = clip(body.intervieweeName, 60)
      if (!name) return json({ error: '社員のお名前を入力してください。' }, 400)
      data.intervieweeName = name
    }
    if (body.department !== undefined) data.department = clip(body.department, 60)
    if (body.position !== undefined) data.position = clip(body.position, 60)
    if (body.joinYear !== undefined) data.joinYear = clip(body.joinYear, 30)
    if (body.purpose !== undefined) data.purpose = oneOf(body.purpose, ['recruit', 'internal'] as const, 'recruit')
    if (body.tone !== undefined) data.tone = oneOf(body.tone, ['friendly', 'formal', 'passionate'] as const, 'friendly')
    if (body.roleInService !== undefined) data.roleInService = clip(body.roleInService, 200)
    if (body.serviceSourceIds !== undefined) {
      const company = await prisma.shanaiCompany.findUnique({ where: { userId }, include: { sources: { select: { id: true } } } })
      const valid = new Set(company?.sources.map((s) => s.id) || [])
      data.serviceSourceIds = (Array.isArray(body.serviceSourceIds) ? body.serviceSourceIds : []).filter((x: unknown) => typeof x === 'string' && valid.has(x)).slice(0, 6)
    }
    const updated = await prisma.shanaiInterview.updateMany({ where: ownInterview(userId, id), data })
    if (updated.count === 0) return notFound()
    return json({ success: true, interview: await interviewDetailDto(id, userId) })
  } catch (e) {
    console.error('[shanai/interview][PUT] failed', (e as Error)?.name)
    return json({ error: '保存に失敗しました。' }, 500)
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    if (!isCuid(id)) return notFound()
    const row = await prisma.shanaiInterview.findFirst({ where: ownInterview(userId, id), include: { photos: { select: { storagePath: true } } } })
    if (!row) return notFound()
    await prisma.shanaiInterview.delete({ where: { id: row.id } })
    // 録音・写真は個人の情報なので、行と一緒にストレージからも消す
    await removeFiles([row.audioPath || '', ...row.photos.map((p) => p.storagePath)])
    return json({ success: true })
  } catch (e) {
    console.error('[shanai/interview][DELETE] failed', (e as Error)?.name)
    return json({ error: '削除に失敗しました。' }, 500)
  }
}
