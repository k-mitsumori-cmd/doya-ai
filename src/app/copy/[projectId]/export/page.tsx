'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Download, CheckSquare, Square, FileText } from 'lucide-react'

interface CopyItem {
  id: string
  writerType: string
  appealAxis: string
  headline: string
  description: string
  catchcopy: string
  cta: string
  type: string
  platform: string
  isFavorite: boolean
}

interface CopyProject {
  id: string
  name: string
  copies: CopyItem[]
}

export default function CopyExportPage({ params }: { params: { projectId: string } }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [project, setProject] = useState<CopyProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [exportFormat, setExportFormat] = useState<'generic' | 'google' | 'yahoo'>('generic')
  const [exporting, setExporting] = useState(false)

  const userId = (session?.user as any)?.id

  useEffect(() => {
    fetchProject()
  }, [params.projectId])

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/copy/projects/${params.projectId}`)
      if (res.ok) {
        const data = await res.json()
        setProject(data.project)
        // デフォルト全選択
        setSelected(new Set(data.project.copies.map((c: CopyItem) => c.id)))
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (!project) return
    if (selected.size === project.copies.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(project.copies.map(c => c.id)))
    }
  }

  const handleExport = async () => {
    if (!project || selected.size === 0) return
    setExporting(true)
    try {
      const res = await fetch('/api/copy/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          format: exportFormat,
          copyIds: Array.from(selected),
        }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${project.name}_copies.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // ignore
    } finally {
      setExporting(false)
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
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Download className="w-6 h-6 text-amber-400" />
            エクスポート
          </h1>
          <p className="text-gray-500 text-sm mt-1">{project.name}</p>
        </div>

        {/* フォーマット選択 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            エクスポート形式
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'generic', label: '汎用CSV', desc: '全項目を出力' },
              { value: 'google', label: 'Google広告', desc: 'インポート対応' },
              { value: 'yahoo', label: 'Yahoo!広告', desc: 'インポート対応' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setExportFormat(f.value as any)}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  exportFormat === f.value
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <p className="text-sm font-bold text-gray-900">{f.label}</p>
                <p className="text-xs text-gray-500">{f.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* コピー選択 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">コピーを選択 ({selected.size}/{project.copies.length})</h2>
            <button onClick={toggleAll} className="text-sm text-amber-600 hover:text-amber-500">
              {selected.size === project.copies.length ? 'すべて解除' : 'すべて選択'}
            </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {project.copies.map((copy) => (
              <button
                key={copy.id}
                onClick={() => toggleSelect(copy.id)}
                className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                {selected.has(copy.id) ? (
                  <CheckSquare className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{copy.headline}</p>
                  <p className="text-xs text-gray-500 truncate">{copy.writerType} · {copy.appealAxis}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting || selected.size === 0}
          className="w-full flex items-center justify-center gap-2 py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-black rounded-xl transition-colors"
        >
          <Download className="w-5 h-5" />
          {exporting ? 'エクスポート中...' : `${selected.size}件をCSVエクスポート`}
        </button>
      </div>
    </div>
  )
}
