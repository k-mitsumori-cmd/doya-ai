// ============================================
// ドヤポップアップ: 画面の状態の見本（開発時だけ。本番では 404）
// ============================================
// 統合仕様 D-6 / §11 の目視確認用。実際の画面部品に見本データを渡して、
// 一覧・詳細・編集と、読込・空・エラー・権限なし・処理中の各状態を 375px / 1280px で確かめる。
// ⚠️ DB・ログイン・AIには一切触れない（見本データだけ）。
// 使い方: npx next dev → /popup/dev/states?s=home|home-empty|site|edit|forbidden|error|loading|processing
//   &shell=1 を付けると、共通シェル（AppShell＋ToolFrame）に載せた形で表示する（D-3 の確認用）
import { notFound } from 'next/navigation'
import { DETAIL, EDIT_SITE, POPUPS, SITES } from '@/lib/popup/dev-fixtures'
import AppShell from '@/components/shell/AppShell'
import PopupShellFrame from '@/components/popup/PopupShellFrame'
import { POPUP_NAV } from '@/lib/popup/nav'
import { ErrorState, ForbiddenState, ProcessingSteps, SkeletonDetail, SkeletonSiteCards } from '@/components/popup/ui'
import PopupTool from '../../Tool'
import SiteDetailClient from '../../sites/[id]/SiteDetailClient'
import EditClient from '../../edit/[id]/EditClient'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ s?: string; shell?: string }> }

export default async function PopupDevStates({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { s = 'home', shell } = await searchParams
  const wrap = (node: React.ReactNode) => <div className="pd-page mx-auto max-w-6xl px-4 py-8 md:px-8">{node}</div>
  const body = renderState(s, wrap)
  return shell === '1' ? <AppShell userName="見本 太郎"><PopupShellFrame nav={POPUP_NAV}>{body}</PopupShellFrame></AppShell> : body
}

function renderState(s: string, wrap: (node: React.ReactNode) => React.ReactNode) {
  switch (s) {
    case 'home':
      return <PopupTool initialSites={SITES} />
    case 'home-empty':
      return <PopupTool initialSites={[]} />
    case 'site':
      return <SiteDetailClient initial={DETAIL} created={false} />
    case 'edit':
      return <EditClient initialPopup={POPUPS[0]} site={EDIT_SITE} />
    case 'forbidden':
      return wrap(<ForbiddenState what="サイト" />)
    case 'error':
      return wrap(<ErrorState message="少し待ってから、もう一度お試しください。続くときは、ページを開き直してください。" />)
    case 'loading':
      return wrap(
        <div className="space-y-12">
          <SkeletonSiteCards />
          <SkeletonDetail />
        </div>
      )
    case 'processing':
      return wrap(<ProcessingSteps steps={['サイトを読み取っています', '「AIに聞く」の質問文を作っています', 'ポップアップの案をまとめています']} current={1} note="30秒ほどかかります" />)
    default:
      notFound()
  }
}
