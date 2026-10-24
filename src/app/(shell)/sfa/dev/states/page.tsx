// ============================================
// ドヤ営業管理: 画面の状態の見本（開発時だけ。本番では 404）
// ============================================
// 新しい見た目（UI 品質）の目視確認用。本物のページ部品を、見本のログイン・見本の組織（mihon）・偽の API（./MockFetch.ts）で動かす。
// ⚠️ DB・ログイン・AI には一切触れない（見本データだけ）。
// 使い方: npx next dev → /sfa/dev/states?p=<ページ>&s=<状態>
//   p（ページ）: home（ダッシュボード）| deals（商談パイプライン）| leads | tasks | activities | members | accounts | contacts
//   s（状態）  : home（見本データあり）| empty（0件）| error（読み込み失敗 500）| forbidden（権限なし 403）
//               | login（ログイン切れ 401）| limit（上限 402。上限の案内を最初から出し、作る操作も 402 を返す）
//   例: /sfa/dev/states?s=home  /sfa/dev/states?p=deals&s=empty  /sfa/dev/states?p=leads&s=error
//   絞り込み 0 件（no-results）は p=leads か p=accounts で、検索欄に「該当なし」などを入れると出る
import { notFound } from 'next/navigation'
import SfaStatesPreview from './Preview'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ s?: string; p?: string }> }

export default async function SfaDevStates({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { s = 'home', p = 'home' } = await searchParams
  return <SfaStatesPreview page={p} state={s} />
}
