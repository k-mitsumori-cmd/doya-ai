export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'

// GET /api/cunning/company — 解析済み企業プロファイル一覧
export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const profiles = await prisma.cunningCompanyProfile.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, url: true, companyName: true, businessSummary: true, updatedAt: true },
    take: 50,
  })
  return NextResponse.json({ profiles }, { headers: { 'Cache-Control': 'no-store' } })
}
