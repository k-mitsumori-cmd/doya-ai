/**
 * アプリ表示モードで止める経路の一覧（止める経路の一覧であって、許可する経路の一覧ではない）。
 * 課金・契約・価格に関わる経路を、1か所に集める。middleware（Edge）から呼ぶので、node 専用の部品を import しない。
 * 一覧の固定は blocked-routes.test.ts。経路を足したり消したりしたら、この一覧と試験と
 * docs/architecture/2026-11-18-app/app-mode-web.md の表を、いっしょに直す。
 *
 * パスの正規化は、アプリ側 doya-buddy-app/src/lib/webPolicy.ts の normalizePath と同じ規則。
 * （パーセント表記を変化がなくなるまで decode する、// と /./ と /../ と末尾の / を畳む、;以降を落とす、小文字にする。正規化できないものは、止める側に倒す。）
 */

/** 止めたときに返す、中立のページ（HTML の要求はここへ rewrite する） */
export const APP_UNAVAILABLE_PATH = '/app-unavailable'

/** 画面（HTML）で、このパス自身と配下を止める */
export const BLOCKED_PAGE_PREFIXES: readonly string[] = [
  '/pricing', // 統一料金ページ（/pricing/join を含む）
  '/tokushoho', // 特定商取引法に基づく表記（価格・支払い方法を載せる）
  '/billing', // 契約の管理（/billing/portal-unavailable）
  // 名前に pricing・billing を含まない、プランの管理の画面
  '/banner/dashboard/plan',
  '/seo/dashboard/plan',
  '/kantan/dashboard/plan',
]

/**
 * 画面で、パスのどこかの区切りがこの名前なら止める（各ツールの /xxx/pricing、/hr/settings/billing、/kantan/dashboard/pricing など）。
 * 個別に並べると、ツールが増えたときに止め漏れるため、名前で止める。
 */
export const BLOCKED_PAGE_SEGMENTS: readonly string[] = ['pricing', 'billing']

/** API で、このパス自身と配下を止める（404 を返す）。/api/stripe/webhook は、Stripe のサーバーが呼ぶ経路なので入れない。 */
export const BLOCKED_API_PREFIXES: readonly string[] = [
  '/api/stripe/checkout',
  '/api/stripe/portal',
  '/api/stripe/sync',
  '/api/stripe/trial-eligibility',
  '/api/pricing/billing',
  '/api/pricing/checkout-recovery',
  '/api/pricing/power-pack', // 追加購入（confirm を含む）
  '/api/pricing/seats',
  '/api/pricing/upsell',
  '/api/pricing/status',
  '/api/hr/billing', // checkout / portal（webhook も同じ配下。アプリの要求には来ない）
  '/api/organization-billing',
  '/api/admin/doya-power/purchase',
]

/** パスを、判定用に正規化する。正規化できない（不正なパーセント表記、制御文字）ものは null。 */
export function normalizePath(raw: string): string | null {
  let pathname: string
  try {
    pathname = new URL('http://doya.invalid' + (raw.startsWith('/') ? '' : '/') + raw.replace(/^\/+(?=\/)/, '/')).pathname
  } catch {
    return null
  }
  let cur = pathname
  for (let i = 0; i < 5; i++) {
    let next: string
    try {
      next = decodeURIComponent(cur)
    } catch {
      return null
    }
    if (next === cur) break
    cur = next
    if (i === 4) return null // 5回で収まらなければ止める側に倒す
  }
  if (/[\u0000-\u001f\u007f]/.test(cur)) return null
  const out: string[] = []
  for (const seg0 of cur.replace(/\\/g, '/').split('/')) {
    const seg = seg0.split(';')[0].trim()
    if (seg === '' || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg.toLowerCase())
  }
  return '/' + out.join('/')
}

const under = (p: string, prefix: string) => p === prefix || p.startsWith(prefix + '/')

export type BlockKind = 'none' | 'page' | 'api'

/**
 * アプリ表示モードのときに、このパスをどう扱うか。
 * - 'page': 画面。/app-unavailable へ rewrite する。
 * - 'api': 契約・購入の API。404 を返す。
 * - 'none': 何もしない。
 * 正規化できないパスは、止める側（/api/ で始まれば 'api'、それ以外は 'page'）に倒す。
 */
export function classifyBlockedPath(raw: string): BlockKind {
  const p = normalizePath(raw)
  if (p === null) return /^\/+api(?:[/%]|$)/i.test(raw) ? 'api' : 'page'
  if (under(p, '/api')) return BLOCKED_API_PREFIXES.some((x) => under(p, x)) ? 'api' : 'none'
  if (BLOCKED_PAGE_PREFIXES.some((x) => under(p, x))) return 'page'
  if (p.split('/').some((s) => BLOCKED_PAGE_SEGMENTS.includes(s))) return 'page'
  return 'none'
}
