// ============================================
// ドヤAI質問リンク: 画面の状態の見本（開発時だけ。本番では 404）
// ============================================
// 新しい見た目（useUiNext() === true）の目視確認用。DB・ログイン・AI には一切触れない（見本データだけ）。
// /api/asklink/* は MockFetch.tsx が見本の返事に差し替える。
// 使い方: npx next dev → /asklink/dev/states?s=<状態>
//   home         作成画面（できあがるまでの流れ）
//   history      これまでの結果（2件）
//   empty        これまでの結果（0件。空の絵＋「質問リンクをつくる」）
//   loading      これまでの結果（読み込み中のまま）
//   error        これまでの結果（500 → 読み込めなかった／読み込み直す）
//   forbidden    これまでの結果（403 → 権限が無い／管理者に依頼）
//   limit        作成画面で「作成する」→ 429（今月の上限／料金プラン）
//   unreadable   作成画面で「作成する」→ 422（サイトを読み取れない → 手入力の欄）
//   create-error 作成画面で「作成する」→ 500（作成できなかった／やり直す）
//   detail       結果の詳細（リンク2本・バナー3枚。「作り直す」→ 429、ToB/ToC 切り替え → 500 の案内も試せる）
//   notfound     結果の詳細（404 → 見つからない／これまでの結果へ）
// ⚠️ 共通シェル（AppShell＋ToolFrame）に載せた形で出す。共通シェルの見た目で描く
import { notFound } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import AskLinkShellFrame from '@/components/asklink/AskLinkShellFrame'
import AskLinkTool from '../../Tool'
import AskLinkHistoryPage from '../../history/page'
import AskLinkRunPage from '../../history/[id]/page'
import MockFetch, { AutoSubmit } from './MockFetch'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ s?: string }> }

export default async function AskLinkDevStates({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { s = 'home' } = await searchParams
  return (
    <MockFetch s={s}>
      <AppShell userName="見本 太郎">
        <AskLinkShellFrame>{renderState(s)}</AskLinkShellFrame>
      </AppShell>
    </MockFetch>
  )
}

function renderState(s: string) {
  switch (s) {
    case 'home':
      return <AskLinkTool />
    case 'limit':
    case 'unreadable':
    case 'create-error':
      return (
        <>
          <AutoSubmit />
          <AskLinkTool />
        </>
      )
    case 'history':
    case 'empty':
    case 'loading':
    case 'error':
    case 'forbidden':
      return <AskLinkHistoryPage />
    case 'detail':
    case 'notfound':
      return <AskLinkRunPage />
    default:
      notFound()
  }
}
