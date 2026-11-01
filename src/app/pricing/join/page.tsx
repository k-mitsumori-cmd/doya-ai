// ============================================
// 招待を受けて会社に参加する /pricing/join?token=...
// ============================================
// ⚠️ 旗 NEW_PRICING_ROLLOUT の内側。off なら 404（見本の表示 DS_PREVIEW=1 のときだけ開く）。
// 参加の判定（招待したメールと、ログインしている人のメールが同じか）は /api/pricing/members/accept が行う。
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isNewPricingEnabledFor, newPricingRollout } from '@/lib/pricing-v2/rollout'
import JoinInvite from '@/components/pricing/JoinInvite'

export default async function JoinPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const session = await getServerSession(authOptions).catch(() => null)
  const email = session?.user?.email ?? null
  if (process.env.DS_PREVIEW !== '1') {
    // 旗が off なら誰にも出さない。preview のときは、ログインして許可されている人だけ（ログイン前は、ログインの案内まで出す）
    if (newPricingRollout() === 'off') notFound()
    if (email && !isNewPricingEnabledFor(email)) notFound()
  }
  const token = typeof params.token === 'string' ? params.token : ''
  return <JoinInvite token={token} signedIn={Boolean(session?.user)} email={email} />
}
