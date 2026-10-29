'use client'

import { useState, useEffect, useId } from 'react'
import { useRouter } from 'next/navigation'
import { updateTask, deleteTask } from '@/lib/promane/actions-tasks'
import { Button } from '@/components/promane/ui/button'
import { Input } from '@/components/promane/ui/input'
import { X, Save, Trash2, ClipboardList, Loader, Eye, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import { useConfirm } from '@/components/promane/confirm-dialog'
import { userErrorMessage } from '@/lib/promane/user-error'

interface TaskEditModalProps {
  canWrite: boolean
  workspaceSlug: string
  open: boolean
  onClose: () => void
  task: {
    id: string
    title: string
    description: string | null
    status: string
    priority: string
    assigneeId: string | null
    startDate: Date | string | null
    dueDate: Date | string | null
  }
  members: { id: string; displayName: string }[]
}

const STATUS_OPTIONS = [
  { value: 'todo', label: '未着手', icon: ClipboardList, color: 'bg-gray-100 text-gray-700' },
  { value: 'in_progress', label: '進行中', icon: Loader, color: 'bg-blue-100 text-blue-700' },
  { value: 'review', label: 'レビュー', icon: Eye, color: 'bg-amber-100 text-amber-700' },
  { value: 'done', label: '完了', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'のんびり' },
  { value: 'medium', label: 'ふつう' },
  { value: 'high', label: 'いそぎ' },
  { value: 'urgent', label: '超キンキュウ' },
]

function toDateInput(d: Date | string | null): string {
  if (!d) return ''
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return ''
  return dt.toISOString().split('T')[0]
}

export function TaskEditModal({ workspaceSlug, open, onClose, task, members, canWrite }: TaskEditModalProps) {
  const router = useRouter()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [status, setStatus] = useState(task.status)
  const [priority, setPriority] = useState(task.priority)
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || '')
  const [startDate, setStartDate] = useState(toDateInput(task.startDate))
  const [dueDate, setDueDate] = useState(toDateInput(task.dueDate))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { confirm, ConfirmDialog } = useConfirm()

  // task が変わったらフォーム再初期化
  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description || '')
    setStatus(task.status)
    setPriority(task.priority)
    setAssigneeId(task.assigneeId || '')
    setStartDate(toDateInput(task.startDate))
    setDueDate(toDateInput(task.dueDate))
  }, [task])

  const titleId = useId()
  // Esc で閉じる（共通の確認ダイアログが開いている間は、そちらが Esc を受ける）
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || saving || deleting) return
      if (document.querySelector('dialog[open]')) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, saving, deleting, onClose])

  if (!open) return null

  const handleSave = async () => {
    if (!canWrite) return
    if (!title.trim()) {
      toast.error('タスク名を入力してください')
      return
    }
    if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
      toast.error('終了日は開始日以降を指定してください', {
        icon: <Image src="/character/error.png" alt="" width={28} height={28} unoptimized />,
      })
      return
    }
    setSaving(true)
    try {
      await updateTask(workspaceSlug, task.id, {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        assigneeId: assigneeId || null,
        startDate: startDate || null,
        dueDate: dueDate || null,
      })
      toast.success('タスクを更新しました', {
        icon: <Image src="/character/thumbsup.png" alt="" width={28} height={28} unoptimized />,
      })
      router.refresh()
      onClose()
    } catch (e: any) {
      toast.error(userErrorMessage(e?.message, '更新できませんでした。少し待って、もう一度お試しください。'), {
        icon: <Image src="/character/error.png" alt="" width={28} height={28} unoptimized />,
        duration: 5000,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!canWrite) return
    const ok = await confirm({
      title: 'このタスクを削除しますか？',
      message: `「${task.title}」を削除します。元に戻せません。`,
      tone: 'danger',
      confirmLabel: '削除する',
      icon: '/character/surprise.png',
    })
    if (!ok) return
    setDeleting(true)
    try {
      await deleteTask(workspaceSlug, task.id)
      toast.success('タスクを削除しました')
      router.refresh()
      onClose()
    } catch (e: any) {
      toast.error(userErrorMessage(e?.message, '削除できませんでした。少し待って、もう一度お試しください。'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <Image src="/character/working.png" alt="" width={40} height={40} unoptimized />
            <div>
              <h2 id={titleId} className="text-[18px] font-black text-gray-900">{canWrite ? "タスク編集" : "タスク詳細"}</h2>
              <p className="text-[11px] text-gray-400 font-bold">{canWrite ? "変更を加えて保存" : "閲覧専用"}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="閉じる" className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* タイトル */}
          <div>
            <label className="block text-[12px] font-black text-gray-700 mb-1.5">タスク名 <span className="text-rose-500">*</span></label>
            <Input readOnly={!canWrite} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="h-11 rounded-xl text-[14px] font-bold" />
          </div>

          {/* 説明 */}
          <div>
            <label className="block text-[12px] font-black text-gray-700 mb-1.5">詳細・メモ</label>
            <textarea
              readOnly={!canWrite}
              value={description}
              maxLength={5000}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              placeholder="タスクの内容や注意点など"
            />
          </div>

          {/* ステータス */}
          <div>
            <label className="block text-[12px] font-black text-gray-700 mb-1.5">ステータス</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  disabled={!canWrite}
                  onClick={() => setStatus(s.value)}
                  className={`py-2.5 rounded-xl text-[12px] font-black transition-all ${
                    status === s.value
                      ? `${s.color} ring-2 ring-offset-1 ring-blue-400`
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <s.icon className="mr-1 inline-block h-4 w-4 -mt-0.5" aria-hidden />{s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 優先度 */}
          <div>
            <label className="block text-[12px] font-black text-gray-700 mb-1.5">優先度</label>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  disabled={!canWrite}
                  onClick={() => setPriority(p.value)}
                  className={`py-2.5 rounded-xl text-[12px] font-black transition-all ${
                    priority === p.value
                      ? 'bg-brand-50 text-brand-600 ring-2 ring-offset-1 ring-brand-300'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 担当者 */}
          <div>
            <label className="block text-[12px] font-black text-gray-700 mb-1.5">担当者</label>
            <select
              disabled={!canWrite}
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">未割当</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          </div>

          {/* 日付 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-black text-gray-700 mb-1.5">開始日</label>
              <Input readOnly={!canWrite} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 rounded-xl text-[13px] font-bold" />
            </div>
            <div>
              <label className="block text-[12px] font-black text-gray-700 mb-1.5">終了日</label>
              <Input readOnly={!canWrite} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-11 rounded-xl text-[13px] font-bold" />
            </div>
          </div>

          {/* 注意書き */}
          {startDate && dueDate && new Date(dueDate) < new Date(startDate) && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
              <p className="flex items-center gap-1 text-[12px] text-rose-700 font-bold">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />終了日が開始日より前です。日付を直すと保存できます。
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
          {canWrite && <Button
            onClick={handleDelete}
            disabled={deleting || saving}
            variant="ghost"
            className="text-rose-500 hover:bg-rose-50 hover:text-rose-700 font-black rounded-full"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            削除
          </Button>}
          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" className="rounded-full font-black">
              {canWrite ? "キャンセル" : "閉じる"}
            </Button>
            {canWrite && <Button
              onClick={handleSave}
              disabled={saving || deleting || !title.trim()}
              className="rounded-full font-black bg-gradient-to-r from-blue-500 to-brand-500 hover:from-blue-600 hover:to-brand-600 shadow-md"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? '保存中...' : '保存'}
            </Button>}
          </div>
        </div>
      </div>
      <ConfirmDialog />
    </div>
  )
}
