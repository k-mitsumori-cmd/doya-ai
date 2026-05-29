'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/promane/ui/button'
import { deleteProject } from '@/lib/promane/actions-projects'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

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

  async function handleDelete() {
    if (!confirm(`「${projectName}」を削除しますか？\n関連するタスク・経費もすべて削除されます。`)) return
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
    <Button
      variant="ghost"
      onClick={handleDelete}
      disabled={deleting}
      className="rounded-2xl font-bold text-[14px] h-10 px-3 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
    >
      <Trash2 className="mr-1.5 h-4 w-4" />
      {deleting ? '削除中...' : '削除'}
    </Button>
  )
}
