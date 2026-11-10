/** Only fixed labels may leave this diagnostic boundary. Never log raw metadata. */
function clientFetchDiagnostic(metadata: unknown) {
  const detail = metadata !== null && typeof metadata === 'object'
    ? metadata as { url?: unknown; message?: unknown; error?: unknown; client?: unknown }
    : undefined
  let endpoint = 'other'
  if (typeof detail?.url === 'string' && detail.url.length <= 2048) {
    try {
      const path = new URL(detail.url, 'https://diagnostic.invalid').pathname
      if (path === '/api/auth/session') endpoint = 'session'
      else if (path === '/api/auth/providers') endpoint = 'providers'
      else if (path === '/api/auth/csrf') endpoint = 'csrf'
    } catch { /* Keep the fixed fallback for malformed URLs. */ }
  }
  const error = detail?.error !== null && typeof detail?.error === 'object'
    ? detail.error as { name?: unknown; message?: unknown }
    : undefined
  const message = typeof detail?.message === 'string' ? detail.message
    : typeof error?.message === 'string' ? error.message : ''
  // Browser transport stringifies nested Error objects; names may be unavailable.
  // These are hints for the next investigation, never a claim about root cause.
  let errorFamilyHint = 'unknown'
  if (error?.name === 'AbortError' || message === 'The operation was aborted.'
    || message === 'The user aborted a request.') errorFamilyHint = 'aborted'
  else if (error?.name === 'SyntaxError' || message.startsWith('Unexpected token')
    || message === 'Unexpected end of JSON input' || message.startsWith('JSON.parse:')) {
    errorFamilyHint = 'invalid_json'
  } else if (message === 'Failed to fetch' || message === 'Load failed'
    || message === 'NetworkError when attempting to fetch resource.') errorFamilyHint = 'network'
  return { endpoint, errorFamilyHint, client: detail?.client === true || detail?.client === 'true' }
}

/** Provider-declined authorization is not an application exception. */
const declinedAuthorizations = new WeakSet<object>()

function safeAuthLogCode(code: unknown): string {
  if (typeof code === 'string' && code.length > 0 && code.length <= 96 && !/[^A-Za-z0-9_]/.test(code)) {
    return code
  }
  return 'UNKNOWN_AUTH_LOG_CODE'
}

export const authLogger = {
  warn(code: string) {
    const safeCode = safeAuthLogCode(code)
    console.warn(`[next-auth][warn][${safeCode}]`, `\nhttps://next-auth.js.org/warnings#${safeCode.toLowerCase()}`)
  },
  error(code: string, metadata: unknown) {
    const detail = metadata as { providerId?: unknown; error?: { message?: unknown }; error_description?: unknown } | null
    if (code === 'OAUTH_CALLBACK_HANDLER_ERROR'
      && detail?.providerId === 'google'
      && detail.error?.message === 'access_denied'
      && !detail.error_description) {
      // NextAuth throws this same error after logging it, then logs it again
      // as OAUTH_CALLBACK_ERROR. Remember identity, never just the message.
      declinedAuthorizations.add(detail.error)
      console.warn('[auth] Google authorization was not granted (access_denied)')
      return
    }
    if (code === 'OAUTH_CALLBACK_ERROR' && metadata !== null && typeof metadata === 'object'
      && declinedAuthorizations.has(metadata)) {
      declinedAuthorizations.delete(metadata)
      console.warn('[auth] Google authorization callback ended without consent')
      return
    }
    // Keep unexpected authentication, database, state and PKCE failures visible.
    if (code === 'CLIENT_FETCH_ERROR') {
      console.error('[next-auth][error][CLIENT_FETCH_ERROR]', clientFetchDiagnostic(metadata))
      return
    }
    console.error(`[next-auth][error][${safeAuthLogCode(code)}]`)
  },
}
