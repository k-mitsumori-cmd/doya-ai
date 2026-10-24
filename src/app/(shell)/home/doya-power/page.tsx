// ============================================
// ドヤパワー: 内訳と履歴（/home/doya-power）
// ============================================
// 枠の上の帯・左のメニューの残りのゲージと、経営ホームのドヤパワーの欄から来る。
// ⚠️ ドヤパワーの旗（src/lib/doya-power/flag.ts）が出さないと決めた人には 404。旗を先に見る（off ならセッションも DB も読まない）。
// ⚠️ 新しい見た目（isUiNext()）のときだけ。今の見た目の人は経営ホームへ戻す。
// ⚠️ ここは読むだけ（毎月の付与・毎日の回復は、読むときに足りない分を付ける。balanceView と同じ）。会社はセッションの本人の会社だけ。
// 枠（AppShell）は src/app/(shell)/layout.tsx が出す。
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isDoyaPowerEnabled } from '@/lib/doya-power/flag'
import { loadDoyaPowerHome } from '@/lib/doya-power/home.server'
import { DoyaPowerDetail } from '@/components/doya-power/DoyaPowerHome'

export const metadata: Metadata = {
  title: 'ドヤパワーの内訳と履歴',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function DoyaPowerHistoryPage() {
  if (!(await isDoyaPowerEnabled())) notFound()
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) redirect('/auth/signin?callbackUrl=/home/doya-power')
  const view = await loadDoyaPowerHome({ withHistory: true, limit: 50 })
  // 会社が未登録・台帳が読めないときは、経営ホームへ戻す（会社の登録の案内はホームにある）
  if (!view) redirect('/home')
  return <DoyaPowerDetail view={view} />
}
