// ============================================
// ドヤ社内インタビュー: 画面の状態の見本（開発時だけ。本番では 404）
// ============================================
// 統合仕様 D-3 / D-6 / §11 の目視確認用。DB・ログイン・AI には一切触れない（見本データだけ）。
// 本物の画面部品をそのまま描き、/api/shanai/* は DevRoot が見本データを返す（window.fetch の差し替え）。
// 使い方: npx next dev → /shanai/dev/states?s=<状態>   （&shell=0 で共通シェルなし）
//   home           一覧（見本データ3件）
//   empty          一覧が空（空状態の絵＋はじめの3ステップ＋会社情報の案内）   ※ home-empty も同じ
//   loading        読み込み中（骨組み）
//   error          一覧の読み込み失敗（500。生の文は出さない）
//   forbidden      詳細を開く権限がない（403）
//   limit          今月の上限に達したとき（記事のステップに出る形の見本）
//   detail         詳細（録音 → 文字起こし・写真・事実・記事まで）
//   detail-survey  詳細（アンケートの途中）
//   detail-error   詳細の読み込み失敗（500）
//   detail-limit   詳細（記事の前）。「記事を作る」を押すと 429（料金プランへの道）
//   new            新規作成。名前を空のまま「作成して次へ」を押すと、欄の下に誤りが出る
//   new-error      新規作成。「作成して次へ」を押すと 500（ErrorNotice）
//   company        会社情報（プロフィールあり）
//   company-empty  会社情報（プロフィールが空）
//   company-error  会社情報の読み込み失敗（503）
//   processing     長い処理の段階表示
import { notFound } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import ShanaiFrame from '@/components/shanai/ShanaiFrame'
import { ProgressSteps } from '@/components/shanai/ui'
import ShanaiTool from '../../Tool'
import ShanaiNewPage from '../../new/page'
import ShanaiCompanyPage from '../../company/page'
import ShanaiInterviewPage from '../../interviews/[id]/page'
import DevRoot, { LimitPreview } from './DevRoot'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ s?: string; shell?: string }> }

export default async function ShanaiDevStates({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { s = 'home', shell } = await searchParams
  const body = renderState(s)
  return (
    <DevRoot state={s}>
      {shell === '0' ? (
        body
      ) : (
        <AppShell userName="見本 太郎">
          <ShanaiFrame>{body}</ShanaiFrame>
        </AppShell>
      )}
    </DevRoot>
  )
}

function renderState(s: string) {
  const wrap = (node: React.ReactNode) => <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{node}</div>
  switch (s) {
    case 'home':
    case 'empty':
    case 'home-empty':
    case 'error':
    case 'loading':
      // loading は通信が返らない（本物の骨組みが 300ms 後に出る）
      return <ShanaiTool />
    case 'forbidden':
    case 'detail':
    case 'detail-survey':
    case 'detail-error':
    case 'detail-limit':
      return <ShanaiInterviewPage />
    case 'limit':
      // 詳細の「④ 記事」で上限に達したときの形（押さなくても見えるように、失敗を最初から出す）
      return wrap(<LimitPreview />)
    case 'new':
    case 'new-error':
      return <ShanaiNewPage />
    case 'company':
    case 'company-empty':
    case 'company-error':
      return <ShanaiCompanyPage />
    case 'processing':
      return wrap(<ProgressSteps steps={['確認済みの事実を整理しています', '記事の構成を組み立てています', '本文を書き、根拠を照らし合わせています']} current={1} note="1〜2分かかります。" />)
    default:
      notFound()
  }
}
