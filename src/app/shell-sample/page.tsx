// 開発用の見本: 部署別の枠（7項目のサイドバー・経営ホーム・マーケ部のページ・スマホの下のボタン）
// ⚠️ 本番（NODE_ENV=production）では 404。数字はすべて仮のもの。API・DB・AI・ログインには触れない
import { notFound } from 'next/navigation'
import DeptShellSample from '@/components/shell-next/DeptShellSample'

export const dynamic = 'force-dynamic'

export const metadata = { title: '部署別の枠（見本）| ドヤAI' }

export default function ShellSamplePage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <DeptShellSample />
}
