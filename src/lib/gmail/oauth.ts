// Google OAuth（gmail.send の追加同意）。googleapis は使わず fetch で呼ぶ。
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send'

export function getBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp').replace(/\/$/, '')
}

export function getRedirectUri(): string {
  return `${getBaseUrl()}/api/gmail/callback`
}

export function buildAuthUrl(state: string, loginHint?: string | null): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: `openid email ${GMAIL_SEND_SCOPE}`,
    include_granted_scopes: 'true', // 追加の同意（ログイン時の権限は変えない）
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  if (loginHint) p.set('login_hint', loginHint)
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`
}

export interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  id_token?: string
  error?: string
  error_description?: string
}

async function tokenRequest(body: Record<string, string>): Promise<{ ok: boolean; data: TokenResponse }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      ...body,
    }),
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as TokenResponse
  return { ok: res.ok, data }
}

export async function exchangeCode(code: string) {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: getRedirectUri() })
}

export async function refreshAccessToken(refreshToken: string) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
}

export async function revokeToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
      cache: 'no-store',
    })
    return res.ok
  } catch {
    return false
  }
}

// id_token の payload から email を取り出す（Google のトークンエンドポイントから直接受け取った値）
export function emailFromIdToken(idToken?: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from((idToken || '').split('.')[1], 'base64url').toString('utf8'))
    return typeof payload.email === 'string' ? payload.email : null
  } catch {
    return null
  }
}
