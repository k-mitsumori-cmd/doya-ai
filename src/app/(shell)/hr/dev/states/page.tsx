// ============================================
// ドヤHR: 画面の状態の見本（開発時だけ。本番では 404）
// ============================================
// 新しい見た目（useUiNext() が真・共通の枠の中）の目視確認用。DB・ログイン・AI には一切触れない（見本データだけ）。
// 使い方: npx next dev → /hr/dev/states?s=<状態>&p=<ページ>
//   s（状態）: home | empty | error | forbidden | limit | login | org-error   （中身は ./mock-fetch.ts）
//   p（ページ）: dashboard | employees | new | evaluations | one-on-one | org-chart（省略時は dashboard）
// 例:
//   ?s=home                       ダッシュボード（データあり）
//   ?s=empty&p=employees          従業員 0 人（空の状態＋次にやること1つ）
//   ?s=home&p=employees           従業員の一覧（検索で 0 件にすると「条件をクリア」）
//   ?s=error / forbidden / limit / login（&p=… で各ページの失敗の表示）
//   ?s=org-error                  組織の情報を読み込めない（枠の中のエラー）
//   ?s=home&p=new                 従業員の追加（空のまま保存すると欄の下にエラー）。?s=limit&p=new で保存すると上限の案内
// ⚠️ ログインしたまま開くと、(shell) と hr の layout が枠を出すので二重になる。ログアウトした状態（またはシークレットウィンドウ）で開く
import { notFound } from 'next/navigation'
import HrDevStates, { type HrDevPage } from './HrDevStates'
import type { HrDevState } from './mock-fetch'

export const dynamic = 'force-dynamic'

const STATES: HrDevState[] = ['home', 'empty', 'error', 'forbidden', 'limit', 'login', 'org-error']
const PAGES: HrDevPage[] = ['dashboard', 'employees', 'new', 'evaluations', 'one-on-one', 'org-chart']

type Props = { searchParams: Promise<{ s?: string; p?: string }> }

export default async function HrDevStatesPage({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { s = 'home', p = 'dashboard' } = await searchParams
  if (!STATES.includes(s as HrDevState) || !PAGES.includes(p as HrDevPage)) notFound()
  return <HrDevStates state={s as HrDevState} page={p as HrDevPage} />
}
