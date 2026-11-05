// ============================================
// Cloud Run Jobs の起動（ワーカーの呼び出し）
// ============================================
// 認証: Google のサービスアカウントの鍵（MEDIA_WORKER_GCP_SA_JSON）で署名した
//       OAuth トークンで Cloud Run Admin API を呼ぶ。鍵は環境変数からだけ読む。
// 必要な環境変数（未設定なら起動せず queued のまま残り、あとで cron が拾う）:
//   MEDIA_WORKER_GCP_SA_JSON  サービスアカウント鍵(JSON)。権限は対象ジョブの run.jobs.run のみ
//   MEDIA_WORKER_GCP_PROJECT  GCP プロジェクト ID
//   MEDIA_WORKER_GCP_REGION   例: asia-northeast1
//   MEDIA_WORKER_JOB_NAME     Cloud Run ジョブ名（既定 doya-media-worker）

import { createSign } from 'node:crypto'

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string }

let cachedToken: { token: string; expiresAt: number } | null = null

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.MEDIA_WORKER_GCP_SA_JSON
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed.client_email === 'string' && typeof parsed.private_key === 'string') return parsed
  } catch {
    /* 値は出さない */
  }
  return null
}

export function isWorkerDispatchConfigured(): boolean {
  return !!(
    readServiceAccount() &&
    process.env.MEDIA_WORKER_GCP_PROJECT &&
    process.env.MEDIA_WORKER_GCP_REGION
  )
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.token
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token'
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    })
  )
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claim}`)
  const signature = signer.sign(sa.private_key).toString('base64url')
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${signature}`,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Google 認証に失敗しました (${res.status})`)
  const json = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { token: json.access_token, expiresAt: now + (json.expires_in || 3600) }
  return json.access_token
}

/**
 * ジョブ1件分のワーカー（Cloud Run Jobs の実行）を起動する。
 * 設定が無いときは false を返す（ジョブは queued のまま。cron が後で再試行する）。
 * 起動に失敗したときは例外を投げる。
 */
export async function dispatchMediaJob(jobId: string): Promise<boolean> {
  const sa = readServiceAccount()
  const project = process.env.MEDIA_WORKER_GCP_PROJECT
  const region = process.env.MEDIA_WORKER_GCP_REGION
  if (!sa || !project || !region) return false
  const jobName = process.env.MEDIA_WORKER_JOB_NAME || 'doya-media-worker'
  const token = await getAccessToken(sa)
  const url = `https://run.googleapis.com/v2/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(
    region
  )}/jobs/${encodeURIComponent(jobName)}:run`
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      overrides: { containerOverrides: [{ env: [{ name: 'MEDIA_JOB_ID', value: jobId }] }] },
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Cloud Run の起動に失敗しました (${res.status})`)
  return true
}
