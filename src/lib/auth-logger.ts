/** Provider-declined authorization is not an application exception. */
const declinedAuthorizations = new WeakSet<object>()

export const authLogger = {
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
    console.error(`[next-auth][error][${code}]`, metadata)
  },
}
