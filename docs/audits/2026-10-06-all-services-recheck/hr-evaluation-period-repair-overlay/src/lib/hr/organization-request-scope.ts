import { HR_SELECTED_ACTOR_HEADER, HR_SELECTED_ORGANIZATION_HEADER } from './organization-selection'

/** One mounted actor/organization lifetime; never reads a mutable global selection. */
export function createHrOrganizationRequestScope(actor: string, organizationId: string, origin: string,
  isCurrent: () => boolean = () => true, transport: typeof fetch = fetch) {
  const identity = (value: string) => value.length > 0 && value.length <= 512 && !/[\s\u0000-\u001f\u007f]/.test(value)
  if (!identity(actor) || !identity(organizationId)) throw Error('組織とログイン情報を確認してください。')
  const base = new URL(origin)
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw Error('接続先を確認できませんでした。')
  const lifetime = new AbortController()
  const current = () => !lifetime.signal.aborted && isCurrent()
  const changed = () => new Error('組織またはログイン情報が変更されました。現在の画面から再度操作してください。')
  const request: typeof fetch = async (input, init = {}) => {
    if (!current()) throw changed()
    // Explicit URL inputs avoid inheriting a hidden Request body/credentials or signal.
    if (typeof input !== 'string' && !(input instanceof URL)) throw Error('組織のリクエストを確認できませんでした。')
    const url = new URL(input, base)
    if (url.origin !== base.origin || !url.pathname.startsWith('/api/hr/') || url.username || url.password || url.hash) throw Error('組織の接続先を確認できませんでした。')
    const headers = new Headers(init.headers)
    for (const [name, value] of [[HR_SELECTED_ACTOR_HEADER, actor], [HR_SELECTED_ORGANIZATION_HEADER, organizationId], ['X-HR-Organization-Id', organizationId]]) {
      const existing = headers.get(name)
      if (existing !== null && existing !== value) throw changed()
      headers.set(name, value)
    }
    if (init.signal?.aborted) throw changed()
    const combined = new AbortController()
    const cleanup = () => { lifetime.signal.removeEventListener('abort', cancel); init.signal?.removeEventListener('abort', cancel) }
    const cancel = () => { combined.abort(); cleanup() }
    lifetime.signal.addEventListener('abort', cancel, { once: true }); init.signal?.addEventListener('abort', cancel, { once: true })
    const signal = combined.signal
    let response: Response
    try { response = await transport(url.href, { ...init, headers, signal, cache: 'no-store', credentials: 'same-origin', mode: 'same-origin', redirect: 'error' }) } catch (error) { cleanup(); throw error }
    if (!current() || signal.aborted) {
      try { void response.body?.cancel().catch(() => {}) } catch {}
      cleanup(); throw changed()
    }
    // Body consumption belongs to this lifetime too, including callbacks after JSON parsing.
    let bodies = 1
    const wrap = (value: Response): Response => {
      let finished = false
      const finish = () => { if (!finished) { finished = true; if (--bodies === 0) cleanup() } }
      return new Proxy(value, { get(target, property) {
      if (['json', 'text', 'arrayBuffer', 'blob', 'formData'].includes(String(property))) return async () => {
        try { if (!current() || signal.aborted) throw changed(); const data = await (target[property as 'json'] as () => Promise<unknown>).call(target); if (!current() || signal.aborted) throw changed(); return data } finally { finish() }
      }
      if (property === 'clone') return () => { if (!current() || signal.aborted) throw changed(); const clone = target.clone(); bodies++; return wrap(clone) }
      if (property === 'body' && target.body) return new Proxy(target.body, { get(stream, name) {
        if (name === 'getReader') return () => {
          const reader = stream.getReader()
          return new Proxy(reader, { get(original, method) {
            if (method === 'read') return async () => { try { if (!current() || signal.aborted) throw changed(); const part = await original.read(); if (!current() || signal.aborted) throw changed(); if (part.done) finish(); return part } catch (error) { finish(); try { void original.cancel().catch(() => {}) } catch {}; throw error } }
            if (method === 'cancel') return (...args: Parameters<typeof original.cancel>) => { finish(); return original.cancel(...args) }
            const member = Reflect.get(original, method, original); return typeof member === 'function' ? member.bind(original) : member
          } })
        }
        if (name === 'cancel') return (...args: Parameters<typeof stream.cancel>) => { finish(); return stream.cancel(...args) }
        const member = Reflect.get(stream, name, stream); return typeof member === 'function' ? member.bind(stream) : member
      } })
      const member = Reflect.get(target, property, target); return typeof member === 'function' ? member.bind(target) : member
    } }) }
    return wrap(response)
  }
  return { actor, organizationId, request, isCurrent: current, dispose: () => lifetime.abort() }
}
