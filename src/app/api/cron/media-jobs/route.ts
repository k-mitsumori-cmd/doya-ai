export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { prisma } from '@/lib/prisma'
import { dispatchMediaJob, isWorkerDispatchConfigured } from '@/lib/media-jobs/dispatch'
import { retryDelayMinutes, type MediaJobOutput } from '@/lib/media-jobs/kinds'
import { mediaStorageAdmin } from '@/lib/media-jobs/status'
import { postPlainToSlack } from '@/lib/notifications'

// 5分おきに次の4つをする（Authorization: Bearer CRON_SECRET で保護）
//  1. 止まったジョブ（running のまま心拍が5分以上ない）を、順番待ちに戻す。回数を使い切っていたら失敗にする
//  2. 順番待ちで、起動していない／起動から2分たっても動かないジョブを、Cloud Run で起動し直す
//  3. 失敗したジョブと、長く順番待ちのままのジョブを Slack に知らせる（失敗は1件につき1回だけ）
//  4. 終わってから30日たったジョブの出力ファイルと記録を消す
const STALE_MINUTES = 5
const REDISPATCH_MINUTES = 2
const BATCH = 20
const STUCK_QUEUE_MINUTES = 30

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 機能の旗が立っていない間は何もしない（本番に media_job の表を作る前でも、cron が失敗しないようにする）
  if (process.env.MEDIA_JOBS_ENABLED !== '1') {
    return Response.json({ ok: true, skipped: 'disabled' })
  }
  // 表や列がまだ無い（DB に反映前）ときも、何もせず正常終了する。それ以外の DB の失敗は 500 にする
  try {
    await prisma.mediaJob.findFirst({ select: { id: true, failureNotifiedAt: true } })
  } catch (e) {
    const code = (e as { code?: string } | null)?.code
    if (code === 'P2021' || code === 'P2022') {
      return Response.json({ ok: true, skipped: 'table_missing' })
    }
    console.error('[media-jobs-cron] db check failed')
    return Response.json({ ok: false, error: 'db_unavailable' }, { status: 500 })
  }

  const now = new Date()
  const staleBefore = new Date(now.getTime() - STALE_MINUTES * 60_000)

  // 1. 止まったジョブ
  const stale = await prisma.mediaJob.findMany({
    where: { status: 'running', OR: [{ heartbeatAt: { lt: staleBefore } }, { heartbeatAt: null, startedAt: { lt: staleBefore } }] },
    take: BATCH,
  })
  let requeued = 0
  let failed = 0
  for (const j of stale) {
    if (j.attempts >= j.maxAttempts) {
      const r = await prisma.mediaJob.updateMany({
        where: { id: j.id, status: 'running', lockedBy: j.lockedBy },
        data: { status: 'failed', error: '処理が途中で止まり、再試行の回数を使い切りました', finishedAt: now, lockedBy: null },
      })
      failed += r.count
    } else {
      const r = await prisma.mediaJob.updateMany({
        where: { id: j.id, status: 'running', lockedBy: j.lockedBy },
        data: {
          status: 'queued',
          lockedBy: null,
          runAfter: new Date(now.getTime() + retryDelayMinutes(j.attempts) * 60_000),
          error: '処理が途中で止まったため、やり直します',
        },
      })
      requeued += r.count
    }
  }

  // 2. 起動し直し
  let dispatched = 0
  let dispatchErrors = 0
  if (isWorkerDispatchConfigured()) {
    const redispatchBefore = new Date(now.getTime() - REDISPATCH_MINUTES * 60_000)
    const due = await prisma.mediaJob.findMany({
      where: {
        status: 'queued',
        runAfter: { lte: now },
        OR: [{ dispatchedAt: null }, { dispatchedAt: { lt: redispatchBefore } }],
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    })
    for (const j of due) {
      try {
        await dispatchMediaJob(j.id)
        await prisma.mediaJob.update({ where: { id: j.id }, data: { dispatchedAt: new Date() } })
        dispatched++
      } catch {
        dispatchErrors++
      }
    }
  }

  // 3. Slack 通知
  let notified = 0
  try {
    const failedJobs = await prisma.mediaJob.findMany({
      where: { status: 'failed', failureNotifiedAt: null },
      orderBy: { finishedAt: 'asc' },
      take: 20,
      select: { id: true, kind: true, attempts: true, error: true, source: true },
    })
    const stuckBefore = new Date(now.getTime() - STUCK_QUEUE_MINUTES * 60_000)
    const stuck = await prisma.mediaJob.count({ where: { status: 'queued', createdAt: { lt: stuckBefore }, runAfter: { lt: stuckBefore } } })
    if (failedJobs.length > 0 || stuck > 0) {
      const lines = failedJobs.map(
        (j) => `・${j.kind}（${j.attempts}回試行）${j.source ? ` ${j.source.slice(0, 60)}` : ''} id=${j.id}\n　${(j.error || '').replace(/\s+/g, ' ').slice(0, 140)}`
      )
      const text = [
        '【メディアワーカー】' + (failedJobs.length ? `ジョブが ${failedJobs.length} 件失敗しました` : '順番待ちのジョブが動いていません'),
        ...lines,
        stuck > 0 ? `${STUCK_QUEUE_MINUTES}分以上、順番待ちのままのジョブが ${stuck} 件あります。Cloud Run の起動設定を確認してください。` : '',
        '詳細は管理画面の「メディアジョブ」で確認できます。',
      ].filter(Boolean).join('\n')
      await postPlainToSlack(text)
      if (failedJobs.length > 0) {
        await prisma.mediaJob.updateMany({ where: { id: { in: failedJobs.map((j) => j.id) } }, data: { failureNotifiedAt: new Date() } })
      }
      notified = failedJobs.length
    }
  } catch {
    // 通知に失敗したら、通知済みにせず次回にもう一度送る
    console.warn('[media-jobs-cron] slack notification failed')
  }

  // 4. 古い出力ファイルと記録の削除。ファイルを消せなかった記録は残し、次回にやり直す
  const oldJobs = await prisma.mediaJob.findMany({
    where: { status: { in: ['succeeded', 'failed', 'canceled'] }, finishedAt: { lt: new Date(now.getTime() - 30 * 86400_000) } },
    select: { id: true, outputs: true },
    take: 100,
  })
  const storage = mediaStorageAdmin()
  const deletable: string[] = []
  for (const j of oldJobs) {
    const outs = Array.isArray(j.outputs) ? (j.outputs as unknown as MediaJobOutput[]) : []
    if (outs.length === 0) { deletable.push(j.id); continue }
    if (!storage) continue
    let ok = true
    for (const o of outs) {
      const { error } = await storage.storage.from(o.bucket).remove([o.path])
      if (error) ok = false
    }
    if (ok) deletable.push(j.id)
  }
  const old = await prisma.mediaJob.deleteMany({ where: { id: { in: deletable } } })

  const body = { ok: dispatchErrors === 0, requeued, failed, dispatched, dispatchErrors, notified, deleted: old.count }
  console.warn('[media-jobs-cron]', body)
  return Response.json(body, { status: dispatchErrors ? 503 : 200 })
}
