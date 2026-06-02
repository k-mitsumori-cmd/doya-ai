export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { canStartSession } from '@/lib/cunning/limits'

// GET /api/cunning/sessions — セッション一覧
export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const sessions = await prisma.cunningSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      mode: true,
      title: true,
      status: true,
      durationSec: true,
      createdAt: true,
      _count: { select: { answers: true } },
    },
  })
  return NextResponse.json(
    { sessions },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// POST /api/cunning/sessions — セッション作成
export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  const can = await canStartSession(userId)
  if (!can.ok) return NextResponse.json({ error: can.reason }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const mode = body.mode === 'interview' ? 'interview' : 'sales'
  const title = (body.title as string)?.trim() || (mode === 'interview' ? '面接セッション' : '商談セッション')

  const session = await prisma.cunningSession.create({
    data: {
      userId,
      mode,
      title,
      knowledgeBaseId: body.knowledgeBaseId || null,
      companyProfileId: body.companyProfileId || null,
      applicantProfileId: body.applicantProfileId || null,
    },
  })
  return NextResponse.json({ session })
}
