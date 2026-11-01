// ドヤポップアップ 案の編集（サーバ側で初期表示のデータを取る。§11）
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPopupUserId } from '@/lib/popup/access'
import { getPopupForEdit } from '@/lib/popup/popup-read'
import { isId } from '@/lib/popup/schema'
import { ForbiddenState } from '@/components/popup/ui'
import EditClient from './EditClient'

type Props = { params: Promise<{ id: string }> }

export default async function PopupEditPage({ params }: Props) {
  const { id } = await params
  const userId = await getPopupUserId()
  if (!userId) redirect(`/auth/signin?callbackUrl=/popup/edit/${encodeURIComponent(id)}`)
  const data = isId(id) ? await getPopupForEdit(prisma, userId, id) : null
  if (!data) {
    return (
      <div className="pd-page mx-auto max-w-3xl px-4 py-12 md:px-8">
        <ForbiddenState what="ポップアップ" />
      </div>
    )
  }
  return <EditClient initialPopup={data.popup} site={data.site} />
}
