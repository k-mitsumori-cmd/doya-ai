// ============================================
// ドヤパワー: 今日のミッション・はじめの手順・今月のドヤ実績
// ============================================
// ⚠️ 新しい見た目（src/lib/ui-next.ts の isUiNext()）のときだけ。今の見た目の人は経営ホームへ戻す。
// ⚠️ ドヤパワーの旗（src/lib/doya-power/flag.ts）が出さないと決めた人には 404。旗を先に見る（off ならセッションも DB も読まない）。
// ⚠️ ここは読むだけ。ドヤパワーの付与はしない（台帳 ui-next/doyapower-ledger の担当）。
// 枠（AppShell）は src/app/(shell)/layout.tsx が出す。
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isUiNext } from '@/lib/ui-next'
import { isDoyaPowerEnabled } from '@/lib/doya-power/flag'
import { loadMissionsView } from '@/lib/missions/load.server'
import MissionsBoard from '@/components/missions/MissionsBoard'

export const metadata: Metadata = {
  title: 'ミッションと今月の実績',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function MissionsPage() {
  if (!(await isDoyaPowerEnabled())) notFound()
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) redirect('/auth/signin?callbackUrl=/home/missions')
  if (!(await isUiNext())) redirect('/home')

  const view = await loadMissionsView(userId)
  return <MissionsBoard view={view} />
}
