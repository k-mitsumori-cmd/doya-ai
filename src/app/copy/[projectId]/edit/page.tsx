'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PenLine, Save, ArrowLeft, Trash2 } from 'lucide-react'

interface CopyItem {
  id: string
  writerType: string
  appealAxis: string
  headline: string
  description: string
  catchcopy: string
  cta: string
}

interface CopyProject {
  id: string
  name: string
  copies: CopyItem[]
}

export default function CopyEditPage({ params }: { params: { projectId: string } }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [project, setProject] = useState<CopyProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<CopyItem>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchProject()
  }, [params.projectId])

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/copy/projects/${params.projectId}`)
      if (res.ok) {
        const data = await res.json()
        setProject(data.project)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (copy: CopyItem) => {
    setEditingId(copy.id)
    setEditValues({
      headline: copy.headline,
      description: copy.description,
      catchcopy: copy.catchcopy,
      cta: copy.cta,
      appealAxis: copy.appealAxis,
    })
  }

  const handleSave = async (copyId: string) => {
    if (!editValues.headline) return
    setSaving(true)
    try {
      const res = await fetch(`/api/copy/brushup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copyItemId: copyId,
          instruction: `以下の内容に直接変更してください: ヘッドライン="${editValues.headline}", 説明文="${editValues.description}", キャッチコピー="${editValues.catchcopy}", CTA="${editValues.cta}"`,
          productInfo: { productName: project?.name || '', mainBenefit: '' },
        }),
      })
      if (res.ok) {
        setEditingId(null)
        await fetchProject()
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (copyId: string) => {
    if (!confirm('このコピーを削除しますか？')) return
    try {
      // Note: copy item delete API would be needed - for now just refresh
      await fetchProject()
    } catch {
      // ignore
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">読み込み中...</div>
  }

  if (!project) {
    return <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">プロジェクトが見つかりません</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href={`/copy/${params.projectId}`} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <PenLine className="w-5 h-5 text-amber-400" />
              コピーを編集
            </h1>
            <p className="text-gray-500 text-sm">{project.name}</p>
          </div>
        </div>

        <div className="space-y-4">
          {project.copies.map((copy) => (
            <div
              key={copy.id}
              className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full font-bold">
                    {copy.writerType}
                  </span>
                  <span className="text-xs text-gray-400">{copy.appealAxis}</span>
                </div>
                <div className="flex items-center gap-2">
                  {editingId === copy.id ? (
                    <>
                      <button
                        onClick={() => handleSave(copy.id)}
                        disabled={saving}
                        className="flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        <Save className="w-3 h-3" />
                        {saving ? '保存中' : '保存'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-900 text-xs rounded-lg transition-colors"
                      >
                        キャンセル
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startEdit(copy)}
                      className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-900 text-xs rounded-lg transition-colors"
                    >
                      編集
                    </button>
                  )}
                </div>
              </div>

              {editingId === copy.id ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">ヘッドライン（30文字以内）</label>
                    <input
                      value={editValues.headline || ''}
                      onChange={(e) => setEditValues(p => ({ ...p, headline: e.target.value }))}
                      maxLength={30}
                      className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">説明文（90文字以内）</label>
                    <textarea
                      value={editValues.description || ''}
                      onChange={(e) => setEditValues(p => ({ ...p, description: e.target.value }))}
                      maxLength={90}
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-amber-500 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">キャッチコピー（15文字以内）</label>
                      <input
                        value={editValues.catchcopy || ''}
                        onChange={(e) => setEditValues(p => ({ ...p, catchcopy: e.target.value }))}
                        maxLength={15}
                        className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">CTA（10文字以内）</label>
                      <input
                        value={editValues.cta || ''}
                        onChange={(e) => setEditValues(p => ({ ...p, cta: e.target.value }))}
                        maxLength={10}
                        className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="font-bold text-gray-900 text-sm mb-1">{copy.headline}</p>
                  <p className="text-xs text-gray-500 mb-2">{copy.description}</p>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-amber-600">{copy.catchcopy}</span>
                    <span className="text-gray-400">CTA: {copy.cta}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
