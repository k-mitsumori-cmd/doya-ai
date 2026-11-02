export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/media-jobs — メディア処理ジョブの一覧（管理者のみ）
// ?status=failed&kind=process_all で絞れる。ファイルの保存先は返さない。
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { prisma } from '@/lib/prisma'
import { isMediaJobKind, MEDIA_JOB_STATUSES } from '@/lib/media-jobs/kinds'

export async function GET(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const sp = req.nextUrl.searchParams
  const status = sp.get('status')
  const kind = sp.get('kind')
  const where = {
    ...(status && (MEDIA_JOB_STATUSES as readonly string[]).includes(status) ? { status } : {}),
    ...(kind && isMediaJobKind(kind) ? { kind } : {}),
  }

  const [jobs, counts] = await Promise.all([
    prisma.mediaJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, kind: true, status: true, progress: true, stage: true, attempts: true, maxAttempts: true, error: true,
        source: true, createdAt: true, startedAt: true, finishedAt: true, runAfter: true, heartbeatAt: true, inputPath: true,
        user: { select: { email: true } },
      },
    }),
    prisma.mediaJob.groupBy({ by: ['status'], _count: { _all: true } }),
  ])

  return NextResponse.json({
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    jobs: jobs.map((j) => ({
      ...j,
      // 入力のパスは、ファイル名だけにして返す
      inputPath: j.inputPath.split('/').pop() || '',
      user: j.user?.email ?? '',
    })),
  })
}
