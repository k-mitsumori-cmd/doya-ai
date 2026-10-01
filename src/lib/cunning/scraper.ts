// ============================================
// ドヤカンニング URL取り込み（軽量スクレイパー）
// ============================================
// ナレッジ取り込み・企業URL解析で共用。HTMLを取得し本文テキストへ素朴に変換する。
// ユーザー指定URLをサーバーが取得し本文を返すため SSRF 対策が必須:
//  - DNS解決した全IPがプライベート/ループバック/リンクローカル等でないか検証
//  - リダイレクトは手動で追い、各ホップの宛先を再検証（DNSリバインド/メタデータ到達を防ぐ）
import net from 'net'
import { Agent, fetch as pinnedFetch } from 'undici'
import { withTimeout } from '@/lib/fetch-timeout'
import { assertUrlSafe } from '@/lib/net/safe-fetch'

export const CUNNING_SCRAPE_MAX_BYTES = 4 * 1024 * 1024

export class CunningScrapeTooLargeError extends Error {
  constructor() {
    super('Cunning source page exceeds the HTML byte limit')
  }
}

/** Bound decoded response bytes before turning the page into a string. */
type HtmlResponse = {
  headers: { get(name: string): string | null }
  body: {
    cancel(): Promise<void>
    getReader(): {
      read(): Promise<{ done: boolean; value?: Uint8Array }>
      cancel(): Promise<void>
      releaseLock(): void
    }
  } | null
}

export async function readBoundedHtml(response: HtmlResponse, signal?: AbortSignal): Promise<string> {
  const declared = response.headers.get('content-length')
  if (declared && Number(declared) > CUNNING_SCRAPE_MAX_BYTES) {
    await response.body?.cancel().catch(() => {})
    throw new CunningScrapeTooLargeError()
  }
  if (!response.body) throw new Error('URL取得に失敗しました')

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = signal
        ? await withinDeadline(reader.read(), signal)
        : await reader.read()
      if (done) break
      if (!value) continue
      size += value.byteLength
      if (size > CUNNING_SCRAPE_MAX_BYTES) {
        await reader.cancel().catch(() => {})
        throw new CunningScrapeTooLargeError()
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

export interface ScrapeResult {
  url: string
  title: string
  text: string
}

interface ValidatedTarget {
  url: URL
  address: string // 検証済みの接続先IP（このIPに接続をピン留めしリバインドを防ぐ）
  family: number
}

/** 共通のSSRF検証で全解決先を確認し、固定する公開IPを返す。 */
async function assertPublicUrl(url: string): Promise<ValidatedTarget> {
  const { url: parsed, pinnedIp } = await assertUrlSafe(url)
  return { url: parsed, address: pinnedIp, family: net.isIP(pinnedIp) }
}

/** 検証済みIPへ接続を固定する undici Agent（DNSリバインドTOCTOU対策）。TLSはhostnameで検証される。 */
function pinnedAgent(address: string, family: number): Agent {
  return new Agent({
    connect: {
      lookup: (_hostname: string, options: any, cb: any) => {
        if (options && options.all) cb(null, [{ address, family }])
        else cb(null, address, family)
      },
    },
  })
}

/** DNS and stream reads must stop at the request deadline even if they ignore abort. */
function withinDeadline<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    if (signal.aborted) { task.catch(() => {}); abort(); return }
    signal.addEventListener('abort', abort, { once: true })
    task.then(
      value => { signal.removeEventListener('abort', abort); resolve(value) },
      error => { signal.removeEventListener('abort', abort); reject(error) },
    )
  })
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t　]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

/** URLを取得して本文テキスト化（最大 maxChars 文字）。SSRF対策済み。 */
export async function scrapeUrl(url: string, maxChars = 12000): Promise<ScrapeResult> {
  const timeoutMs = Number(process.env.CUNNING_SCRAPE_TIMEOUT_MS) || 20000

  return withTimeout('scrapeUrl', timeoutMs, async (signal) => {
    // Each hop validates the destination, pins the resolved IP, and consumes
    // or cancels the response before destroying the dispatcher.
    let currentUrl = url
    for (let hop = 0; hop < 5; hop++) {
      const current = await withinDeadline(assertPublicUrl(currentUrl), signal)
      const agent = pinnedAgent(current.address, current.family)
      try {
        const res = await pinnedFetch(current.url.toString(), {
          signal,
          redirect: 'manual',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DoyaCunning/1.0)' },
          dispatcher: agent,
        })
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get('location')
          void res.body?.cancel().catch(() => {})
          if (!loc || hop === 4) throw new Error('リダイレクトが多すぎます')
          currentUrl = new URL(loc, current.url).toString()
          continue
        }
        if (!res.ok) {
          void res.body?.cancel().catch(() => {})
          throw new Error(`URL取得に失敗しました (${res.status})`)
        }

        const html = await readBoundedHtml(res, signal)
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
        const finalUrl = current.url.toString()
        const title = titleMatch ? stripHtml(titleMatch[1]).slice(0, 200) : finalUrl
        const text = stripHtml(html).slice(0, maxChars)
        return { url: finalUrl, title, text }
      } finally {
        await agent.destroy().catch(() => {})
      }
    }
    throw new Error('リダイレクトが多すぎます')
  })
}
