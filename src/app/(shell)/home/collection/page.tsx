// ============================================
// ツール図鑑と実績（ドヤパワー）
// ============================================
// 使ったツールのスタンプ・仕事の成果の実績・会社が使う分野の中での活用度を出す。
// ⚠️ 新しい見た目（isUiNext()）のときだけ。今の見た目の人には出さない（404）。
// ⚠️ ドヤパワーの旗（src/lib/doya-power/flag.ts）が出さないと決めた人にも 404。旗を先に見る（off ならセッションも DB も読まない）。
// ⚠️ 読むだけ。DB の記録を数えるだけで、書き込み・外部 API の呼び出しはしない。
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isDoyaPowerEnabled } from '@/lib/doya-power/flag'
import { SHELL_GROUPS } from '@/components/shell/tools'
import { buildCatalog } from '@/lib/collection/catalog'
import { evaluateBadges } from '@/lib/collection/badges'
import { loadCollectionFacts } from '@/lib/collection/facts.server'
import { loadDoyaPowerFxForUser } from '@/lib/doya-power/fx.server'
import CollectionView from '@/components/collection/CollectionView'

export const metadata: Metadata = {
  title: 'ツール図鑑と実績',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function CollectionPage() {
  if (!(await isDoyaPowerEnabled())) notFound()
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) redirect('/auth/signin?callbackUrl=/home/collection')

  const [facts, fxs] = await Promise.all([loadCollectionFacts(userId), loadDoyaPowerFxForUser(userId)])
  // 枠（AppShell）は src/app/(shell)/layout.tsx が出す
  return <CollectionView tools={buildCatalog(SHELL_GROUPS)} usage={facts.tools} badges={evaluateBadges(facts)} fx={fxs.fx} canEditOrgFx={fxs.canEditOrg} />
}
