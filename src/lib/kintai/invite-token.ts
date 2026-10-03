const INVITE_EXPIRY_MS = 48 * 60 * 60 * 1000

export function createKintaiInviteToken(now = Date.now()): string {
  return `v2.${now.toString(36)}.${crypto.randomUUID()}`
}

export function isKintaiInviteExpired(token: string | null, createdAt: Date, now = Date.now()): boolean {
  if (!token) return true
  let issuedAt = createdAt.getTime()
  if (token.startsWith('v2.')) {
    const match = /^v2\.([0-9a-z]+)\.[0-9a-f-]{36}$/.exec(token)
    if (!match) return true
    issuedAt = parseInt(match[1], 36)
  }
  return !Number.isSafeInteger(issuedAt) || issuedAt > now || now - issuedAt > INVITE_EXPIRY_MS
}
