// ============================================
// メディア処理ジョブを1件積む（アップロード完了のあとに呼ぶ）
// ============================================
// 使い方:
//   import { enqueueMediaJob } from '@/lib/media-jobs/enqueue'
//   const job = await enqueueMediaJob({
//     userId: session.user.id,
//     kind: 'process_all',   // 音声・720p・サムネイルを1回の読み込みでまとめて作る（おすすめ）
//     input: { bucket: 'interview-materials', path: `${userId}/xxxx/movie.mp4` },
//     source: `interview:material:${material.id}`,   // 任意。画面との紐づけ用
//     dedupeKey: `extract_audio:${material.id}`,      // 任意。二重登録の防止
//   })
//   // job.id を画面に渡し、GET /api/media-jobs/{id} で進み具合を見る
//
// 入力の保存先がログイン中のユーザーのものであることは、呼び出し側のアップロード API が
// 確かめてから渡す。ここでも「パスの最初の2つの区切りにユーザー ID がある」ことを確かめる。
// 呼び出し側が別の方法で所有を確認済みなら verifiedOwner: true を渡せる。

import { prisma } from '@/lib/prisma'
import { dispatchMediaJob } from './dispatch'
import { allowedInputBuckets, isMediaJobKind, mediaOutputBucket, type MediaJobKind, type MediaJobParams } from './kinds'

export type EnqueueMediaJobInput<K extends MediaJobKind = MediaJobKind> = {
  userId: string
  kind: K
  input: { bucket: string; path: string; size?: number }
  params?: MediaJobParams[K]
  source?: string
  dedupeKey?: string
  maxAttempts?: number
  /** 呼び出し側で保存先の所有者を確認済みのとき true（パスにユーザー ID が無い構成のため） */
  verifiedOwner?: boolean
  /**
   * 文字起こし（AssemblyAI、有料）を含む依頼で必ず true にする。
   * 呼び出し側が、利用者の枠・月の上限・1回の長さの上限を確かめたあとにだけ渡す。
   */
  allowPaidTranscription?: boolean
  /** false にすると Cloud Run を起動せず積むだけにする（cron が後で起動する） */
  dispatch?: boolean
}

export class MediaJobInputError extends Error {}

export function validateMediaJobInput(opts: EnqueueMediaJobInput): void {
  if (!isMediaJobKind(opts.kind)) throw new MediaJobInputError('未対応の処理の種類です')
  const { bucket, path } = opts.input
  const paid = opts.kind === 'transcribe' || (opts.kind === 'process_all' && (opts.params as MediaJobParams['process_all'] | undefined)?.transcribe === true)
  if (paid && !opts.allowPaidTranscription) {
    throw new MediaJobInputError('文字起こしは有料のため、利用枠を確認したうえで allowPaidTranscription を渡してください')
  }
  // 文字起こしの入力は、自分の出力バケットにある音声（本人の階層の下）に限る
  const ownAudio = opts.kind === 'transcribe' && bucket === mediaOutputBucket() && path.startsWith(`${opts.userId}/`)
  if (!ownAudio && !allowedInputBuckets().includes(bucket)) throw new MediaJobInputError('このバケットは処理の対象にできません')
  if (!path || path.startsWith('/') || path.split('/').some((s) => s === '..' || s === '.') || path.includes('\0')) {
    throw new MediaJobInputError('保存先のパスが正しくありません')
  }
  if (!opts.verifiedOwner && !ownAudio) {
    const head = path.split('/').slice(0, 2)
    if (!head.includes(opts.userId)) throw new MediaJobInputError('この保存先は本人のものではありません')
  }
  if (opts.kind === 'process_all') {
    const t = (opts.params as MediaJobParams['process_all'] | undefined)?.thumbnails
    if (t !== undefined && !(Number.isInteger(t) && t >= 0 && t <= 8)) throw new MediaJobInputError('サムネイルの枚数は0〜8にしてください')
  }
  if (opts.kind === 'thumbnail') {
    const p = (opts.params ?? {}) as MediaJobParams['thumbnail']
    if (p.count !== undefined && !(Number.isInteger(p.count) && p.count >= 1 && p.count <= 8)) {
      throw new MediaJobInputError('サムネイルの枚数は1〜8にしてください')
    }
    if (p.atSeconds !== undefined && !(typeof p.atSeconds === 'number' && p.atSeconds >= 0 && p.atSeconds < 86400)) {
      throw new MediaJobInputError('サムネイルの位置が正しくありません')
    }
  }
}

export async function enqueueMediaJob<K extends MediaJobKind>(opts: EnqueueMediaJobInput<K>) {
  validateMediaJobInput(opts)

  if (opts.dedupeKey) {
    const existing = await prisma.mediaJob.findUnique({ where: { dedupeKey: opts.dedupeKey } })
    if (existing) {
      if (existing.userId !== opts.userId) throw new MediaJobInputError('同じ依頼の鍵が他のユーザーで使われています')
      return existing
    }
  }

  let job
  try {
    job = await prisma.mediaJob.create({
      data: {
        userId: opts.userId,
        kind: opts.kind,
        inputBucket: opts.input.bucket,
        inputPath: opts.input.path,
        params: (opts.params ?? undefined) as object | undefined,
        source: opts.source,
        dedupeKey: opts.dedupeKey,
        maxAttempts: opts.maxAttempts ?? 3,
      },
    })
  } catch (e) {
    // 同じ dedupeKey の同時登録に負けたときは、先に入った1件を返す
    if (opts.dedupeKey && (e as { code?: string }).code === 'P2002') {
      const winner = await prisma.mediaJob.findUnique({ where: { dedupeKey: opts.dedupeKey } })
      if (winner && winner.userId === opts.userId) return winner
    }
    throw e
  }

  if (opts.dispatch !== false) {
    try {
      const started = await dispatchMediaJob(job.id)
      if (started) await prisma.mediaJob.update({ where: { id: job.id }, data: { dispatchedAt: new Date() } })
    } catch {
      // 起動に失敗してもジョブは queued で残る。cron(/api/cron/media-jobs)が再度起動する
      console.warn('[media-jobs] dispatch failed', job.id)
    }
  }
  return job
}
