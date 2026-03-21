'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  Download, Smartphone, Monitor, Tablet,
  Loader2, ArrowLeft, Pencil, Trash2, AlertTriangle,
  LayoutTemplate, ImageDown, LogIn, Lock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { generateWireframeSvg } from '@/lib/lp/wireframe'
import type { LpSectionDef } from '@/lib/lp/types'

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
  structures?: any[]
  selectedStructure?: number
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
  const { data: session, status: sessionStatus } = useSession()
  const projectId = params.projectId as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [device, setDevice] = useState<Device>('desktop')
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [htmlLoading, setHtmlLoading] = useState(false)
  const [capturingImage, setCapturingImage] = useState(false)
  const [downloadingWireframe, setDownloadingWireframe] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const loadProject = useCallback(async () => {
    setLoadError('')
    try {
      const res = await fetch(`/api/lp/projects/${projectId}`)
      if (!res.ok) throw new Error(res.status === 404 ? 'プロジェクトが見つかりません' : 'プロジェクトの取得に失敗しました')
      const data = await res.json()
      if (data.project) setProject(data.project)
    } catch (e: any) {
      setLoadError(e.message || 'プロジェクトの取得に失敗しました')
      toast.error(e.message || 'プロジェクトの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    loadProject()
  }, [loadProject, sessionStatus])

  useEffect(() => {
    if (!project || project.sections.length === 0) return
    setHtmlLoading(true)
    fetch('/api/lp/export-html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, mode: 'preview' }),
    })
      .then(r => {
        if (!r.ok) throw new Error('HTMLの生成に失敗しました')
        return r.text()
      })
      .then(html => setPreviewHtml(html))
      .catch((e: any) => { toast.error(e.message || 'プレビューの読み込みに失敗しました') })
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
      toast.error(e.message || 'エクスポートに失敗しました')
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/lp/projects/${projectId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      router.push('/lp')
    } catch (e: any) {
      toast.error(e.message || '削除に失敗しました')
      setDeleting(false)
      setDeleteConfirmOpen(false)
    }
  }

  const handleDownloadWireframe = async () => {
    if (!project) return
    setDownloadingWireframe(true)
    try {
      const structureIdx = project.selectedStructure ?? 0
      const structure = project.structures?.[structureIdx]
      const sectionDefs: LpSectionDef[] = structure?.sections || project.sections.map((s) => ({
        type: s.type as any,
        name: s.name,
        purpose: '',
        recommendedContent: [],
        headlineChars: 30,
        bodyChars: 80,
        hasCta: !!s.ctaText,
        heightRatio: s.type === 'hero' ? 1.0 : s.type === 'footer' ? 0.4 : 0.7,
      }))

      const svgStr = generateWireframeSvg(sectionDefs, { width: 800, baseHeight: 200 })

      const img = new Image()
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth * 2
          canvas.height = img.naturalHeight * 2
          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('Canvas context failed')); return }
          ctx.scale(2, 2)
          ctx.drawImage(img, 0, 0)
          URL.revokeObjectURL(svgUrl)

          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('PNG conversion failed')); return }
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `${project.name}-wireframe.png`
            a.click()
            URL.revokeObjectURL(a.href)
            resolve()
          }, 'image/png')
        }
        img.onerror = () => { URL.revokeObjectURL(svgUrl); reject(new Error('SVG load failed')) }
        img.src = svgUrl
      })
    } catch (e: any) {
      toast.error('ワイヤーフレームのダウンロードに失敗しました')
    } finally {
      setDownloadingWireframe(false)
    }
  }

  const handleDownloadLpImage = async () => {
    if (!previewHtml || !project) return
    setCapturingImage(true)
    try {
      const html2canvas = (await import('html2canvas')).default

      const container = document.createElement('div')
      container.style.cssText = 'position:fixed;left:-9999px;top:0;width:1280px;overflow:visible;z-index:-1;'
      document.body.appendChild(container)

      const parser = new DOMParser()
      const doc = parser.parseFromString(previewHtml, 'text/html')

      doc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
        container.appendChild(el.cloneNode(true))
      })

      const tailwindScript = document.createElement('script')
      tailwindScript.src = 'https://cdn.tailwindcss.com'
      container.appendChild(tailwindScript)

      const fontLink = document.createElement('link')
      fontLink.rel = 'stylesheet'
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Noto+Serif+JP:wght@400;700&display=swap'
      container.appendChild(fontLink)

      const bodyContent = document.createElement('div')
      bodyContent.style.cssText = 'font-family:"Noto Sans JP",sans-serif;'
      bodyContent.innerHTML = doc.body.innerHTML
      container.appendChild(bodyContent)

      await new Promise<void>((resolve) => {
        tailwindScript.onload = () => setTimeout(resolve, 500)
        tailwindScript.onerror = () => setTimeout(resolve, 500)
      })

      const canvas = await html2canvas(bodyContent, {
        width: 1280,
        windowWidth: 1280,
        useCORS: true,
        allowTaint: true,
        scale: 1,
        logging: false,
      })

      canvas.toBlob((blob) => {
        if (!blob) { toast.error('画像の生成に失敗しました'); return }
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${project.name}-preview.png`
        a.click()
        URL.revokeObjectURL(a.href)
      }, 'image/png')

      document.body.removeChild(container)
    } catch (e: any) {
      const orphan = document.querySelector('div[style*="left:-9999px"]')
      if (orphan) document.body.removeChild(orphan)
      toast.error('LP画像のダウンロードに失敗しました')
    } finally {
      setCapturingImage(false)
    }
  }

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-lp-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-lp-primary" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-lp-bg flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-lp-primary/20 flex items-center justify-center mb-6">
          <LogIn className="w-8 h-8 text-lp-primary" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">ログインが必要です</h2>
        <p className="text-slate-400 text-sm mb-6">LP作成機能を使うにはログインしてください。</p>
        <button onClick={() => router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/lp/${projectId}`)}`)} className="flex items-center gap-2 bg-lp-primary hover:bg-lp-primary/90 text-lp-bg font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-lp-primary/20">
          <LogIn className="w-4 h-4" /> Googleでログイン
        </button>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-lp-bg flex flex-col items-center justify-center text-center px-6">
        <p className="text-slate-400 mb-4">{loadError || 'プロジェクトが見つかりません'}</p>
        <div className="flex gap-4">
          {loadError && (
            <button onClick={() => { setLoading(true); loadProject() }} className="text-lp-primary hover:text-lp-primary/80 font-bold">
              再読み込み
            </button>
          )}
          <button onClick={() => router.push('/lp')} className="text-slate-400 hover:text-white font-bold">
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-lp-bg text-white overflow-hidden">
      {/* トップバー */}
      <div className="flex-shrink-0 bg-lp-surface/80 backdrop-blur-md border-b border-lp-border px-4 py-3 flex items-center gap-4">
        <button
          onClick={() => router.push('/lp')}
          className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-lp-border transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-white truncate">{project.name}</h1>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">{project.sections.length}セクション · テーマ: {project.themeId}</p>
            <span className="px-2 py-0.5 rounded-full bg-lp-primary/20 text-lp-primary text-[10px] font-bold border border-lp-primary/30">
              {project.status === 'completed' ? '完成' : project.status === 'published' ? '公開中' : '下書き'}
            </span>
          </div>
        </div>

        {/* デバイス切り替え */}
        <div className="hidden md:flex items-center gap-1 bg-lp-bg rounded-lg p-1 border border-lp-border">
          {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([d, Icon]) => (
            <label
              key={d}
              className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${device === d ? 'bg-lp-primary text-lp-bg' : 'text-slate-500 hover:text-white'}`}
            >
              <input
                type="radio"
                name="device"
                value={d}
                checked={device === d}
                onChange={() => setDevice(d)}
                className="hidden"
              />
              <Icon className="w-4 h-4" />
            </label>
          ))}
        </div>

        {/* アクションボタン */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/lp/new/copy?projectId=${projectId}`)}
            className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 hover:text-white bg-lp-primary/10 hover:bg-lp-primary/20 border border-lp-primary/20 rounded-lg px-3 py-2 transition-all font-medium"
          >
            <Pencil className="w-4 h-4" />
            編集
          </button>
          <button
            onClick={handleDownloadWireframe}
            disabled={downloadingWireframe}
            className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 hover:text-white bg-lp-primary/10 hover:bg-lp-primary/20 border border-lp-primary/20 rounded-lg px-3 py-2 transition-all font-medium"
          >
            {downloadingWireframe ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutTemplate className="w-4 h-4" />}
            WF
          </button>
          <button
            onClick={handleDownloadLpImage}
            disabled={capturingImage || !previewHtml}
            className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 hover:text-white bg-lp-primary/10 hover:bg-lp-primary/20 border border-lp-primary/20 rounded-lg px-3 py-2 transition-all font-medium disabled:opacity-40"
          >
            {capturingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageDown className="w-4 h-4" />}
            LP画像
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 text-sm bg-lp-primary hover:bg-lp-primary/90 disabled:opacity-50 text-lp-bg font-bold rounded-lg px-4 py-2 transition-all shadow-lg shadow-lp-primary/20"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden sm:inline">HTML</span>
            <span className="sm:hidden">DL</span>
          </button>
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting}
            className="p-2 text-slate-600 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* プレビューエリア */}
      <div className="flex-1 overflow-auto bg-black/40 flex items-start justify-center p-4 md:p-8">
        {htmlLoading ? (
          <div className="flex items-center justify-center w-full h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-lp-primary mx-auto mb-3" />
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
            {/* ブラウザクローム */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 border-b border-slate-200">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 mx-4 bg-white rounded px-3 py-1 text-[10px] text-slate-400 flex items-center gap-2 border border-slate-200">
                <Lock className="w-3 h-3" /> doya-ai.com/{project.name}
              </div>
            </div>
            <iframe
              ref={iframeRef}
              srcDoc={previewHtml}
              sandbox="allow-scripts"
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
      <div className="md:hidden flex-shrink-0 bg-lp-surface border-t border-lp-border flex justify-center gap-4 py-3">
        {([['desktop', Monitor, 'PC'], ['tablet', Tablet, 'タブレット'], ['mobile', Smartphone, 'スマホ']] as const).map(([d, Icon, label]) => (
          <button
            key={d}
            onClick={() => setDevice(d)}
            className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-colors ${device === d ? 'text-lp-primary border-t-2 border-lp-primary' : 'text-slate-500 hover:text-lp-primary'}`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-bold">{label}</span>
          </button>
        ))}
      </div>

      {/* 削除確認モーダル */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-lp-bg/80 backdrop-blur-sm" onKeyDown={e => { if (e.key === 'Escape') setDeleteConfirmOpen(false) }}>
          <div className="bg-lp-surface border border-red-500/30 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <AlertTriangle className="w-7 h-7" />
              <h3 className="font-bold text-white text-lg">プロジェクトの削除</h3>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              「{project?.name}」を削除しますか？この操作は取り消せません。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 bg-lp-bg hover:bg-lp-border text-slate-300 text-sm font-bold rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
