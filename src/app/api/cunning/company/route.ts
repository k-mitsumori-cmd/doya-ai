export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'

// GET /api/cunning/company — 解析済み企業プロファイル一覧
export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const { searchParams } = new URL(req?.url || 'http://localhost/api/cunning/company')
  const cursor = searchParams.get('cursor')
  if (searchParams.has('cursor') && (!cursor || cursor.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
  }
  const where = { userId }
  if (cursor && !await prisma.cunningCompanyProfile.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
  }
  const [rows, total] = await Promise.all([prisma.cunningCompanyProfile.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    select: { id: true, url: true, companyName: true, businessSummary: true, updatedAt: true },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  }), prisma.cunningCompanyProfile.count({ where })])
  const profiles = rows.slice(0, 50)
  return NextResponse.json({ profiles, total, nextCursor: rows.length > 50 ? profiles[49].id : null }, { headers: { 'Cache-Control': 'private, no-store' } })
}
