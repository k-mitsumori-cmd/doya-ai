'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  GripVertical,
  Plus,
  Trash2,
  Edit3,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Save,
  Play,
  Check,
  X,
} from 'lucide-react'
import Link from 'next/link'

type HeadingItem = {
  id: string
  level: 2 | 3 | 4
  text: string
  memo?: string
}

export default function SeoOutlineEditPage() {
  const params = useParams<{ id: string }>()
  const articleId = params.id
  const router = useRouter()

  const [article, setArticle] = useState<{
    id: string
    title: string
    keywords: string[]
    outline?: string | null
    status: string
  } | null>(null)
  const [headings, setHeadings] = useState<HeadingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [memoText, setMemoText] = useState('')

  // アウトラインからヘッディングを抽出
  const parseOutline = (outline: string): HeadingItem[] => {
    const lines = (outline || '').split('\n')
    const items: HeadingItem[] = []
    let counter = 0
    for (const line of lines) {
      const m2 = line.match(/^##\s+(.+)$/)
      const m3 = line.match(/^###\s+(.+)$/)
      const m4 = line.match(/^####\s+(.+)$/)
      if (m2) {
        items.push({ id: `h-${counter++}`, level: 2, text: m2[1].trim() })
      } else if (m3) {
        items.push({ id: `h-${counter++}`, level: 3, text: m3[1].trim() })
      } else if (m4) {
        items.push({ id: `h-${counter++}`, level: 4, text: m4[1].trim() })
      }
    }
    return items
  }

  // ヘッディングをアウトラインに変換
  const toOutlineString = (items: HeadingItem[]): string => {
    return items.map((h) => `${'#'.repeat(h.level)} ${h.text}`).join('\n')
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/seo/articles/${articleId}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `エラー: ${res.status}`)
      }
      const art = json.article
      setArticle(art)
      if (art?.outline) {
        setHeadings(parseOutline(art.outline))
      }
    } catch (e: any) {
      setError(e?.message || '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [articleId])

  useEffect(() => {
    load()
  }, [load])

  // 選択中の見出しが変わったらメモをセット
  useEffect(() => {
    if (selectedId) {
      const h = headings.find((x) => x.id === selectedId)
      setMemoText(h?.memo || '')
    }
  }, [selectedId, headings])

  // 保存
  const save = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const outline = toOutlineString(headings)
      const res = await fetch(`/api/seo/articles/${articleId}/outline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outline }),
      })
      const json = await res.json()
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || '保存に失敗しました')
      }
    } catch (e: any) {
      setError(e?.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // 本文生成へ進む
  const startGenerate = async () => {
    if (generating || headings.length === 0) return
    setGenerating(true)
    setError(null)
    try {
      // まず保存
      await save()
      // ジョブ作成（アウトライン編集後に本文生成を開始）
      const res = await fetch(`/api/seo/articles/${articleId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoStart: true }),
      })
      const json = await res.json()
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || 'ジョブ作成に失敗しました')
      }
      const jobId = json.jobId || json.job?.id
      if (jobId) {
        router.push(`/seo/jobs/${jobId}?auto=1`)
      } else {
        router.push(`/seo/articles/${articleId}`)
      }
    } catch (e: any) {
      setError(e?.message || '生成開始に失敗しました')
      setGenerating(false)
    }
  }

  // 見出し追加
  const addHeading = (level: 2 | 3 | 4) => {
    const newId = `h-${Date.now()}`
    setHeadings((prev) => [...prev, { id: newId, level, text: '新しい見出し' }])
    setEditingId(newId)
    setEditText('新しい見出し')
  }

  // 見出し削除
  const removeHeading = (id: string) => {
    setHeadings((prev) => prev.filter((h) => h.id !== id))
    if (selectedId === id) setSelectedId(null)
    if (editingId === id) setEditingId(null)
  }

  // 編集開始
  const startEdit = (h: HeadingItem) => {
    setEditingId(h.id)
    setEditText(h.text)
  }

  // 編集確定
  const confirmEdit = () => {
    if (!editingId) return
    setHeadings((prev) =>
      prev.map((h) => (h.id === editingId ? { ...h, text: editText.trim() || h.text } : h))
    )
    setEditingId(null)
    setEditText('')
  }

  // 編集キャンセル
  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  // メモ保存
  const saveMemo = () => {
    if (!selectedId) return
    setHeadings((prev) =>
      prev.map((h) => (h.id === selectedId ? { ...h, memo: memoText } : h))
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-gray-400 font-bold text-sm">読み込み中...</p>
        </div>
      </main>
    )
  }

  if (!article) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-100 shadow-xl p-8 text-center">
          <p className="text-red-600 font-bold mb-4">{error || '記事が見つかりません'}</p>
          <Link href="/seo">
            <button className="px-6 py-3 rounded-xl bg-gray-900 text-white font-bold">
              一覧へ戻る
            </button>
          </Link>
        </div>
      </main>
    )
  }

  const selectedHeading = headings.find((h) => h.id === selectedId)

  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-4">
          <Link href={`/seo/articles/${articleId}`}>
            <button className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <p className="text-sm font-black text-gray-900 leading-none truncate max-w-xs sm:max-w-md">
              {article.title}
            </p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">構成を編集</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="h-10 px-4 rounded-xl bg-gray-100 text-gray-600 text-xs font-black hover:bg-gray-200 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            保存
          </button>
          <button
            onClick={startGenerate}
            disabled={generating || headings.length === 0}
            className="h-10 px-5 rounded-xl bg-blue-600 text-white text-xs font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            本文を生成
          </button>
        </div>
      </header>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 md:mx-8 mt-4 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm font-bold"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-5 gap-6 p-4 md:p-8 max-w-7xl mx-auto">
        {/* 左: 見出しツリー (60%) */}
        <div className="lg:col-span-3 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-lg overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-gray-900">見出し構成</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => addHeading(2)}
                className="h-8 px-3 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-black hover:bg-blue-100 transition-colors inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> H2
              </button>
              <button
                onClick={() => addHeading(3)}
                className="h-8 px-3 rounded-lg bg-gray-50 text-gray-600 text-[10px] font-black hover:bg-gray-100 transition-colors inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> H3
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 min-h-[400px]">
            {headings.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-gray-300 font-bold text-sm">見出しがありません</p>
                <p className="text-gray-400 text-xs mt-2">上の「+ H2」ボタンで追加してください</p>
              </div>
            ) : (
              <Reorder.Group axis="y" values={headings} onReorder={setHeadings} className="space-y-2">
                {headings.map((h) => (
                  <Reorder.Item key={h.id} value={h}>
                    <motion.div
                      layout
                      className={`group flex items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                        selectedId === h.id
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                      }`}
                      style={{ marginLeft: h.level === 3 ? 24 : h.level === 4 ? 48 : 0 }}
                      onClick={() => setSelectedId(h.id)}
                    >
                      <GripVertical className="w-4 h-4 text-gray-300 cursor-grab flex-shrink-0" />

                      <span
                        className={`flex-shrink-0 w-8 h-5 rounded text-[10px] font-black flex items-center justify-center ${
                          h.level === 2
                            ? 'bg-blue-100 text-blue-600'
                            : h.level === 3
                              ? 'bg-gray-200 text-gray-600'
                              : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        H{h.level}
                      </span>

                      {editingId === h.id ? (
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmEdit()
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          autoFocus
                          className="flex-1 px-3 py-1 rounded-lg bg-white border border-blue-300 text-sm font-bold text-gray-900 focus:outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="flex-1 text-sm font-bold text-gray-800 truncate">{h.text}</span>
                      )}

                      {editingId === h.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              confirmEdit()
                            }}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              cancelEdit()
                            }}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startEdit(h)
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeHeading(h.id)
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            )}
          </div>
        </div>

        {/* 右: 編集パネル (40%) */}
        <div className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-lg overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-50">
            <h2 className="text-base sm:text-lg font-black text-gray-900">詳細</h2>
          </div>

          <div className="p-4 sm:p-6">
            {selectedHeading ? (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                    見出しテキスト
                  </label>
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-sm font-bold text-gray-800">{selectedHeading.text}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-600">
                      H{selectedHeading.level}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                    この章で書きたい内容（メモ）
                  </label>
                  <textarea
                    value={memoText}
                    onChange={(e) => setMemoText(e.target.value)}
                    onBlur={saveMemo}
                    placeholder="AIへの指示や書きたい内容をメモ..."
                    rows={5}
                    className="w-full p-4 rounded-xl bg-gray-50 border border-gray-100 text-sm font-bold text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
                  />
                </div>
              </div>
            ) : (
              <div className="py-16 text-center">
                <ChevronRight className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-300 font-bold text-sm">見出しを選択してください</p>
                <p className="text-gray-400 text-xs mt-2">左の見出しをクリックすると詳細を編集できます</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

