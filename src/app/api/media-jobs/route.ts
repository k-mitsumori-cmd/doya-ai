export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toMediaJobView } from '@/lib/media-jobs/status'

// 自分のジョブの一覧。?source=interview:material:xxx で呼び出し元ごとに絞れる
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  const source = req.nextUrl.searchParams.get('source')?.slice(0, 200)
  const jobs = await prisma.mediaJob.findMany({
    where: { userId, ...(source ? { source } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  // 一覧では署名URLを作らない（詳細で取得する）
  const views = await Promise.all(jobs.map((j) => toMediaJobView(j, { withUrls: false })))
  return NextResponse.json({ jobs: views })
}
