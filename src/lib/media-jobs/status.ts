// ジョブの状態を画面向けの形にする。出力には期限つきの署名URLを付ける（保存先のパスは返さない）

import { createClient } from '@supabase/supabase-js'
import type { MediaJob } from '@prisma/client'
import { MEDIA_JOB_KIND_LABELS, type MediaJobKind, type MediaJobOutput } from './kinds'

const SIGNED_URL_SECONDS = 60 * 60

export function mediaStorageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export type MediaJobView = {
  id: string
  kind: string
  kindLabel: string
  status: string
  progress: number
  stage: string | null
  attempts: number
  maxAttempts: number
  error: string | null
  source: string | null
  result: unknown
  outputs: { name: string; contentType: string; size: number; url: string | null }[]
  createdAt: string
  finishedAt: string | null
}

export async function toMediaJobView(job: MediaJob, opts: { withUrls: boolean }): Promise<MediaJobView> {
  const outs = Array.isArray(job.outputs) ? (job.outputs as unknown as MediaJobOutput[]) : []
  const client = opts.withUrls && job.status === 'succeeded' ? mediaStorageAdmin() : null
  const outputs = await Promise.all(
    outs.map(async (o) => {
      let url: string | null = null
      if (client) {
        const { data } = await client.storage.from(o.bucket).createSignedUrl(o.path, SIGNED_URL_SECONDS)
        url = data?.signedUrl ?? null
      }
      return { name: o.name, contentType: o.contentType, size: o.size, url }
    })
  )
  return {
    id: job.id,
    kind: job.kind,
    kindLabel: MEDIA_JOB_KIND_LABELS[job.kind as MediaJobKind] ?? job.kind,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    // 内部の詳細は出さない。失敗したときは短い案内にする
    error: job.status === 'failed' ? '処理に失敗しました。時間をおいて、もう一度お試しください。' : null,
    source: job.source,
    result: job.result,
    outputs,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
  }
}
