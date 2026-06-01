'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { LOGO_POSITIONS } from '@/lib/doyaslide/constants'

interface Slide {
  id: string
  index: number
  role: string | null
  headline: string | null
  subText: string | null
  imageUrl: string | null
  rawImageUrl: string | null
  status: string
  version: number
}
interface Project {
  id: string
  title: string
  status: string
  aspectRatio: string
  logoUrl: string | null
  logoPosition: string
  logoSize: string
  logoBackingChip: boolean
  slides: Slide[]
}

function aspectClass(a: string) {
  if (a === 'square') return 'aspect-square'
  if (a === 'vertical') return 'aspect-[2/3]'
  return 'aspect-[3/2]'
}

function EditorInner() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const id = params?.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [chat, setChat] = useState<Record<string, { role: string; content: string }[]>>({})
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const triggered = useRef(false)

  const slides = project?.slides || []
  const selected = slides.find((s) => s.id === selectedId) || slides[0] || null

  const reload = useCallback(async () => {
    const res = await fetch(`/api/doyaslide/projects/${id}`)
    if (!res.ok) {
      setLoading(false)
      return null
    }
    const d = await res.json()
    setProject(d.project)
    setSelectedId((prev) => prev || d.project.slides[0]?.id || null)
    setLoading(false)
    return d.project as Project
  }, [id])

  const runGenerate = useCallback(async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/doyaslide/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, onlyPending: true }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '生成に失敗しました')
      if (d.errorCount > 0) toast.error(`${d.errorCount}枚の生成に失敗しました（再生成できます）`)
      else toast.success('スライドが完成しました！')
      await reload()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setGenerating(false)
    }
  }, [id, reload])

  useEffect(() => {
    ;(async () => {
      const p = await reload()
      if (!p) return
      if (search.get('generate') === '1' && !triggered.current) {
        triggered.current = true
        router.replace(`/doyaslide/${id}`)
        if (p.slides.some((s) => !s.imageUrl)) runGenerate()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const regenerate = async (slideId: string) => {
    setChatBusy(true)
    try {
      const res = await fetch(`/api/doyaslide/slides/${slideId}/regenerate`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '再生成に失敗しました')
      toast.success('再生成しました')
      await reload()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setChatBusy(false)
    }
  }

  const sendChat = async () => {
    if (!selected || !chatInput.trim()) return
    const msg = chatInput.trim()
    const sid = selected.id
    setChat((c) => ({ ...c, [sid]: [...(c[sid] || []), { role: 'user', content: msg }] }))
    setChatInput('')
    setChatBusy(true)
    try {
      const res = await fetch(`/api/doyaslide/slides/${sid}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '修正に失敗しました')
      setChat((c) => ({ ...c, [sid]: [...(c[sid] || []), { role: 'assistant', content: d.reply || '修正しました' }] }))
      await reload()
    } catch (e: any) {
      toast.error(e.message)
      setChat((c) => ({ ...c, [sid]: [...(c[sid] || []), { role: 'assistant', content: 'エラー: ' + e.message }] }))
    } finally {
      setChatBusy(false)
    }
  }

  const saveLogoConfig = async (patch: any) => {
    const res = await fetch(`/api/doyaslide/projects/${id}/logo-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      toast.success('ロゴ設定を更新しました')
      await reload()
    } else {
      toast.error('更新に失敗しました')
    }
  }

  if (loading) {
    return <div className="p-10 text-slate-400 font-bold">読み込み中...</div>
  }
  if (!project) {
    return (
      <div className="p-10 text-center">
        <p className="font-black text-slate-700 mb-3">プロジェクトが見つかりません</p>
        <Link href="/doyaslide" className="text-fuchsia-600 font-bold">一覧に戻る</Link>
      </div>
    )
  }

  const ac = aspectClass(project.aspectRatio)
  const chatLog = selected ? chat[selected.id] || [] : []

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      {/* header */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/doyaslide" className="text-slate-400 hover:text-slate-700">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-xl font-black text-slate-900 truncate">{project.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/doyaslide/export?projectId=${id}&format=pdf`}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white text-slate-700 font-bold text-sm shadow-sm hover:shadow"
          >
            <span className="material-symbols-outlined text-lg">picture_as_pdf</span>PDF
          </a>
          <a
            href={`/api/doyaslide/export?projectId=${id}&format=zip`}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white text-slate-700 font-bold text-sm shadow-sm hover:shadow"
          >
            <span className="material-symbols-outlined text-lg">folder_zip</span>ZIP
          </a>
          <button
            onClick={runGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-bold text-sm shadow disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-lg">{generating ? 'progress_activity' : 'bolt'}</span>
            {generating ? '生成中...' : '未生成を生成'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_320px] gap-4">
        {/* thumbnails */}
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:max-h-[80vh] pb-2">
          {slides.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`flex-shrink-0 w-32 lg:w-full rounded-xl overflow-hidden border-2 transition-all ${
                selected?.id === s.id ? 'border-fuchsia-500' : 'border-transparent hover:border-slate-200'
              }`}
            >
              <div className={`${ac} bg-slate-100 flex items-center justify-center relative`}>
                {s.imageUrl ? (
                  <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : s.status === 'generating' ? (
                  <span className="material-symbols-outlined animate-spin text-slate-400">progress_activity</span>
                ) : (
                  <span className="text-xs font-bold text-slate-400">{s.index}</span>
                )}
                <span className="absolute top-1 left-1 text-[10px] font-black bg-black/50 text-white rounded px-1">
                  {s.index}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* preview */}
        <div>
          <div className={`${ac} bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg`}>
            {generating && selected && !selected.imageUrl ? (
              <div className="text-center text-white/80">
                <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
                <p className="font-bold mt-2">生成中...</p>
              </div>
            ) : selected?.imageUrl ? (
              <img src={selected.imageUrl} alt={selected.headline || ''} className="w-full h-full object-contain" />
            ) : (
              <div className="text-center text-white/50">
                <p className="font-bold">未生成</p>
              </div>
            )}
          </div>
          {selected && (
            <div className="mt-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-black text-slate-800 truncate">{selected.headline || `スライド ${selected.index}`}</p>
                <p className="text-xs text-slate-400 font-bold truncate">{selected.role} ・ v{selected.version}</p>
              </div>
              <button
                onClick={() => regenerate(selected.id)}
                disabled={chatBusy}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white text-slate-700 font-bold text-sm shadow-sm hover:shadow disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-lg">refresh</span>このスライドを再生成
              </button>
            </div>
          )}
        </div>

        {/* right panel: chat + logo */}
        <div className="space-y-4">
          {/* chat */}
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col h-[420px]">
            <p className="font-black text-slate-800 text-sm mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-fuchsia-600 text-lg">chat</span>
              チャットで修正
            </p>
            <div className="flex-1 overflow-y-auto space-y-2 mb-2">
              {chatLog.length === 0 && (
                <p className="text-xs text-slate-400 font-bold">
                  例: 「もっと青くして」「背景を夜景に」「見出しを短く」「ロゴを左下に」
                </p>
              )}
              {chatLog.map((m, i) => (
                <div
                  key={i}
                  className={`text-sm rounded-2xl px-3 py-2 max-w-[90%] ${
                    m.role === 'user'
                      ? 'bg-fuchsia-100 text-fuchsia-900 ml-auto'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {chatBusy && (
                <div className="text-sm bg-slate-100 text-slate-500 rounded-2xl px-3 py-2 inline-flex items-center gap-1">
                  <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>修正中...
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !chatBusy && sendChat()}
                placeholder="修正を入力..."
                disabled={chatBusy || !selected}
                className="flex-1 px-3 py-2 bg-slate-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
              />
              <button
                onClick={sendChat}
                disabled={chatBusy || !selected}
                className="px-3 py-2 rounded-xl bg-fuchsia-600 text-white disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">send</span>
              </button>
            </div>
          </div>

          {/* logo config */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="font-black text-slate-800 text-sm mb-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-fuchsia-600 text-lg">branding_watermark</span>
              ロゴ設定
            </p>
            {project.logoUrl ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">位置</label>
                  <select
                    value={project.logoPosition}
                    onChange={(e) => saveLogoConfig({ logoPosition: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 rounded-xl text-sm"
                  >
                    {LOGO_POSITIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">サイズ</label>
                  <div className="flex gap-2">
                    {['S', 'M', 'L'].map((sz) => (
                      <button
                        key={sz}
                        onClick={() => saveLogoConfig({ logoSize: sz })}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold ${
                          project.logoSize === sz ? 'bg-fuchsia-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={project.logoBackingChip}
                    onChange={(e) => saveLogoConfig({ logoBackingChip: e.target.checked })}
                  />
                  背景チップ（視認性UP）
                </label>
                <p className="text-[11px] text-slate-400">変更すると全スライドに即時反映されます</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 font-bold">
                ロゴは未設定です。新規作成時にアップロードできます。
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DoyaSlideEditorPage() {
  return (
    <Suspense fallback={<div className="p-10 text-slate-400 font-bold">読み込み中...</div>}>
      <EditorInner />
    </Suspense>
  )
}
