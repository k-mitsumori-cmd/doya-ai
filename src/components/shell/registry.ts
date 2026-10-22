// ============================================
// 共通の枠（AppShell）に載っているツールの台帳
// ============================================
// 枠は src/app/(shell)/layout.tsx に1つだけ置く。ツールを移っても枠を作り直さないため。
// どのパスで枠を出すかは、この台帳で決める（ShellGate が今のパスを見て引く）。
//
// ⚠️ ツールを載せ替えるときは、ここに1行足す（docs/architecture/management-agent/SHELL-MIGRATION.md）。
// ⚠️ 枠を出す条件はすべてそろったときだけ:
//    ログインしている ＋ 台帳にある ＋ （always か UI_SHELL_SERVICES に id がある）＋ inShell(pathname) が true
//    ⚠️ 新しい見た目のときは inShell を使わない（入口・料金・はじめにも枠の中。外すのは招待・第三者の画面・見本だけ）。shouldShowShell を見る
//    紹介ページ（LP。未ログインのとき）・公開の画面・ログイン画面・管理画面には出さない。
// ⚠️ クライアントでも読むので、サーバー専用のもの（process.env・prisma など）を import しない。
import { isGuestPath } from '@/lib/ui/guest-path'

export interface ShellService {
  /** services.ts の id。isShellEnabled(id) と同じ値 */
  id: string
  /** このツールの URL の先頭（例: '/popup'）。ここに当たるパスを、このツールのものとみなす */
  basePath: string
  /** 環境変数を見ずに、いつも枠を出す（最初から新しい枠で作ったツール） */
  always?: boolean
  /**
   * basePath の下で、枠を出すパスか。省略すると basePath の下はすべて出す。
   * 公開の画面（回答画面・共有画面など）や、組織を選ぶ前の入口のように、枠を出さないパスをここで外す。
   */
  inShell?: (pathname: string) => boolean
  /**
   * 枠の左下に出す「作った数 / 残り」とプラン（SidebarUsagePanel と同じもの）。
   * 数字は /api/usage/<service> から取る。省略したツールは出さない（料金プランへの導線だけが出る）。
   * ツールの中でしか分からない数字（人事の従業員数など）は、ツールの側から ShellUsageSlot で渡す。
   */
  usage?: ShellUsage
}

export interface ShellUsage {
  /** /api/usage/<service> の service */
  service: string
  /** この名前のイベントが来たら数字を読み直す（今のサイドバーと同じ名前） */
  refreshEvent?: string
  /** 「プランを見る」の行き先。省略すると SidebarUsagePanel の既定 */
  pricingHref?: string
  /**
   * 組織ごとに数えるツールの、組織の取り方。
   * - 'path': URL の2つめ（/aio/<組織>/...）
   * - 'quote': 見積の組織の選び方（localStorage・?org=）。useQuoteUsageOrganization と同じ
   */
  org?: 'path' | 'quote'
}

export const SHELL_SERVICES: ShellService[] = [
  { id: 'home', basePath: '/home', always: true, inShell: (p) => !p.startsWith('/home/preview') },
  { id: 'income', basePath: '/income', always: true },
  // 支出管理は組織を選んだあと（/expense/<組織>）だけ枠に入る。入口（/expense）と料金（/expense/pricing）は今までどおり
  { id: 'expense', basePath: '/expense', always: true, inShell: (p) => /^\/expense\/[^/]+/.test(p) && !p.startsWith('/expense/pricing') },
  { id: 'popup', basePath: '/popup', usage: { service: 'popup', refreshEvent: 'popup:generated' } },
  { id: 'tenjikai', basePath: '/tenjikai' },
  // 社内インタビューの回答画面（/shanai/answer/<token>）は社員が開く公開の画面
  { id: 'shanai', basePath: '/shanai', inShell: (p) => !p.startsWith('/shanai/answer'), usage: { service: 'shanai', refreshEvent: 'shanai:generated' } },
  { id: 'doyalist', basePath: '/doyalist' },
  // ドヤスライドの紹介ページ（/doyaslide）は、ログイン後も枠の外（旧レイアウトと同じ判定）
  { id: 'doyaslide', basePath: '/doyaslide', inShell: (p) => p.replace(/\/+$/, '') !== '/doyaslide' },
  { id: 'adimage', basePath: '/adimage', usage: { service: 'adimage', refreshEvent: 'adimage:generated' } },
  { id: 'asklink', basePath: '/asklink', usage: { service: 'asklink', refreshEvent: 'asklink:generated' } },
  { id: 'banner', basePath: '/banner', inShell: (p) => p === '/banner/dashboard' || p.startsWith('/banner/dashboard/'), usage: { service: 'banner', refreshEvent: 'banner:usage-changed' } },
  { id: 'seo', basePath: '/seo', usage: { service: 'seo' } },
  { id: 'cunning', basePath: '/cunning' },
  { id: 'interview', basePath: '/interview' },
  { id: 'persona', basePath: '/persona', usage: { service: 'persona', refreshEvent: 'persona:usage-changed' } },
  { id: 'quote', basePath: '/quote', usage: { service: 'quote', refreshEvent: 'quote:usage-changed', pricingHref: '/quote/pricing', org: 'quote' } },
  // ドヤ商談準備は組織を選んだあと（/shodan/<組織>）だけ枠に入る。入口（/shodan）・料金（/shodan/pricing）・招待は今までどおり
  { id: 'shodan', basePath: '/shodan', inShell: (p) => /^\/shodan\/[^/]+/.test(p) && !/^\/shodan\/(pricing|invite)(\/|$)/.test(p), usage: { service: 'shodan', refreshEvent: 'shodan:usage-changed', org: 'path' } },
  // AIO は組織を選んだあと（/aio/<組織>）だけ枠に入る。入口（/aio）・料金（/aio/pricing）・招待は今までどおり
  { id: 'aio', basePath: '/aio', inShell: (p) => /^\/aio\/[^/]+/.test(p) && !p.startsWith('/aio/pricing') && !p.startsWith('/aio/invite'), usage: { service: 'aio', refreshEvent: 'aio:usage-changed', org: 'path' } },
  // AI商談の招待の受諾画面（/aishodan/invite/<token>）は枠の外（guest-path.ts でも外れる）
  { id: 'aishodan', basePath: '/aishodan', inShell: (p) => !p.startsWith('/aishodan/invite'), usage: { service: 'aishodan', pricingHref: '/aishodan/pricing' } },
  // 面接の画面（/mensetsu/live/<token>）と招待（/mensetsu/invite/<token>）は候補者・招待者が開く。guest-path.ts でも外れている
  { id: 'mensetsu', basePath: '/mensetsu', inShell: (p) => !p.startsWith('/mensetsu/live') && !p.startsWith('/mensetsu/invite'), usage: { service: 'mensetsu', pricingHref: '/mensetsu/pricing' } },
  // 営業管理は組織を選んだあと（/sfa/<組織>）だけ枠に入る。入口（/sfa）・料金（/sfa/pricing）・招待は今までどおり
  { id: 'sfa', basePath: '/sfa', inShell: (p) => /^\/sfa\/[^/]+/.test(p) && !p.startsWith('/sfa/pricing') && !p.startsWith('/sfa/invite') },
  // プロマネは組織（ワークスペース）を選んだあと（/promane/<slug>）だけ枠に入る。入口（/promane）・招待・料金は今までどおり
  { id: 'promane', basePath: '/promane', inShell: (p) => /^\/promane\/[^/]+/.test(p) && !/^\/promane\/(invite|pricing)(\/|$)/.test(p) },
  { id: 'hr', basePath: '/hr', inShell: (p) => p !== '/hr' && p !== '/hr/pricing' && !p.startsWith('/hr/pricing/') }, // 紹介ページと料金は枠の外。招待は guest-path.ts で外れる
  // 勤怠の紹介ページ（/kintai）・料金（/kintai/pricing）・招待（/kintai/invite*）は枠を出さない（KintaiLayout の公開ページと同じ判定）
  { id: 'kintai', basePath: '/kintai', inShell: (p) => p !== '/kintai' && p !== '/kintai/pricing' && !p.startsWith('/kintai/invite') },
]

/** 今のパスが、台帳のどのツールに当たるか */
export function shellServiceForPath(pathname: string | null | undefined): ShellService | null {
  const p = pathname || '/'
  return SHELL_SERVICES.find((s) => p === s.basePath || p.startsWith(`${s.basePath}/`)) ?? null
}

/** 開発中だけの見本の画面（/<ツール>/dev/...）。見本は自分で枠を描くので、ここでは出さない（二重になるため） */
const DEV_PREVIEW = /^\/[^/]+\/dev(\/|$)/

/** 招待の受諾の入口（/<ツール>/invite と、その下）。まだ組織に入っていない人が開く */
const INVITE = /^\/[a-z]+\/invite(\/|$)/

/**
 * 新しい見た目でログインしている人にも、枠を出さない画面（第三者・社外の人が開く画面と、見本）。
 * ⚠️ ここに無いパスは、ツールの入口・料金・組織を作る「はじめに」も含めて、すべて枠の中に出す
 *    （2026-10-23 ユーザーの指摘「収入管理・支出管理を押すと上のヘッダーが消えて画面が変わる」）。
 *    未ログインの紹介ページ・料金ページは、signedIn が偽なので今までどおり枠の外。
 */
const OUTSIDE_SHELL_SIGNED_IN: RegExp[] = [
  /^\/home\/preview(\/|$)/,
  // 応募者が開く面接の画面と、社員が開く回答の画面（guest-path.ts は下の階層だけを見るので、入口もここで外す）
  /^\/mensetsu\/live(\/|$)/,
  /^\/shanai\/answer(\/|$)/,
  // バナーの紹介ページと、開発用の試しの画面
  /^\/banner\/(landing|test)(\/|$)/,
]

/**
 * 今のパスに枠を出すか（ログインの有無と、有効なツールの一覧は呼ぶ側から渡す）。
 * uiNext（新しい見た目）のときは、ツールの台帳の inShell を使わず、ログインした人には第三者の画面のほかすべてに出す。
 * 今の見た目のときは、今までどおり inShell で決める。
 */
export function shouldShowShell(pathname: string | null | undefined, opts: { signedIn: boolean; enabledIds: string[]; uiNext?: boolean }): boolean {
  if (!opts.signedIn) return false
  if (DEV_PREVIEW.test(pathname || '')) return false
  // 第三者が開く画面（招待の受諾・面接・回答画面など。src/lib/ui/guest-path.ts）には出さない
  if (isGuestPath(pathname)) return false
  const svc = shellServiceForPath(pathname)
  if (!svc) return false
  const enabled = svc.always || opts.enabledIds.includes('all') || opts.enabledIds.includes(svc.id)
  if (!enabled) return false
  const p = pathname || '/'
  if (opts.uiNext) return !INVITE.test(p) && !OUTSIDE_SHELL_SIGNED_IN.some((re) => re.test(p))
  return svc.inShell ? svc.inShell(p) : true
}
