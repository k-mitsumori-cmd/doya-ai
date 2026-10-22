// ============================================
// ドヤAI商談: 画面の状態の見本（開発時だけ。本番では 404）
// ============================================
// 新しい見た目（useUiNext() が true）の目視確認・スクリーンショット用。375px / 1280px で確かめる。
// ⚠️ DB・ログイン・AI には一切触れない。/api/aishodan/... は MockFetch が見本の JSON を返す（架空のデータだけ）。
// ⚠️ /aishodan/preview は製品の機能（練習モード）。見本の画面はここ（/aishodan/dev/states）に置く。
// 使い方: npx next dev → ログアウトした状態で /aishodan/dev/states?s=<状態>
//   ⚠️ ログインしたまま開くと、aishodan の layout と (shell) の layout の枠が外側にも付き、枠が二重になる
//   ダッシュボード（/aishodan）
//     home        … 商材・商談URL・直近の商談・未回答の質問があるとき
//     empty       … 組織はあるが、商材も商談もまだ無い（空状態の絵＋次の一手）
//     onboarding  … 組織がまだ無い（組織を作る）
//     loading     … 読み込み中（骨組み）
//     error       … 読み込みに失敗（500）→ やり直す
//     forbidden   … 権限が無い（403）→ 組織を確かめる
//     limit       … 商材の取り込みで今月の上限（402 LIMIT_REACHED）→ 料金プラン。読み込み後に自動で取り込みを押す
//   商談ログ（/aishodan/sessions）
//     sessions / sessions-empty / sessions-filtered（絞り込みでゼロ件。自動で「不適合」を押す）/ sessions-error / sessions-forbidden
//   商談の詳細（/aishodan/sessions/[id]）
//     detail / detail-pending（判定がまだ無い）/ detail-error（見つからない 404）
//   シナリオの編集（/aishodan/scenarios/[id]）
//     scenario / scenario-error
import { notFound } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import AishodanShellFrame from '@/components/aishodan/AishodanShellFrame'
import AishodanTool from '../../Tool'
import AishodanSessionsPage from '../../sessions/page'
import AishodanSessionDetail from '../../sessions/[id]/page'
import AishodanScenarioPage from '../../scenarios/[id]/page'
import MockFetch from './MockFetch'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ s?: string }> }

const TOOL_STATES = ['home', 'empty', 'onboarding', 'loading', 'error', 'forbidden', 'limit']
const SESSIONS_STATES = ['sessions', 'sessions-empty', 'sessions-filtered', 'sessions-error', 'sessions-forbidden']
const DETAIL_STATES = ['detail', 'detail-pending', 'detail-error']
const SCENARIO_STATES = ['scenario', 'scenario-error']

export default async function AishodanDevStates({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { s = 'home' } = await searchParams

  let body: React.ReactNode
  let params: Record<string, string> | undefined
  let act: 'import-limit' | 'filter-empty' | undefined
  if (TOOL_STATES.includes(s)) {
    body = <AishodanTool />
    if (s === 'limit') act = 'import-limit'
  } else if (SESSIONS_STATES.includes(s)) {
    body = <AishodanSessionsPage />
    if (s === 'sessions-filtered') act = 'filter-empty'
  } else if (DETAIL_STATES.includes(s)) {
    body = <AishodanSessionDetail />
    params = { id: 'sess1' }
  } else if (SCENARIO_STATES.includes(s)) {
    body = <AishodanScenarioPage />
    params = { id: 'scn1' }
  } else {
    notFound()
  }

  return (
    // 新しい見た目（UiNextContext = 'all'）は MockFetch の中で渡す
    <MockFetch state={s} params={params} act={act}>
      <AppShell userName="見本 太郎">
        <AishodanShellFrame>{body}</AishodanShellFrame>
      </AppShell>
    </MockFetch>
  )
}
