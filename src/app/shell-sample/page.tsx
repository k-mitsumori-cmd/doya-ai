// 開発用の見本: 部署別の枠（7項目のサイドバー・経営ホーム・マーケ部のページ・スマホの下のボタン）
// ⚠️ 本番（VERCEL_ENV=production）では 404。Vercel の preview（VERCEL_ENV=preview。Vercel のログインで守られる）と、手元の開発では開ける。
//    Vercel 以外で NODE_ENV=production のときも 404。数字はすべて仮のもの。API・DB・AI・ログインには触れない
import { notFound } from 'next/navigation'
import DeptShellSample from '@/components/shell-next/DeptShellSample'

export const dynamic = 'force-dynamic'

export const metadata = { title: '部署別の枠（見本）| ドヤAI' }

export default function ShellSamplePage() {
  // 見本を開けるのは「手元の開発」と「Vercel の preview」だけ。本番は必ず 404
  const isPreview = process.env.VERCEL_ENV === 'preview'
  if (process.env.NODE_ENV === 'production' && !isPreview) notFound()
  return <DeptShellSample />
}
