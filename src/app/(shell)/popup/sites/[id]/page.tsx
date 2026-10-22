// ドヤポップアップ サイト詳細（サーバ側で初期表示のデータを取る。§11）
// ⚠️ 他人のサイト・削除したサイトは「表示できません」を出す（存在するかどうかは区別しない）
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPopupUserId } from '@/lib/popup/access'
import { getSiteDetail } from '@/lib/popup/popup-read'
import { isId } from '@/lib/popup/schema'
import { ForbiddenState } from '@/components/popup/ui'
import SiteDetailClient from './SiteDetailClient'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }

export default async function SiteDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const userId = await getPopupUserId()
  if (!userId) redirect(`/auth/signin?callbackUrl=/popup/sites/${encodeURIComponent(id)}`)
  const detail = isId(id) ? await getSiteDetail(prisma, userId, id, 30) : null
  if (!detail) {
    return (
      <div className="pd-page mx-auto max-w-3xl px-4 py-12 md:px-8">
        <ForbiddenState what="サイト" />
      </div>
    )
  }
  return <SiteDetailClient key={`${userId}:${id}`} initial={detail} serverActorId={userId} created={sp.created === '1'} />
}
