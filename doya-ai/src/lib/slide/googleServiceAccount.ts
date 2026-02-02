import jwt from 'jsonwebtoken'

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v || !v.trim()) throw new Error(`${name} が未設定です（ドヤスライド Google連携）`)
  return v.trim()
}

function getPrivateKey(): string {
  // .env では改行が \n として入ることが多い
  const raw = requiredEnv('SLIDE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw
}

export async function getServiceAccountAccessToken(scopes: string[]): Promise<string> {
  const email = requiredEnv('SLIDE_GOOGLE_SERVICE_ACCOUNT_EMAIL')
  const privateKey = getPrivateKey()

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 60 * 55,
  }

  const assertion = jwt.sign(payload, privateKey, { algorithm: 'RS256' })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Google OAuth token error: ${res.status} - ${t.substring(0, 800)}`)
  }

  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error('Google OAuth token response missing access_token')
  return json.access_token
}


