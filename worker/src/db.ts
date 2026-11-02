import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { config } from './config.js'

export type JobRow = {
  id: string
  userId: string
  kind: string
  status: string
  inputBucket: string
  inputPath: string
  params: Record<string, unknown> | null
  result: Record<string, unknown> | null
  source: string | null
  attempts: number
  maxAttempts: number
}

let pool: pg.Pool | null = null

/**
 * 本番は DATABASE_CA_CERT（Supabase の「Database」設定からダウンロードしたルート証明書の PEM）で
 * サーバー証明書を検証する。未設定のときは起動を止める（証明書を検証しない接続は
 * 開発用に MEDIA_ALLOW_INSECURE_DB=1 を明示したときだけ許す）。
 */
function sslOptions(): pg.ConnectionConfig['ssl'] {
  const ca = process.env.DATABASE_CA_CERT?.trim()
  if (ca) return { rejectUnauthorized: true, ca }
  if (process.env.MEDIA_ALLOW_INSECURE_DB === '1') {
    console.warn('警告: MEDIA_ALLOW_INSECURE_DB=1 のため、DB のサーバー証明書を検証していません（開発用）')
    return { rejectUnauthorized: false }
  }
  throw new Error('DATABASE_CA_CERT が未設定です。DB のサーバー証明書を検証できないため起動しません')
}

export function getPool(): pg.Pool {
  if (pool) return pool
  const url = new URL(config.databaseUrl())
  // Prisma 用の指定は pg には不要
  for (const k of ['pgbouncer', 'connection_limit', 'pool_timeout', 'connect_timeout', 'sslmode', 'schema']) url.searchParams.delete(k)
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  pool = new pg.Pool({
    connectionString: url.toString(),
    max: 3,
    ssl: local ? undefined : sslOptions(),
    connectionTimeoutMillis: 15_000,
  })
  return pool
}

export async function closePool() {
  await pool?.end()
  pool = null
}

const COLS = `id, "userId", kind, status, "inputBucket", "inputPath", params, result, source, attempts, "maxAttempts"`

/**
 * ジョブを1件確保する。UPDATE の条件が排他になっているので、同じジョブを2つのワーカーが
 * 同時に確保することはない。確保できるのは次のどちらか。
 *  - 順番待ちで、実行してよい時刻を過ぎている
 *  - 実行中のまま心拍が5分以上ない（前のワーカーが落ちた）で、回数が残っている
 * 確保するたびに attempts を1増やす。
 */
export async function claimJob(workerId: string, jobId?: string): Promise<JobRow | null> {
  const { rows } = await getPool().query(
    `UPDATE media_job SET status='running', attempts=attempts+1, "lockedBy"=$1, "heartbeatAt"=now(),
        "startedAt"=COALESCE("startedAt", now()), progress=0, stage='開始しています', error=NULL
     WHERE id = (
       SELECT id FROM media_job
       WHERE ($2::text IS NULL OR id=$2)
         AND ((status='queued' AND "runAfter" <= now() + interval '1 second')
           OR (status='running' AND "heartbeatAt" < now() - interval '5 minutes' AND attempts < "maxAttempts"))
       ORDER BY "runAfter", "createdAt"
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING ${COLS}`,
    [workerId, jobId ?? null]
  )
  return (rows[0] as JobRow) ?? null
}

/** 自分がロックしている間だけ更新できる。ロックを失っていたら false */
export async function touch(jobId: string, workerId: string, patch: { progress?: number; stage?: string } = {}): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `UPDATE media_job SET "heartbeatAt"=now(), progress=COALESCE($3, progress), stage=COALESCE($4, stage)
     WHERE id=$1 AND "lockedBy"=$2 AND status='running'`,
    [jobId, workerId, patch.progress ?? null, patch.stage ?? null]
  )
  return (rowCount ?? 0) > 0
}

export async function markSucceeded(jobId: string, workerId: string, outputs: unknown, result: unknown): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `UPDATE media_job SET status='succeeded', progress=100, stage='完了', outputs=$3::jsonb, result=$4::jsonb,
        error=NULL, "finishedAt"=now(), "lockedBy"=NULL
     WHERE id=$1 AND "lockedBy"=$2 AND status='running'`,
    [jobId, workerId, JSON.stringify(outputs), JSON.stringify(result ?? null)]
  )
  return (rowCount ?? 0) > 0
}

/** 失敗の記録。回数が残っていれば待ちを置いて順番待ちに戻し、使い切っていれば failed にする */
export async function markFailed(job: JobRow, workerId: string, message: string, permanent: boolean): Promise<'requeued' | 'failed' | 'lost'> {
  const finalFail = permanent || job.attempts >= job.maxAttempts
  const delayMin = 2 * Math.pow(3, Math.max(0, job.attempts - 1)) // 2分, 6分, 18分
  const { rowCount } = await getPool().query(
    finalFail
      ? `UPDATE media_job SET status='failed', error=$3, "finishedAt"=now(), "lockedBy"=NULL, stage='失敗'
         WHERE id=$1 AND "lockedBy"=$2 AND status='running'`
      : `UPDATE media_job SET status='queued', error=$3, "lockedBy"=NULL, stage='再試行を待っています',
            "runAfter"=now() + ($4::int * interval '1 minute')
         WHERE id=$1 AND "lockedBy"=$2 AND status='running'`,
    finalFail ? [job.id, workerId, message.slice(0, 2000)] : [job.id, workerId, message.slice(0, 2000), delayMin]
  )
  if ((rowCount ?? 0) === 0) return 'lost'
  return finalFail ? 'failed' : 'requeued'
}

/** 途中経過(外部サービスのIDなど)を result に足す。再試行で同じ課金を繰り返さないために使う */
export async function checkpoint(jobId: string, data: Record<string, unknown>): Promise<void> {
  await getPool().query(`UPDATE media_job SET result = COALESCE(result, '{}'::jsonb) || $2::jsonb WHERE id=$1`, [jobId, JSON.stringify(data)])
}

/** 成功のあとに続けるジョブを積む。dedupeKey が同じなら二重には積まない。積んだジョブの id を返す */
export async function insertFollowUp(
  parent: JobRow,
  f: { kind: string; inputBucket: string; inputPath: string; params?: Record<string, unknown>; dedupeKey: string }
): Promise<string | null> {
  const { rows } = await getPool().query(
    `INSERT INTO media_job (id, "userId", kind, "inputBucket", "inputPath", params, source, "dedupeKey", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,now())
     ON CONFLICT ("dedupeKey") DO NOTHING RETURNING id`,
    [`c${randomUUID().replace(/-/g, '')}`, parent.userId, f.kind, f.inputBucket, f.inputPath, JSON.stringify(f.params ?? null), parent.source, f.dedupeKey]
  )
  return rows[0]?.id ?? null
}
