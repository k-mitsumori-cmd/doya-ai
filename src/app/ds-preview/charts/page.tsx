// 開発用プレビュー: ds/charts と数え上げ（CountUp・StatTile）の見本（ログイン・DB不要）
// ⚠️ 本番では 404。画面確認で next start するときだけ DS_PREVIEW=1 で開ける（layout.tsx と同じ条件）
import { notFound } from 'next/navigation'
import ChartsPreview from './ChartsPreview'

export const dynamic = 'force-dynamic'

export default function DsChartsPreviewPage() {
  if (process.env.NODE_ENV === 'production' && process.env.DS_PREVIEW !== '1') notFound()
  return <ChartsPreview />
}
