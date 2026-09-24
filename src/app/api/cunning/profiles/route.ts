export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'

// GET /api/cunning/profiles — 応募者プロフィール一覧
export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const { searchParams } = new URL(req?.url || 'http://localhost/api/cunning/profiles')
  const cursor = searchParams.get('cursor')
  if (searchParams.has('cursor') && (!cursor || cursor.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
  }
  const where = { userId }
  if (cursor && !await prisma.cunningApplicantProfile.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
  }
  const [rows, total] = await Promise.all([prisma.cunningApplicantProfile.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  }), prisma.cunningApplicantProfile.count({ where })])
  const profiles = rows.slice(0, 50)
  return NextResponse.json({ profiles, total, nextCursor: rows.length > 50 ? profiles[49].id : null }, { headers: { 'Cache-Control': 'private, no-store' } })
}

// POST /api/cunning/profiles — 応募者プロフィール作成/更新
// body: { id?, name, resume?, motivation? }
export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || (body.id != null && typeof body.id !== 'string')
    || (body.name != null && typeof body.name !== 'string')
    || (body.resume != null && typeof body.resume !== 'string')
    || (body.motivation != null && typeof body.motivation !== 'string')) {
    return NextResponse.json({ error: 'プロフィールの入力形式を確認してください' }, { status: 400 })
  }
  const name = typeof body.name === 'string' ? body.name.trim() || 'マイプロフィール' : 'マイプロフィール'
  const data = {
    name: name.slice(0, 120),
    resume: typeof body.resume === 'string' ? body.resume.slice(0, 8000) || null : null,
    motivation: typeof body.motivation === 'string' ? body.motivation.slice(0, 4000) || null : null,
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
