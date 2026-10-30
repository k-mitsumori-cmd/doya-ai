export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toMediaJobView } from '@/lib/media-jobs/status'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// ジョブ1件の進み具合と結果。完了していれば出力の署名URLを付ける
export async function GET(_req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  // id だけでなく userId も条件に入れ、他人のジョブは存在しないものとして扱う
  const job = await prisma.mediaJob.findFirst({ where: { id: p.id, userId } })
  if (!job) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  return NextResponse.json({ job: await toMediaJobView(job, { withUrls: true }) })
}

// 順番待ちのジョブの取り消し
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  const r = await prisma.mediaJob.updateMany({
    where: { id: p.id, userId, status: 'queued' },
    data: { status: 'canceled', finishedAt: new Date() },
  })
  if (r.count === 0) return NextResponse.json({ error: '取り消せるのは順番待ちのジョブだけです' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
