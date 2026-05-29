'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/promane/ui/button'
import { Input } from '@/components/promane/ui/input'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'

export function CreateWorkspaceButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/promane/workspaces/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || '作成に失敗しました', { duration: 6000 })
        return
      }
      toast.success(`「${data.workspace.name}」を作成しました 🎉`)
      setOpen(false)
      setName('')
      router.push(`/promane/${data.workspace.slug}`)
    } catch (e: any) {
      toast.error(e?.message || '通信エラー')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="rounded-full h-11 px-5 text-[14px] font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-md hover:scale-105 transition-all"
      >
        <Plus className="mr-1.5 h-4 w-4" />
        新規ワークスペース作成
      </Button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-black text-gray-900">新規ワークスペース</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div>
              <label className="block text-[12px] font-black text-gray-700 mb-1.5">
                ワークスペース名 <span className="text-rose-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: マイ会社 / 顧客プロジェクト"
                maxLength={100}
                autoFocus
                className="h-12 rounded-xl text-[14px] font-bold"
              />
              <p className="text-[11px] text-gray-400 font-bold mt-1">作成後、設定からスラッグも変更できます</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setOpen(false)} variant="outline" className="rounded-full font-black">
                キャンセル
              </Button>
              <Button
                type="submit"
                disabled={creating || !name.trim()}
                className="rounded-full font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-md"
              >
                {creating ? '作成中...' : '作成 🚀'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
