export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'

// GET /api/cunning/profiles — 応募者プロフィール一覧
export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const profiles = await prisma.cunningApplicantProfile.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ profiles }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/cunning/profiles — 応募者プロフィール作成/更新
// body: { id?, name, resume?, motivation? }
export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const name = (body.name as string)?.trim() || 'マイプロフィール'
  const data = {
    name: name.slice(0, 120),
    resume: (body.resume as string)?.slice(0, 8000) || null,
    motivation: (body.motivation as string)?.slice(0, 4000) || null,
  }

  if (body.id) {
    const existing = await prisma.cunningApplicantProfile.findUnique({
      where: { id: body.id },
      select: { userId: true },
    })
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    }
    const profile = await prisma.cunningApplicantProfile.update({ where: { id: body.id }, data })
    return NextResponse.json({ profile })
  }

  const profile = await prisma.cunningApplicantProfile.create({ data: { userId, ...data } })
  return NextResponse.json({ profile })
}
