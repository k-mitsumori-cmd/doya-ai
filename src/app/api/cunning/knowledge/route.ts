export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { getCunningLimits } from '@/lib/cunning/limits'

// GET /api/cunning/knowledge — ナレッジベース一覧
export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const bases = await prisma.cunningKnowledgeBase.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
      _count: { select: { chunks: true } },
    },
  })
  return NextResponse.json({ bases }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/cunning/knowledge — ナレッジベース作成
export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  const limits = await getCunningLimits(userId)
  if (limits.maxKnowledgeBases !== -1) {
    const count = await prisma.cunningKnowledgeBase.count({ where: { userId } })
    if (count >= limits.maxKnowledgeBases) {
      return NextResponse.json(
        { error: `ナレッジベースは${limits.maxKnowledgeBases}個までです。プロにアップグレードしてください。` },
        { status: 403 }
      )
    }
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: '入力内容を確認してください' }, { status: 400 })
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: '名前を入力してください' }, { status: 400 })
  if (body.description != null && typeof body.description !== 'string') {
    return NextResponse.json({ error: '説明の形式が正しくありません' }, { status: 400 })
  }

  const base = await prisma.cunningKnowledgeBase.create({
    data: { userId, name: name.slice(0, 120), description: typeof body.description === 'string' ? body.description.slice(0, 500) || null : null },
  })
  return NextResponse.json({ base })
}
