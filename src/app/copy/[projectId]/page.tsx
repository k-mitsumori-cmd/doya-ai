'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Star,
  Copy,
  Download,
  ChevronLeft,
  RefreshCw,
  Filter,
  Loader2,
  AlertCircle,
  Tag,
  BarChart3,
} from 'lucide-react'
import { motion } from 'framer-motion'

interface CopyItem {
  id: string
  type: string
  platform: string | null
  writerType: string
  headline: string | null
  description: string | null
  catchcopy: string | null
  hashtags: string[]
  cta: string | null
  appealAxis: string | null
  charCount: number | null
  score: number | null
  isFavorite: boolean
}

interface CopyProject {
  id: string
  name: string
  status: string
  productUrl: string | null
  productInfo: Record<string, unknown> | null
  persona: Record<string, unknown> | null
  copies: CopyItem[]
  createdAt: string
}

const WRITER_LABELS: Record<string, string> = {
  straight: '🎯 ストレート',
  emotional: '❤️ エモーショナル',
  logical: '📊 ロジカル',
  provocative: '⚡ プロボカティブ',
  story: '📖 ストーリー',
}

const TYPE_LABELS: Record<string, string> = {
  display: 'ディスプレイ',
  search_headline: '検索広告 見出し',
  search_description: '検索広告 説明文',
  sns: 'SNS広告',
}

const APPEAL_COLORS: Record<string, string> = {
  '価格訴求': 'bg-green-100 text-green-700',
  '品質訴求': 'bg-blue-100 text-blue-700',
  '限定訴求': 'bg-red-100 text-red-700',
  '緊急訴求': 'bg-orange-100 text-orange-700',
  '実績訴求': 'bg-purple-100 text-purple-700',
  '共感訴求': 'bg-pink-100 text-pink-700',
  '好奇心訴求': 'bg-yellow-100 text-yellow-700',
}

export default function CopyProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [project, setProject] = useState<CopyProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterWriter, setFilterWriter] = useState<string>('all')
  const [filterAppeal, setFilterAppeal] = useState<string>('all')
  const [filterFavorite, setFilterFavorite] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [brushupId, setBrushupId] = useState<string | null>(null)
  const [brushupInstruction, setBrushupInstruction] = useState('')
  const [brushingUp, setBrushingUp] = useState(false)

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/copy/projects/${projectId}`)
      if (!res.ok) {
        if (res.status === 404) router.push('/copy')
        return
      }
      const data = await res.json()
      setProject(data.project)
    } catch {
      setError('プロジェクトの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [projectId, router])

  useEffect(() => { fetchProject() }, [fetchProject])

  const toggleFavorite = async (itemId: string, current: boolean) => {
    setProject(prev => prev ? {
      ...prev,
      copies: prev.copies.map(c => c.id === itemId ? { ...c, isFavorite: !current } : c)
    } : null)
    await fetch(`/api/copy/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ copyItemId: itemId, isFavorite: !current }),
    })
  }

  const copyToClipboard = async (item: CopyItem) => {
    const text = [item.headline, item.description, item.catchcopy].filter(Boolean).join('\n')
    await navigator.clipboard.writeText(text)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleBrushup = async (itemId: string) => {
    if (!brushupInstruction.trim()) return
    setBrushingUp(true)
    try {
      const res = await fetch('/api/copy/brushup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copyItemId: itemId, instruction: brushupInstruction }),
      })
      const data = await res.json()
      if (res.ok) {
        setBrushupId(null)
        setBrushupInstruction('')
        await fetchProject()
      } else {
        setError(data.error || 'ブラッシュアップに失敗しました')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ブラッシュアップに失敗しました')
    } finally {
      setBrushingUp(false)
    }
  }

  const filteredCopies = project?.copies.filter(c => {
    if (filterFavorite && !c.isFavorite) return false
    if (filterWriter !== 'all' && c.writerType !== filterWriter) return false
    if (filterAppeal !== 'all' && c.appealAxis !== filterAppeal) return false
    return true
  }) ?? []

  const uniqueWriters = [...new Set(project?.copies.map(c => c.writerType) ?? [])]
  const uniqueAppeals = [...new Set(project?.copies.map(c => c.appealAxis).filter(Boolean) ?? [])]

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
    </div>
  )

  if (error || !project) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-gray-500">{error || 'プロジェクトが見つかりません'}</p>
        <Link href="/copy" className="mt-4 text-amber-400 hover:underline block">
          ダッシュボードに戻る
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/copy" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-black text-gray-900 text-lg">{project.name}</h1>
              <p className="text-xs text-gray-500">{project.copies.length}件のコピー</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/copy/${projectId}/export`}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm font-bold rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />エクスポート
            </Link>
            <Link
              href={`/copy/new`}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-bold rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />再生成
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* フィルター */}
        <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-1 text-gray-500 text-sm mr-2">
            <Filter className="w-4 h-4" />フィルター:
          </div>
          <button
            onClick={() => setFilterFavorite(!filterFavorite)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              filterFavorite ? 'bg-yellow-100 text-yellow-700 border border-yellow-400' : 'bg-gray-100 text-gray-500 hover:text-gray-900'
            }`}
          >
            <Star className="w-3 h-3" />お気に入り
          </button>

          <select
            value={filterWriter}
            onChange={e => setFilterWriter(e.target.value)}
            className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600 focus:outline-none focus:border-amber-500"
          >
            <option value="all">全ライター</option>
            {uniqueWriters.map(w => (
              <option key={w} value={w}>{WRITER_LABELS[w] || w}</option>
            ))}
          </select>

          {uniqueAppeals.length > 0 && (
            <select
              value={filterAppeal}
              onChange={e => setFilterAppeal(e.target.value)}
              className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600 focus:outline-none focus:border-amber-500"
            >
              <option value="all">全訴求軸</option>
              {uniqueAppeals.map(a => (
                <option key={a} value={a!}>{a}</option>
              ))}
            </select>
          )}

          <span className="ml-auto text-sm text-gray-500">{filteredCopies.length}件表示</span>
        </div>

        {/* コピー一覧 */}
        {filteredCopies.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            条件に一致するコピーがありません
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCopies.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:border-gray-300 transition-colors shadow-sm"
              >
                {/* ヘッダー */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{WRITER_LABELS[item.writerType] || item.writerType}</span>
                  <div className="flex items-center gap-1">
                    {item.score && (
                      <div className="flex items-center gap-0.5 text-xs text-amber-600">
                        <BarChart3 className="w-3 h-3" />
                        {Math.round(item.score)}
                      </div>
                    )}
                    <button
                      onClick={() => toggleFavorite(item.id, item.isFavorite)}
                      className={`p-1 rounded-lg transition-colors ${item.isFavorite ? 'text-yellow-400' : 'text-gray-400 hover:text-gray-500'}`}
                    >
                      <Star className="w-4 h-4" fill={item.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>

                {/* コピー内容 */}
                <div className="flex-1 space-y-2">
                  {item.headline && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">見出し</p>
                      <p className="text-gray-900 font-bold text-sm leading-snug">{item.headline}</p>
                      {item.charCount && <p className="text-xs text-gray-400">{item.charCount}文字</p>}
                    </div>
                  )}
                  {item.description && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">説明文</p>
                      <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
                    </div>
                  )}
                  {item.catchcopy && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">キャッチコピー</p>
                      <p className="text-amber-600 text-sm font-bold italic">{item.catchcopy}</p>
                    </div>
                  )}
                  {item.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.hashtags.slice(0, 3).map(h => (
                        <span key={h} className="text-xs text-blue-400">#{h}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* フッター */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  {item.appealAxis && (
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${APPEAL_COLORS[item.appealAxis] || 'bg-gray-100 text-gray-600'}`}>
                      <Tag className="w-2.5 h-2.5" />{item.appealAxis}
                    </span>
                  )}
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      onClick={() => setBrushupId(brushupId === item.id ? null : item.id)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                      title="ブラッシュアップ"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => copyToClipboard(item)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        copiedId === item.id ? 'text-green-400 bg-green-50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                      title="コピー"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* ブラッシュアップパネル */}
                {brushupId === item.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="border-t border-gray-300 pt-3"
                  >
                    <textarea
                      value={brushupInstruction}
                      onChange={e => setBrushupInstruction(e.target.value)}
                      placeholder='例：「もっとカジュアルに」「数字を入れて」「文字数を20字以内に」'
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 resize-none"
                    />
                    <button
                      onClick={() => handleBrushup(item.id)}
                      disabled={!brushupInstruction.trim() || brushingUp}
                      className="mt-2 w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      {brushingUp ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      ブラッシュアップ
                    </button>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
