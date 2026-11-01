// ============================================
// E2E 共通の fixture: 外部への通信をすべて遮断して数える
// ============================================
// テストの中で外部の API（OpenAI・Anthropic・Google・AssemblyAI・Stripe・Supabase など）を
// 呼ばないよう、ブラウザから出る通信は「テスト対象のサーバー（baseURL）」以外すべて止める。
// 止めた数は、テストごとに attachment（blocked-external）として結果に残し、
// summary-reporter.ts が全体の合計を出す。
// ⚠️ ここで止めるのはブラウザからの通信だけ。サーバー（next start）から外へ出る通信は
//    止められないので、playwright.config.ts の webServer で API キー類を空にしている。
import { test as base, expect, type Page, type TestInfo } from '@playwright/test'

/** 遮断した通信の宛先を、分かりやすい名前に分ける */
const VENDORS: Array<[string, RegExp]> = [
  ['OpenAI', /(^|\.)openai\.com$|(^|\.)oaiusercontent\.com$/],
  ['Anthropic', /(^|\.)anthropic\.com$|(^|\.)claude\.ai$/],
  ['Google AI', /^generativelanguage\.googleapis\.com$|^aiplatform\.googleapis\.com$/],
  ['AssemblyAI', /(^|\.)assemblyai\.com$/],
  ['Stripe', /(^|\.)stripe\.com$|(^|\.)stripe\.network$/],
  ['Supabase', /(^|\.)supabase\.co$|(^|\.)supabase\.in$/],
  ['Google Tag Manager / Analytics', /(^|\.)googletagmanager\.com$|(^|\.)google-analytics\.com$|(^|\.)doubleclick\.net$/],
  ['HubSpot', /(^|\.)hubspot\.com$|(^|\.)hs-scripts\.com$|(^|\.)hs-analytics\.net$|(^|\.)hs-banner\.com$|(^|\.)hscollectedforms\.net$|(^|\.)hsforms\.(com|net)$|(^|\.)usemessages\.com$|(^|\.)hubapi\.com$/],
  ['Google (その他)', /(^|\.)google\.com$|(^|\.)googleapis\.com$|(^|\.)gstatic\.com$|(^|\.)googleusercontent\.com$|(^|\.)youtube\.com$|(^|\.)ytimg\.com$/],
  ['Vercel', /(^|\.)vercel-insights\.com$|(^|\.)vercel-scripts\.com$|(^|\.)vercel\.live$/],
]

export function vendorOf(host: string): string {
  for (const [name, re] of VENDORS) if (re.test(host)) return name
  return 'その他'
}

export type BlockedLog = {
  total: number
  byVendor: Record<string, number>
  byHost: Record<string, number>
  /** 遮断した画像の URL（読み込めない画像の確かめから外すため） */
  imageUrls: Set<string>
}

type Fixtures = {
  blocked: BlockedLog
}

export const test = base.extend<Fixtures>({
  blocked: [
    async ({ context, baseURL }, use, testInfo) => {
      const allowed = new URL(baseURL ?? 'http://127.0.0.1:3100').origin
      const log: BlockedLog = { total: 0, byVendor: {}, byHost: {}, imageUrls: new Set() }
      await context.route('**/*', async (route) => {
        const req = route.request()
        let url: URL
        try {
          url = new URL(req.url())
        } catch {
          return route.continue()
        }
        if (url.origin === allowed || url.protocol === 'data:' || url.protocol === 'blob:') return route.continue()
        log.total++
        const vendor = vendorOf(url.hostname)
        log.byVendor[vendor] = (log.byVendor[vendor] ?? 0) + 1
        log.byHost[url.hostname] = (log.byHost[url.hostname] ?? 0) + 1
        if (req.resourceType() === 'image') log.imageUrls.add(req.url())
        return route.abort('blockedbyclient')
      })
      await use(log)
      await testInfo.attach('blocked-external', {
        contentType: 'application/json',
        body: JSON.stringify({ total: log.total, byVendor: log.byVendor, byHost: log.byHost }),
      })
    },
    { auto: true },
  ],
})

export { expect }

/**
 * ページを開いて、落ち着くまで待つ。
 * 外部を止めているので networkidle は早く来るが、来なくても先へ進む（長く続く通信がある画面のため）
 */
export async function openAndSettle(page: Page, path: string): Promise<number> {
  const res = await page.goto(path, { waitUntil: 'load' })
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  await page.evaluate(() => document.fonts?.ready).catch(() => {})
  // 入場のアニメーション（framer-motion など）が終わるのを待つ
  await page.waitForTimeout(1_200)
  return res?.status() ?? 0
}

/** 失敗したときに見返せるよう、最初の画面のスクリーンショットを添える */
export async function attachIfFailed(testInfo: TestInfo, name: string, shot: Buffer | null) {
  if (shot && testInfo.errors.length > 0) {
    await testInfo.attach(name, { contentType: 'image/jpeg', body: shot })
  }
}
