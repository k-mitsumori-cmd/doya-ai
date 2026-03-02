'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Download, Smartphone, Monitor, Tablet,
  Loader2, ArrowLeft, Pencil, Trash2
} from 'lucide-react'

interface Section {
  id: string
  order: number
  type: string
  name: string
  headline?: string | null
  subheadline?: string | null
  body?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
  items?: Array<{ title?: string; description?: string }> | null
}

interface Project {
  id: string
  name: string
  themeId: string
  status: string
  sections: Section[]
  productInfo?: any
  purpose?: string[]
  createdAt: string
}

type Device = 'desktop' | 'tablet' | 'mobile'

const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
}

export default function LpPreviewPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [device, setDevice] = useState<Device>('desktop')
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [htmlLoading, setHtmlLoading] = useState(false)

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/lp/projects/${projectId}`)
      const data = await res.json()
      if (data.project) setProject(data.project)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  useEffect(() => {
    if (!project || project.sections.length === 0) return
    setHtmlLoading(true)
    fetch('/api/lp/export-html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })
      .then(r => {
        if (!r.ok) throw new Error('HTMLの生成に失敗しました')
        return r.text()
      })
      .then(html => setPreviewHtml(html))
      .catch(console.error)
      .finally(() => setHtmlLoading(false))
  }, [project, projectId])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/lp/export-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as any).error || 'HTMLエクスポートに失敗しました')
      }
      const html = await res.text()
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project?.name || 'lp'}.html`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(e.message || 'エクスポートに失敗しました')
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`「${project?.name}」を削除しますか？この操作は取り消せません。`)) return
    setDeleting(true)
    try {
      await fetch(`/api/lp/projects/${projectId}`, { method: 'DELETE' })
      router.push('/lp')
    } catch (e: any) {
      alert(e.message || '削除に失敗しました')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-6">
        <p className="text-slate-400 mb-4">プロジェクトが見つかりません</p>
        <button onClick={() => router.push('/lp')} className="text-cyan-400 hover:text-cyan-300">
          ダッシュボードに戻る
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
      {/* トップバー */}
      <div className="flex-shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-4">
        <button
          onClick={() => router.push('/lp')}
          className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-white truncate">{project.name}</h1>
          <p className="text-xs text-slate-500">{project.sections.length}セクション · テーマ: {project.themeId}</p>
        </div>

        {/* デバイス切り替え */}
        <div className="hidden md:flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([d, Icon]) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className={`p-2 rounded-md transition-colors ${device === d ? 'bg-cyan-500 text-slate-950' : 'text-slate-500 hover:text-white'}`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* アクションボタン */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/lp/new/copy?projectId=${projectId}`)}
            className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-2 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            編集
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 text-sm bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold rounded-lg px-4 py-2 transition-colors"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden sm:inline">HTMLダウンロード</span>
            <span className="sm:hidden">DL</span>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 text-slate-600 hover:text-red-400 transition-colors"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* プレビューエリア */}
      <div className="flex-1 overflow-auto bg-slate-800 flex items-start justify-center p-4 md:p-8">
        {htmlLoading ? (
          <div className="flex items-center justify-center w-full h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">プレビューを生成中...</p>
            </div>
          </div>
        ) : previewHtml ? (
          <motion.div
            key={device}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white shadow-2xl rounded-lg overflow-hidden transition-all duration-300"
            style={{
              width: DEVICE_WIDTHS[device],
              maxWidth: '100%',
              minHeight: '600px',
            }}
          >
            <iframe
              srcDoc={previewHtml}
              className="w-full"
              style={{ height: '80vh', border: 'none' }}
              title="LP Preview"
            />
          </motion.div>
        ) : (
          <div className="text-center text-slate-500 py-16">
            <p>プレビューを読み込めませんでした</p>
          </div>
        )}
      </div>

      {/* モバイルデバイス切り替え */}
      <div className="md:hidden flex-shrink-0 bg-slate-900 border-t border-slate-800 flex justify-center gap-4 py-3">
        {([['desktop', Monitor, 'PC'], ['tablet', Tablet, 'タブレット'], ['mobile', Smartphone, 'スマホ']] as const).map(([d, Icon, label]) => (
          <button
            key={d}
            onClick={() => setDevice(d)}
            className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-colors ${device === d ? 'text-cyan-400' : 'text-slate-500'}`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>

      {/* セクション一覧（サイドパネル風・デスクトップのみ） */}
      {project.sections.length > 0 && (
        <div className="hidden xl:flex flex-col fixed right-4 top-1/2 -translate-y-1/2 bg-slate-900 border border-slate-800 rounded-xl p-3 gap-1 max-h-96 overflow-y-auto">
          <p className="text-xs text-slate-500 font-medium mb-1 px-1">セクション</p>
          {project.sections.map((sec, i) => (
            <div key={sec.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 cursor-default">
              <span className="text-xs text-slate-600 w-4 text-center">{i + 1}</span>
              <span className="text-xs text-slate-400 truncate max-w-[120px]">{sec.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
