// 開発用プレビュー: ドヤパワーの部品（ゲージ・言い換え・減る量の札・少ないときの知らせ・朝の回復）の見本（ログイン・DB不要）
// ⚠️ 本番では 404。375px / 1280px の画面確認で next start するときだけ DS_PREVIEW=1 で開ける（ds-preview の layout と同じ決まり。本番の環境変数には置かない）。
// ⚠️ 見本の数字だけを出す（台帳・DB・API に触れない）。部品はドヤパワーの旗の context が真のときだけ描くので、ここでは真を渡す。
import { notFound } from 'next/navigation'
import DoyaPowerDemo from '@/components/doya-power/DoyaPowerDemo'
import { DoyaPowerProvider } from '@/components/doya-power/doya-power-context'

export const dynamic = 'force-dynamic'

export default function DoyaPowerPreviewPage() {
  if (process.env.NODE_ENV === 'production' && process.env.DS_PREVIEW !== '1') notFound()
  return (
    <DoyaPowerProvider enabled>
      <DoyaPowerDemo />
    </DoyaPowerProvider>
  )
}
