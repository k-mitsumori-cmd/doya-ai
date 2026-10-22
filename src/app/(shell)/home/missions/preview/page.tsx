// 開発用プレビュー: ミッションの画面を見本のデータで表示する（DB 不要）
// ⚠️ 本番では 404。画面確認・デザイン調整のためだけに使う。
// ⚠️ ログインしていると (shell)/layout.tsx が枠を出すので、ここでは包まない（枠が二重にならないように）。
import { notFound } from 'next/navigation'
import { doyaPowerSampleAllowed } from '@/lib/doya-power/flag'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AppShell from '@/components/shell/AppShell'
import MissionsBoard from '@/components/missions/MissionsBoard'
import { sampleMissionsInput } from '@/lib/missions/sample'
import { buildMissionsView } from '@/lib/missions/view'

export const dynamic = 'force-dynamic'

export default async function MissionsPreviewPage() {
  // 本番と、ドヤパワーの旗（DOYA_POWER_ROLLOUT）が off のときは 404
  if (process.env.NODE_ENV === 'production' || !doyaPowerSampleAllowed()) notFound()
  const now = Date.now()
  const board = <MissionsBoard view={buildMissionsView(sampleMissionsInput(now), now)} sample />
  const signedIn = Boolean((await getServerSession(authOptions).catch(() => null))?.user)
  return signedIn ? board : <AppShell userName="サンプル">{board}</AppShell>
}
