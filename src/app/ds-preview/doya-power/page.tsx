// 開発用プレビュー: ドヤパワーの部品（ゲージ・言い換え・減る量の札・少ないときの知らせ・朝の回復）の見本（ログイン・DB不要）
// ⚠️ 本番では 404。375px / 1280px の画面確認のためだけに使う。
import { notFound } from 'next/navigation'
import DoyaPowerDemo from '@/components/doya-power/DoyaPowerDemo'

export const dynamic = 'force-dynamic'

export default function DoyaPowerPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <DoyaPowerDemo />
}
