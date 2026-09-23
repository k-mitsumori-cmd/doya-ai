export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { decodeCunningCursor, encodeCunningCursor } from '@/lib/cunning/history-cursor'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { canStartSession } from '@/lib/cunning/limits'
import { parseCunningSessionInput } from '@/lib/cunning/session-input'
import { recordServiceUsage } from '@/lib/service-usage'

// GET /api/cunning/sessions — セッション一覧
export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const params = new URL(req?.url || 'http://localhost/api/cunning/sessions').searchParams
  let cursor: ReturnType<typeof decodeCunningCursor> | null = null
  try { if (params.has('cursor')) cursor = decodeCunningCursor(params.get('cursor')!) }
  catch { return NextResponse.json({ error: '続きの取得位置が不正です。画面を再読み込みしてください。' }, { status: 400 }) }
  const sessions = await prisma.cunningSession.findMany({
    where: { userId, status: { not: 'deleted' }, ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 51,
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
    { sessions: sessions.slice(0, 50), nextCursor: sessions.length > 50 ? encodeCunningCursor(sessions[49]) : null },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// POST /api/cunning/sessions — セッション作成
export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  const can = await canStartSession(userId)
  if (!can.ok) return NextResponse.json({ error: can.reason, code: can.code, ...(can.code === 'LIMIT' ? { upgradeUrl: '/cunning/pricing' } : {}) }, { status: 403 })

  let input: ReturnType<typeof parseCunningSessionInput>
  try { input = parseCunningSessionInput(await req.json()) }
  catch { return NextResponse.json({ error: '入力内容を確認してください。' }, { status: 400 }) }

  const references = await Promise.all([
    input.knowledgeBaseId ? prisma.cunningKnowledgeBase.findFirst({ where: { id: input.knowledgeBaseId, userId }, select: { id: true } }) : true,
    input.companyProfileId ? prisma.cunningCompanyProfile.findFirst({ where: { id: input.companyProfileId, userId }, select: { id: true } }) : true,
    input.applicantProfileId ? prisma.cunningApplicantProfile.findFirst({ where: { id: input.applicantProfileId, userId }, select: { id: true } }) : true,
  ])
  if (references.some(reference => !reference)) {
    return NextResponse.json({ error: '選択した資料が見つかりません。資料を選び直してください。' }, { status: 404 })
  }

  const session = await prisma.cunningSession.create({
    data: {
      userId,
      ...input,
    },
  })
  await recordServiceUsage({
    userId,
    serviceId: 'cunning',
    action: 'セッション開始',
    summary: input.title,
    input: { mode: input.mode },
  })

  return NextResponse.json({ session })
}
