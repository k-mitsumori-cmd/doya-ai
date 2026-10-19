// ============================================
// 共通の枠（AppShell）に載っているツールの台帳
// ============================================
// 枠は src/app/(shell)/layout.tsx に1つだけ置く。ツールを移っても枠を作り直さないため。
// どのパスで枠を出すかは、この台帳で決める（ShellGate が今のパスを見て引く）。
//
// ⚠️ ツールを載せ替えるときは、ここに1行足す（docs/architecture/management-agent/SHELL-MIGRATION.md）。
// ⚠️ 枠を出す条件はすべてそろったときだけ:
//    ログインしている ＋ 台帳にある ＋ （always か UI_SHELL_SERVICES に id がある）＋ inShell(pathname) が true
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
}

export const SHELL_SERVICES: ShellService[] = [
  { id: 'home', basePath: '/home', always: true, inShell: (p) => !p.startsWith('/home/preview') },
  { id: 'income', basePath: '/income', always: true },
  // 支出管理は組織を選んだあと（/expense/<組織>）だけ枠に入る。入口（/expense）と料金（/expense/pricing）は今までどおり
  { id: 'expense', basePath: '/expense', always: true, inShell: (p) => /^\/expense\/[^/]+/.test(p) && !p.startsWith('/expense/pricing') },
  { id: 'popup', basePath: '/popup' },
  { id: 'tenjikai', basePath: '/tenjikai' },
  // 社内インタビューの回答画面（/shanai/answer/<token>）は社員が開く公開の画面
  { id: 'shanai', basePath: '/shanai', inShell: (p) => !p.startsWith('/shanai/answer') },
  { id: 'doyalist', basePath: '/doyalist' },
  // ドヤスライドの紹介ページ（/doyaslide）は、ログイン後も枠の外（旧レイアウトと同じ判定）
  { id: 'doyaslide', basePath: '/doyaslide', inShell: (p) => p.replace(/\/+$/, '') !== '/doyaslide' },
  { id: 'adimage', basePath: '/adimage' },
  { id: 'asklink', basePath: '/asklink' },
  { id: 'banner', basePath: '/banner', inShell: (p) => p === '/banner/dashboard' || p.startsWith('/banner/dashboard/') },
  { id: 'seo', basePath: '/seo' },
  { id: 'cunning', basePath: '/cunning' },
  { id: 'interview', basePath: '/interview' },
  { id: 'persona', basePath: '/persona' },
  { id: 'quote', basePath: '/quote' },
  // ドヤ商談準備は組織を選んだあと（/shodan/<組織>）だけ枠に入る。入口（/shodan）・料金（/shodan/pricing）・招待は今までどおり
  { id: 'shodan', basePath: '/shodan', inShell: (p) => /^\/shodan\/[^/]+/.test(p) && !/^\/shodan\/(pricing|invite)(\/|$)/.test(p) },
  // AIO は組織を選んだあと（/aio/<組織>）だけ枠に入る。入口（/aio）・料金（/aio/pricing）・招待は今までどおり
  { id: 'aio', basePath: '/aio', inShell: (p) => /^\/aio\/[^/]+/.test(p) && !p.startsWith('/aio/pricing') && !p.startsWith('/aio/invite') },
  // AI商談の招待の受諾画面（/aishodan/invite/<token>）は枠の外（guest-path.ts でも外れる）
  { id: 'aishodan', basePath: '/aishodan', inShell: (p) => !p.startsWith('/aishodan/invite') },
  // 面接の画面（/mensetsu/live/<token>）と招待（/mensetsu/invite/<token>）は候補者・招待者が開く。guest-path.ts でも外れている
  { id: 'mensetsu', basePath: '/mensetsu', inShell: (p) => !p.startsWith('/mensetsu/live') && !p.startsWith('/mensetsu/invite') },
  // 営業管理は組織を選んだあと（/sfa/<組織>）だけ枠に入る。入口（/sfa）・料金（/sfa/pricing）・招待は今までどおり
  { id: 'sfa', basePath: '/sfa', inShell: (p) => /^\/sfa\/[^/]+/.test(p) && !p.startsWith('/sfa/pricing') && !p.startsWith('/sfa/invite') },
]

/** 今のパスが、台帳のどのツールに当たるか */
export function shellServiceForPath(pathname: string | null | undefined): ShellService | null {
  const p = pathname || '/'
  return SHELL_SERVICES.find((s) => p === s.basePath || p.startsWith(`${s.basePath}/`)) ?? null
}

/** 開発中だけの見本の画面（/<ツール>/dev/...）。見本は自分で枠を描くので、ここでは出さない（二重になるため） */
const DEV_PREVIEW = /^\/[^/]+\/dev(\/|$)/

/** 今のパスに枠を出すか（ログインの有無と、有効なツールの一覧は呼ぶ側から渡す） */
export function shouldShowShell(pathname: string | null | undefined, opts: { signedIn: boolean; enabledIds: string[] }): boolean {
  if (!opts.signedIn) return false
  if (DEV_PREVIEW.test(pathname || '')) return false
  // 第三者が開く画面（招待の受諾・面接・回答画面など。src/lib/ui/guest-path.ts）には出さない
  if (isGuestPath(pathname)) return false
  const svc = shellServiceForPath(pathname)
  if (!svc) return false
  const enabled = svc.always || opts.enabledIds.includes('all') || opts.enabledIds.includes(svc.id)
  if (!enabled) return false
  return svc.inShell ? svc.inShell(pathname || '/') : true
}
