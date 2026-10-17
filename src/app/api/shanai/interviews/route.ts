// GET/POST /api/shanai/interviews — インタビュー一覧・作成
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShanaiUserId, json, unauthorized } from '@/lib/shanai/access'
import { interviewSummaryDto } from '@/lib/shanai/dto'
import { clip, oneOf } from '@/lib/shanai/types'

/** 作成できるインタビューの件数（記事生成・文字起こしの枠とは別に、行の作りすぎを防ぐ） */
const MAX_INTERVIEWS = 500

export async function GET() {
  try {
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    const rows = await prisma.shanaiInterview.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        articles: { orderBy: { version: 'desc' }, take: 1, select: { id: true, title: true, version: true }, where: { NOT: { title: '生成中' } } },
        photos: { select: { id: true } },
      },
    })
    return json({ success: true, interviews: rows.map(interviewSummaryDto) })
  } catch (e) {
    console.error('[shanai/interviews][GET] failed', (e as Error)?.name)
    return json({ error: 'インタビューの取得に失敗しました。' }, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getShanaiUserId()
    if (!userId) return unauthorized()
    const body = await req.json().catch(() => ({}))
    const intervieweeName = clip(body.intervieweeName, 60)
    if (!intervieweeName) return json({ error: '社員のお名前を入力してください。' }, 400)
    const count = await prisma.shanaiInterview.count({ where: { userId } })
    if (count >= MAX_INTERVIEWS) return json({ error: 'インタビューの件数が上限に達しました。不要なものを削除してください。' }, 400)

    const company = await prisma.shanaiCompany.findUnique({ where: { userId }, include: { sources: { select: { id: true } } } })
    const validSources = new Set(company?.sources.map((s) => s.id) || [])
    const serviceSourceIds = (Array.isArray(body.serviceSourceIds) ? body.serviceSourceIds : []).filter((id: unknown) => typeof id === 'string' && validSources.has(id)).slice(0, 6)

    const row = await prisma.shanaiInterview.create({
      data: {
        userId,
        mode: oneOf(body.mode, ['voice', 'survey'] as const, 'voice'),
        intervieweeName,
        department: clip(body.department, 60),
        position: clip(body.position, 60),
        joinYear: clip(body.joinYear, 30),
        purpose: oneOf(body.purpose, ['recruit', 'internal'] as const, 'recruit'),
        tone: oneOf(body.tone, ['friendly', 'formal', 'passionate'] as const, 'friendly'),
        serviceSourceIds,
        roleInService: clip(body.roleInService, 200),
        status: 'COLLECTING',
      },
      select: { id: true },
    })
    return json({ success: true, id: row.id })
  } catch (e) {
    console.error('[shanai/interviews][POST] failed', (e as Error)?.name)
    return json({ error: 'インタビューの作成に失敗しました。' }, 500)
  }
}
