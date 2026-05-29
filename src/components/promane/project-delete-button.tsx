'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/promane/ui/button'
import { deleteProject } from '@/lib/promane/actions-projects'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/promane/confirm-dialog'

export function ProjectDeleteButton({
  workspaceSlug,
  projectId,
  projectName,
}: {
  workspaceSlug: string
  projectId: string
  projectName: string
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const { confirm, ConfirmDialog } = useConfirm()

  async function handleDelete() {
    const ok = await confirm({
      title: 'プロジェクトを削除',
      message: `「${projectName}」を削除しますか？\n関連するタスク・経費もすべて削除されます。\nこの操作は取り消せません。`,
      tone: 'danger',
      confirmLabel: '削除する',
      icon: '/character/error.png',
    })
    if (!ok) return
    setDeleting(true)
    try {
      await deleteProject(workspaceSlug, projectId)
      toast.success('プロジェクトを削除しました')
      router.push(`/promane/${workspaceSlug}/projects`)
    } catch (e: any) {
      toast.error(e?.message || '削除に失敗しました', { duration: 6000 })
      setDeleting(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={handleDelete}
        disabled={deleting}
        className="rounded-2xl font-bold text-[14px] h-10 px-3 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
      >
        <Trash2 className="mr-1.5 h-4 w-4" />
        {deleting ? '削除中...' : '削除'}
      </Button>
      <ConfirmDialog />
    </>
  )
}
