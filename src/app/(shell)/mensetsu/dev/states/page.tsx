// ============================================
// ドヤ面接官: 画面の状態の見本（開発時だけ。本番では 404）
// ============================================
// 新しい見た目（useUiNext() === true）の目視確認用。DB・ログイン・AI には一切触れない（見本データだけ）。
// /api/mensetsu/* は MockFetch.tsx が見本の返事に差し替える。
// 使い方: npx next dev → /mensetsu/dev/states?s=<状態>
//   home                面接の準備（会社情報・質問セット2件・面接5件）
//   empty               質問セット0件・面接0件（空の絵＋「職種を入力する」「質問セットを作る」）
//   no-sessions         質問セットはあり、面接0件（空の絵＋「面接URLを発行する」）
//   onboarding          組織がまだ無い（組織の作成）
//   loading             読み込み中のまま
//   error               500 → 読み込めなかった／再読み込み
//   forbidden           403 → 権限が無い／管理者に依頼
//   limit-load          429 → 今月の上限か操作の集中／料金プラン
//   limit               「面接URLを発行する」を自動で押す → 402 LIMIT_REACHED（今月の上限／料金プラン）
//   detail              評価レポート（評価済み・評価軸3つ・逐語ログ。「逐語ログ」タブ・採点例の Esc も試せる）
//   detail-pending      評価レポート（未評価・逐語ログ0件。「逐語ログ」タブで空の絵）
//   detail-notfound     評価レポート 404 → 見つからない／面接一覧へ戻る
//   detail-error        評価レポート 500 → 読み込めなかった／再読み込み
//   compare             候補者の比較（3人。表は横にスクロール。質問セットを選ぶと 0件 → 絞り込みの空表示）
//   compare-empty       候補者の比較（評価済み0人）
//   compare-notemplates 候補者の比較（質問セット0件）
//   compare-forbidden   候補者の比較（質問セット 403）
//   compare-error       候補者の比較（比較結果 500）
//   template            質問セットの編集
//   template-notfound   質問セットの編集 404
//   template-error      質問セットの編集 500
//   settings            設定（メンバー3人）
//   settings-noorg      設定（組織が無い → 空の絵＋「組織を作成する」）
//   settings-forbidden  設定 403
// ⚠️ 共通シェル（AppShell＋ToolFrame）に載せた形で出す。新しい見た目を強制する（MockFetch の中で UiNextContext = 'all'）
// ⚠️ ログインしたまま開くと、(shell)/layout と mensetsu/layout の枠が外側にも出る。ログアウトした状態で開く
import { notFound } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import MensetsuShellFrame from '@/components/mensetsu/MensetsuShellFrame'
import MensetsuTool from '../../Tool'
import MensetsuReportPage from '../../sessions/[id]/page'
import ComparePage from '../../compare/page'
import TemplateEditPage from '../../templates/[id]/page'
import MensetsuSettingsPage from '../../settings/page'
import MockFetch, { AutoIssue } from './MockFetch'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ s?: string }> }

export default async function MensetsuDevStates({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { s = 'home' } = await searchParams
  return (
    // MockFetch が UiNextContext.Provider value="all" で包む（サーバーの部品からは Provider を使えないため）
    <MockFetch s={s}>
      <AppShell userName="見本 太郎">
        <MensetsuShellFrame>{renderState(s)}</MensetsuShellFrame>
      </AppShell>
    </MockFetch>
  )
}

function renderState(s: string) {
  if (s.startsWith('detail')) return <MensetsuReportPage />
  if (s.startsWith('compare')) return <ComparePage />
  if (s.startsWith('template')) return <TemplateEditPage />
  if (s.startsWith('settings')) return <MensetsuSettingsPage />
  switch (s) {
    case 'limit':
      return (
        <>
          <AutoIssue />
          <MensetsuTool />
        </>
      )
    case 'home':
    case 'empty':
    case 'no-sessions':
    case 'onboarding':
    case 'loading':
    case 'error':
    case 'forbidden':
    case 'limit-load':
      return <MensetsuTool />
    default:
      notFound()
  }
}
