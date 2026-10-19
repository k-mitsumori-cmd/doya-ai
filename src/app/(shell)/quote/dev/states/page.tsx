// ============================================
// ドヤ見積もりAI: 画面の状態の見本（開発時だけ。本番では 404）
// ============================================
// UI 品質の直し（新しい見た目 useUiNext() === true）の目視確認用。DB・ログイン・AI には一切触れない（偽の API 応答 MockFetch.tsx）。
// 使い方: npx next dev → /quote/dev/states?s=<状態>
//   home        … 見積書と商材がある一覧（ホーム）
//   empty       … 見積書・商材・発行者情報が無い（空の状態）
//   onboarding  … 組織がまだ無い（最初の組織づくり）
//   error       … 読み込みに失敗（500）
//   forbidden   … 権限が無い（403）
//   limit       … 上限（429）。※ home で「商材として保存」「見積書を作成する」を押すと、402 の上限の案内も見られる
//   settings / settings-error / settings-forbidden … 設定（発行者情報・メンバー）
//   detail / detail-error / detail-forbidden / detail-missing / detail-no-issuer … 見積書の詳細
//     （詳細は useParams が要るので /quote/dev/states/documents/sample1?s=... に移す）
import { notFound, redirect } from 'next/navigation'
import QuoteTool from '../../Tool'
import QuoteSettingsPage from '../../settings/page'
import QuotePreview from './Preview'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ s?: string }> }

export default async function QuoteDevStates({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { s = 'home' } = await searchParams
  if (s.startsWith('detail')) redirect(`/quote/dev/states/documents/sample1?s=${encodeURIComponent(s)}`)
  const body = s.startsWith('settings') ? <QuoteSettingsPage /> : <QuoteTool />
  // key で状態ごとに作り直す（前の状態の読み込み結果を持ち越さない）
  return <QuotePreview key={s} state={s}>{body}</QuotePreview>
}
