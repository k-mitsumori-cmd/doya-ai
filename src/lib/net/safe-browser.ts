import type { HTTPRequest, Page } from 'puppeteer-core'
import { safeFetchResource } from './safe-fetch'

/** Chromium must never resolve user-controlled hosts itself. */
export const SAFE_BROWSER_ARGS = [
  '--disable-background-networking',
  '--host-resolver-rules=MAP * ~NOTFOUND',
]

/** Render static HTML/CSS/images using only the pinned, bounded Node transport. */
export async function installSafeBrowserRequests(page: Page): Promise<() => void> {
  await page.setJavaScriptEnabled(false)
  await page.setBypassServiceWorker(true)
  await page.setRequestInterception(true)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  let requests = 0
  let active = 0
  let totalBytes = 0
  const waiting: Array<() => void> = []
  const acquire = async () => {
    if (active < 6) { active++; return }
    await new Promise<void>(resolve => waiting.push(resolve))
  }
  const release = () => {
    const next = waiting.shift()
    if (next) next()
    else active--
  }
  const abort = async (req: HTTPRequest) => {
    try { if (!req.isInterceptResolutionHandled()) await req.abort() } catch { /* page may have closed */ }
  }
  const handle = async (req: HTTPRequest) => {
    const kind = req.resourceType()
    // Scripts/workers/WebSockets cannot run with JS disabled; deny their HTTP
    // requests too. File, data navigation and non-HTTP protocols are not proxied.
    if (++requests > 80 || controller.signal.aborted || req.method() !== 'GET' ||
      !['document', 'stylesheet', 'image', 'font'].includes(kind) ||
      !/^https?:\/\//i.test(req.url())) return abort(req)
    await acquire()
    try {
      if (controller.signal.aborted) return await abort(req)
      const resource = await safeFetchResource(req.url(), {
        accept: '*/*', timeoutMs: 10000, maxBytes: 4 * 1024 * 1024,
        signal: controller.signal,
        onBytes: size => {
          totalBytes += size
          if (totalBytes > 20 * 1024 * 1024) { controller.abort(); return false }
          return true
        },
      })
      if (!resource || controller.signal.aborted) return await abort(req)
      // Preserve final-URL relative CSS/image semantics: any redirect target
      // re-enters this same interception and pinning path before being rendered.
      if (resource.url !== new URL(req.url()).toString()) {
        if (!req.isInterceptResolutionHandled()) await req.respond({ status: 302, headers: { location: resource.url }, body: '' })
        return
      }
      if (!req.isInterceptResolutionHandled()) await req.respond({
        status: 200, contentType: resource.contentType || (kind === 'document' ? 'text/html' : kind === 'stylesheet' ? 'text/css' : 'application/octet-stream'),
        headers: { 'cache-control': 'no-store', 'content-security-policy': "script-src 'none'; worker-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'" },
        body: resource.body,
      })
    } catch {
      await abort(req)
    } finally {
      release()
    }
  }
  const listener = (req: HTTPRequest) => { void handle(req).catch(() => abort(req)) }
  page.on('request', listener)
  return () => {
    clearTimeout(timer)
    controller.abort()
    page.off('request', listener)
  }
}
