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
  // プロマネは組織（ワークスペース）を選んだあと（/promane/<slug>）だけ枠に入る。入口（/promane）・招待・料金は今までどおり
  { id: 'promane', basePath: '/promane', inShell: (p) => /^\/promane\/[^/]+/.test(p) && !/^\/promane\/(invite|pricing)(\/|$)/.test(p) },
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
