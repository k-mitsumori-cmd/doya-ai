'use client'
// プロマネのダッシュボードの「これ1つで全部進む」帯（旗 ONE_BUTTON_ROLLOUT）。
// ⚠️ DashboardNext はサーバーの部品のままにする。帯だけを画面側の部品に分け、渡すのは行き先（href）だけにする。
//    ダッシュボードごと 'use client' にすると、旗が off でも案件・取引先・タスク・経費のデータが画面に送られてしまう（2026-10-27 統括の点検 重大）
import { useOneButton } from '@/components/one-button/context'
import { OneButtonBar } from '@/components/one-button/OneButtonBar'

export default function PromaneOneButton({ newHref }: { newHref: string }) {
  if (!useOneButton()) return null
  return (
    <OneButtonBar
      eyebrow="プロジェクト管理"
      cta="新しい案件を始めるなら、押してください"
      label="新規プロジェクト"
      scope="新しいプロジェクトの作成画面を開きます。作ったあとは、タスクと工数をここで追えます。"
      href={newHref}
    />
  )
}
