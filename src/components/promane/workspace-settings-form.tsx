'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/promane/ui/button'
import { Input } from '@/components/promane/ui/input'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

interface Props {
  workspace: { id: string; name: string; slug: string }
  canEdit: boolean
  currentSlug: string
}

export function WorkspaceSettingsForm({ workspace, canEdit, currentSlug }: Props) {
  const router = useRouter()
  const [name, setName] = useState(workspace.name)
  const [slug, setSlug] = useState(workspace.slug)
  const [saving, setSaving] = useState(false)

  const changed = name !== workspace.name || slug !== workspace.slug

  async function handleSave() {
    if (!canEdit) return
    if (!name.trim()) {
      toast.error('ワークスペース名は必須です')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/promane/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name !== workspace.name ? name.trim() : undefined,
          slug: slug !== workspace.slug ? slug.trim() : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || '保存に失敗しました', { duration: 6000 })
        return
      }
      toast.success('ワークスペース設定を保存しました ✓')
      // slug が変わった場合は新URLにリダイレクト
      if (data.workspace?.slug && data.workspace.slug !== currentSlug) {
        router.push(`/promane/${data.workspace.slug}/settings`)
      } else {
        router.refresh()
      }
    } catch (e: any) {
      toast.error(e?.message || '通信エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[13px] font-bold text-gray-500 mb-1.5">
          ワークスペース名 {!canEdit && <span className="text-gray-300">（編集権限なし）</span>}
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!canEdit}
          maxLength={100}
          className="h-12 rounded-2xl text-[15px] font-bold disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-[13px] font-bold text-gray-500 mb-1.5">
          スラッグ（URL用）
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-gray-400">/promane/</span>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            disabled={!canEdit}
            pattern="^[a-z0-9][a-z0-9-]{2,49}$"
            minLength={3}
            maxLength={50}
            className="h-12 rounded-2xl text-[15px] font-bold disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>
        <p className="text-[11px] text-gray-400 font-bold mt-1">
          半角英数字とハイフン (3〜50文字)。変更するとURLが変わります
        </p>
      </div>

      {canEdit && (
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={!changed || saving}
            className="rounded-full font-black bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 shadow-md disabled:opacity-40"
          >
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      )}
    </div>
  )
}
