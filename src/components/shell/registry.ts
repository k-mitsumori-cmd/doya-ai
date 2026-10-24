// ============================================
// 共通の枠（AppShell）に載っているツールの台帳
// ============================================
// 枠は src/app/(shell)/layout.tsx に1つだけ置く。ツールを移っても枠を作り直さないため。
// どのパスで枠を出すかは、この台帳で決める（ShellGate が今のパスを見て引く）。
//
// ⚠️ ツールを載せ替えるときは、ここに1行足す（docs/architecture/management-agent/SHELL-MIGRATION.md）。
// ⚠️ 枠を出す条件: ログインしている ＋ 台帳にある ＋ 招待・第三者の画面・見本でない（shouldShowShell を見る）。
//    入口・料金・組織を作る「はじめに」も枠の中。紹介ページ（LP。未ログインのとき）・ログイン画面・管理画面には出さない。
//    旗 UI_SHELL_SERVICES と、ツールごとの古いサイドバーのレイアウトはやめた（2026-10-24。全ツールを枠に載せ終えたため）。
// ⚠️ クライアントでも読むので、サーバー専用のもの（process.env・prisma など）を import しない。
import { isGuestPath } from '@/lib/ui/guest-path'

export interface ShellService {
  /** services.ts の id */
  id: string
  /** このツールの URL の先頭（例: '/popup'）。ここに当たるパスを、このツールのものとみなす */
  basePath: string
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
  { id: 'home', basePath: '/home' },
  { id: 'income', basePath: '/income' },
  { id: 'expense', basePath: '/expense' },
  { id: 'popup', basePath: '/popup', usage: { service: 'popup', refreshEvent: 'popup:generated' } },
  { id: 'tenjikai', basePath: '/tenjikai' },
  { id: 'shanai', basePath: '/shanai', usage: { service: 'shanai', refreshEvent: 'shanai:generated' } },
  { id: 'doyalist', basePath: '/doyalist' },
  { id: 'doyaslide', basePath: '/doyaslide' },
  { id: 'adimage', basePath: '/adimage', usage: { service: 'adimage', refreshEvent: 'adimage:generated' } },
  { id: 'asklink', basePath: '/asklink', usage: { service: 'asklink', refreshEvent: 'asklink:generated' } },
  { id: 'banner', basePath: '/banner', usage: { service: 'banner', refreshEvent: 'banner:usage-changed' } },
  { id: 'seo', basePath: '/seo', usage: { service: 'seo' } },
  { id: 'cunning', basePath: '/cunning' },
  { id: 'interview', basePath: '/interview' },
  { id: 'persona', basePath: '/persona', usage: { service: 'persona', refreshEvent: 'persona:usage-changed' } },
  { id: 'quote', basePath: '/quote', usage: { service: 'quote', refreshEvent: 'quote:usage-changed', pricingHref: '/quote/pricing', org: 'quote' } },
  { id: 'shodan', basePath: '/shodan', usage: { service: 'shodan', refreshEvent: 'shodan:usage-changed', org: 'path' } },
  { id: 'aio', basePath: '/aio', usage: { service: 'aio', refreshEvent: 'aio:usage-changed', org: 'path' } },
  { id: 'aishodan', basePath: '/aishodan', usage: { service: 'aishodan', pricingHref: '/aishodan/pricing' } },
  { id: 'mensetsu', basePath: '/mensetsu', usage: { service: 'mensetsu', pricingHref: '/mensetsu/pricing' } },
  { id: 'sfa', basePath: '/sfa' },
  { id: 'promane', basePath: '/promane' },
  { id: 'hr', basePath: '/hr' },
  { id: 'kintai', basePath: '/kintai' },
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
 * ログインしている人にも、枠を出さない画面（第三者・社外の人が開く画面と、見本）。
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
 * 今のパスに枠を出すか（ログインの有無は呼ぶ側から渡す）。
 * ログインした人には、台帳のツールの下の、第三者の画面と見本のほかすべてに出す。
 */
export function shouldShowShell(pathname: string | null | undefined, opts: { signedIn: boolean }): boolean {
  if (!opts.signedIn) return false
  if (DEV_PREVIEW.test(pathname || '')) return false
  // 第三者が開く画面（招待の受諾・面接・回答画面など。src/lib/ui/guest-path.ts）には出さない
  if (isGuestPath(pathname)) return false
  if (!shellServiceForPath(pathname)) return false
  const p = pathname || '/'
  return !INVITE.test(p) && !OUTSIDE_SHELL_SIGNED_IN.some((re) => re.test(p))
}
