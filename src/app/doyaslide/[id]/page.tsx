'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { LOGO_POSITIONS, SEC_PER_SLIDE, formatDuration } from '@/lib/doyaslide/constants'

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
interface Version {
  id: string
  version: number
  imageUrl: string
  createdAt: string
}

function aspectClass(a: string) {
  if (a === 'square') return 'aspect-square'
  if (a === 'vertical') return 'aspect-[2/3]'
  return 'aspect-[3/2]'
}

const GEN_MESSAGES = ['もくもく描いてるよ…', 'いい感じ…！🎨', '色を塗ってる…', 'ドヤれる仕上がりに…✨', 'あと少し…！']

function EditorInner() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const id = params?.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [chat, setChat] = useState<Record<string, { role: string; content: string }[]>>({})
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [busySlide, setBusySlide] = useState<string | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [celebrate, setCelebrate] = useState(false)
  const [funIdx, setFunIdx] = useState(0)
  const [limitMsg, setLimitMsg] = useState<string | null>(null)
  const triggered = useRef(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)
  const wasGen = useRef(false)

  const slides = project?.slides || []
  const selected = slides.find((s) => s.id === selectedId) || slides[0] || null
  const doneCount = slides.filter((s) => s.imageUrl).length
  const total = slides.length
  const allDone = total > 0 && doneCount === total
  // 残り枚数に応じた完成までの目安時間（1枚 ≈11秒）
  const etaRemainingSec = Math.max(0, total - doneCount) * SEC_PER_SLIDE

  // 403(上限超過)を検知して常設バナーを出す共通ハンドラ（generate/regenerate/chat で共用）
  const ensureOk = (res: Response, d: any, fallback: string) => {
    if (!res.ok) {
      if (res.status === 403) setLimitMsg(d?.error || '今月の生成枚数の上限に達しました')
      throw new Error(d?.error || fallback)
    }
  }

  const reload = useCallback(async () => {
    const res = await fetch(`/api/doyaslide/projects/${id}`)
    if (!res.ok) {
      setLoading(false)
      return null
    }
    const d = await res.json()
    if (!mountedRef.current) return d.project as Project // アンマウント後はsetStateしない
    setProject(d.project)
    setSelectedId((prev) => prev || d.project.slides[0]?.id || null)
    setLoading(false)
    return d.project as Project
  }, [id])

  const loadVersions = useCallback((slideId: string) => {
    fetch(`/api/doyaslide/slides/${slideId}/revert`)
      .then((r) => r.json())
      .then((d) => {
        if (mountedRef.current) setVersions(d.versions || [])
      })
      .catch(() => {})
  }, [])

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const runGenerate = useCallback(async () => {
    setGenerating(true)
    // 生成中も数秒ごとに再取得してサムネを順次反映
    stopPoll()
    pollRef.current = setInterval(reload, 4000)
    try {
      const res = await fetch('/api/doyaslide/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, onlyPending: true }),
      })
      const d = await res.json()
      ensureOk(res, d, '生成に失敗しました')
      if (d.skipped > 0) {
        setLimitMsg(`今月の残り枚数の都合で${d.skipped}枚はスキップしました（上限${d.limit}枚）。プロにアップグレードで続けて生成できます。`)
        toast(`${d.skipped}枚は今月の上限のためスキップしました`)
      }
      if (d.timedOut > 0) toast(`${d.timedOut}枚は時間切れで未生成です。「未生成を生成」で続きを生成できます`, { icon: '⏳' })
      if (d.errorCount > 0) toast.error(`${d.errorCount}枚の生成に失敗しました（再生成できます）`)
      else if (!d.skipped && !d.timedOut) toast.success('スライドが完成しました！')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      stopPoll()
      await reload()
      if (mountedRef.current) setGenerating(false)
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
    return () => {
      mountedRef.current = false
      stopPoll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 選択スライドのバージョン履歴を取得（スライド切替時のみ。ポーリングでは再取得しない）
  useEffect(() => {
    if (selected) loadVersions(selected.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // 生成中の楽しいメッセージ回し
  useEffect(() => {
    if (!generating) return
    const t = setInterval(() => setFunIdx((i) => (i + 1) % GEN_MESSAGES.length), 1500)
    return () => clearInterval(t)
  }, [generating])

  // 生成完了時にお祝い演出（ドヤくんジャンプ）
  useEffect(() => {
    const justFinished = wasGen.current && !generating
    wasGen.current = generating
    if (justFinished && total > 0 && slides.every((s) => s.imageUrl)) {
      setCelebrate(true)
      const t = setTimeout(() => {
        if (mountedRef.current) setCelebrate(false)
      }, 2600)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating])

  const regenerate = async (slideId: string) => {
    setBusySlide(slideId)
    try {
      const res = await fetch(`/api/doyaslide/slides/${slideId}/regenerate`, { method: 'POST' })
      const d = await res.json()
      ensureOk(res, d, '再生成に失敗しました')
      toast.success('再生成しました')
      await reload()
      loadVersions(slideId)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusySlide(null)
    }
  }

  const revert = async (version: number) => {
    if (!selected) return
    try {
      const res = await fetch(`/api/doyaslide/slides/${selected.id}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      })
      if (!res.ok) throw new Error('巻き戻しに失敗しました')
      toast.success(`v${version} に戻しました`)
      await reload()
      loadVersions(selected.id)
    } catch (e: any) {
      toast.error(e.message)
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
      ensureOk(res, d, '修正に失敗しました')
      setChat((c) => ({ ...c, [sid]: [...(c[sid] || []), { role: 'assistant', content: d.reply || '修正しました' }] }))
      toast.success('✨ 修正を反映しました')
      await reload()
      loadVersions(sid)
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

  const exportAs = async (fmt: 'pdf' | 'zip') => {
    if (!project) return
    if (!allDone && !confirm('未生成のスライドがあります。完成分のみ書き出しますか？')) return
    setExporting(fmt)
    try {
      const res = await fetch(`/api/doyaslide/export?projectId=${id}&format=${fmt}`)
      if (!res.ok) throw new Error('書き出しに失敗しました')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const safe = (project.title || 'doyaslide').replace(/[^\w\-ぁ-んァ-ヶ一-龠]/g, '_').slice(0, 40) || 'doyaslide'
      a.download = `${safe}.${fmt}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setExporting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <img src="/character/thinking.png" alt="" className="w-20 h-20 object-contain animate-pulse" />
        <p className="text-slate-400 font-bold">読み込み中...</p>
      </div>
    )
  }
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <img src="/character/error.png" alt="" className="w-24 h-24 object-contain" />
        <p className="font-black text-slate-700">プロジェクトが見つかりません</p>
        <Link href="/doyaslide" className="px-6 py-2.5 bg-[#7f19e6] text-white font-bold rounded-xl">
          一覧に戻る
        </Link>
      </div>
    )
  }

  const ac = aspectClass(project.aspectRatio)
  const chatLog = selected ? chat[selected.id] || [] : []

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
      {/* header */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/doyaslide" className="text-slate-400 hover:text-slate-700">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-xl font-black text-slate-900 truncate">{project.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportAs('pdf')}
            disabled={exporting !== null || total === 0}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white text-slate-700 font-bold text-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-lg ${exporting === 'pdf' ? 'animate-spin' : ''}`}>
              {exporting === 'pdf' ? 'progress_activity' : 'picture_as_pdf'}
            </span>
            PDF
          </button>
          <button
            onClick={() => exportAs('zip')}
            disabled={exporting !== null || total === 0}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white text-slate-700 font-bold text-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-lg ${exporting === 'zip' ? 'animate-spin' : ''}`}>
              {exporting === 'zip' ? 'progress_activity' : 'folder_zip'}
            </span>
            ZIP
          </button>
          {allDone ? (
            <span className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-emerald-50 text-emerald-600 font-black text-sm">
              <span className="material-symbols-outlined text-lg">check_circle</span>
              全スライド完成
            </span>
          ) : (
            <button
              onClick={runGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1 px-5 py-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black text-sm shadow hover:shadow-lg transition-all disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-lg ${generating ? 'animate-spin' : ''}`}>
                {generating ? 'progress_activity' : 'bolt'}
              </span>
              {generating ? '生成中...' : '未生成を生成'}
            </button>
          )}
        </div>
      </div>

      {/* 上限超過バナー（消えない・アップグレード導線つき） */}
      {limitMsg && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <span className="material-symbols-outlined text-amber-600">error</span>
          <div className="flex-1 min-w-0">
            <p className="font-black text-amber-800 text-sm">今月の生成枚数の上限に達しました</p>
            <p className="text-xs font-bold text-amber-700 mt-0.5 leading-relaxed">{limitMsg}</p>
            <p className="text-[11px] font-bold text-amber-600/80 mt-1">
              ※ 生成・再生成・チャット修正はそれぞれ1枚分の生成枚数を消費します
            </p>
          </div>
          <Link
            href="/doyaslide/pricing"
            className="flex-shrink-0 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-black shadow hover:shadow-lg transition-all"
          >
            プロにアップグレード
          </Link>
          <button
            onClick={() => setLimitMsg(null)}
            aria-label="閉じる"
            className="flex-shrink-0 text-amber-400 hover:text-amber-600"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      {/* 進捗バー */}
      {total > 0 && (generating || !allDone) && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span>
              {generating ? 'もくもく生成中...' : '生成状況'}
              {generating && etaRemainingSec > 0 && (
                <span className="ml-2 text-blue-600">残り 約{formatDuration(etaRemainingSec)}</span>
              )}
            </span>
            <span>
              {doneCount} / {total} 枚 完成
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-700"
              style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_320px] gap-4">
        {/* thumbnails */}
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:max-h-[78vh] pb-2">
          {slides.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`flex-shrink-0 w-32 lg:w-full rounded-xl overflow-hidden border-2 transition-all ${
                selected?.id === s.id ? 'border-blue-500 scale-[1.02]' : 'border-transparent hover:border-slate-200'
              }`}
            >
              <div className={`${ac} bg-slate-100 flex items-center justify-center relative`}>
                {s.imageUrl ? (
                  <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : s.status === 'generating' || generating ? (
                  <span className="material-symbols-outlined animate-spin text-slate-400">progress_activity</span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400">未生成</span>
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
            {selected?.imageUrl ? (
              <img
                key={selected.imageUrl}
                src={selected.imageUrl}
                alt={selected.headline || ''}
                className="w-full h-full object-contain animate-[fadeIn_.4s_ease]"
              />
            ) : generating || selected?.status === 'generating' ? (
              <div className="text-center text-white/90">
                <img src="/character/working.png" alt="" className="w-24 h-24 object-contain mx-auto animate-bounce" />
                <p className="font-black mt-2">{GEN_MESSAGES[funIdx]}</p>
                <p className="text-xs text-white/60 mt-1">残り {total - doneCount} 枚</p>
              </div>
            ) : (
              <div className="text-center text-white/50">
                <p className="font-bold">未生成</p>
              </div>
            )}
          </div>
          {selected && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-black text-slate-800 truncate">{selected.headline || `スライド ${selected.index}`}</p>
                <p className="text-xs text-slate-400 font-bold truncate">{selected.role} ・ v{selected.version}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <button
                  onClick={() => regenerate(selected.id)}
                  disabled={busySlide === selected.id || generating}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white text-slate-700 font-bold text-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-lg ${busySlide === selected.id ? 'animate-spin' : ''}`}>
                    {busySlide === selected.id ? 'progress_activity' : 'refresh'}
                  </span>
                  再生成
                </button>
                <span className="text-[10px] font-bold text-slate-400">生成枚数を1枚消費</span>
              </div>
            </div>
          )}
        </div>

        {/* right panel */}
        <div className="space-y-4">
          {/* chat */}
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col h-[360px]">
            <p className="font-black text-slate-800 text-sm mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-blue-600 text-lg">chat</span>
              {selected ? `スライド${selected.index}を修正` : 'チャットで修正'}
            </p>
            <div className="flex-1 overflow-y-auto space-y-2 mb-2">
              {chatLog.length === 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {['もっと青く', '背景を夜景に', '見出しを短く', 'ロゴを左下に'].map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setChatInput(ex)}
                      className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}
              {chatLog.map((m, i) => (
                <div
                  key={i}
                  className={`text-sm rounded-2xl px-3 py-2 max-w-[90%] ${
                    m.role === 'user' ? 'bg-blue-100 text-blue-900 ml-auto' : 'bg-slate-100 text-slate-700'
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
                className="flex-1 px-3 py-2 bg-slate-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button onClick={sendChat} disabled={chatBusy || !selected} className="px-3 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50">
                <span className="material-symbols-outlined text-lg">send</span>
              </button>
            </div>
          </div>

          {/* version history */}
          {versions.length > 1 && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="font-black text-slate-800 text-sm mb-3 flex items-center gap-1">
                <span className="material-symbols-outlined text-blue-600 text-lg">history</span>
                履歴（戻せます）
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => revert(v.version)}
                    className="flex-shrink-0 w-16 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-blue-400 relative"
                    title={`v${v.version} に戻す`}
                  >
                    <img src={v.imageUrl} alt={`v${v.version}`} className="w-full aspect-[3/2] object-cover" />
                    <span className="absolute bottom-0 right-0 text-[9px] font-black bg-black/60 text-white px-1">
                      v{v.version}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* logo config */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="font-black text-slate-800 text-sm mb-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-blue-600 text-lg">branding_watermark</span>
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
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                          project.logoSize === sz ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
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
              <p className="text-xs text-slate-400 font-bold">ロゴは未設定です。新規作成時にアップロードできます。</p>
            )}
          </div>
        </div>
      </div>

      {celebrate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur rounded-3xl shadow-2xl px-10 py-7 flex flex-col items-center gap-2 animate-[fadeIn_.3s_ease]">
            <img src="/character/jump.png" alt="" className="w-28 h-28 object-contain animate-bounce" />
            <p className="text-xl font-black text-blue-700">完成しました！🎉</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
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
