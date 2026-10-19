'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Copy,
  Shield,
  Loader2,
  ArrowRight,
  RefreshCcw,
  Check,
  X,
} from 'lucide-react'
import Link from 'next/link'

type CheckItem = {
  id: string
  category: 'regulation' | 'copy' | 'fact'
  severity: 'error' | 'warning' | 'info'
  title: string
  description: string
  location?: string
  suggestion?: string
  before?: string
  after?: string
  applied?: boolean
}

const TABS = [
  { id: 'regulation', label: 'レギュレーション', icon: Shield },
  { id: 'copy', label: 'コピペ', icon: Copy },
  { id: 'fact', label: 'ファクト', icon: FileText },
] as const

export default function SeoCheckPage() {
  const params = useParams<{ id: string }>()
  const articleId = params.id
  const router = useRouter()

  const [article, setArticle] = useState<{
    id: string
    title: string
    finalMarkdown?: string | null
    status: string
  } | null>(null)
  const [checks, setChecks] = useState<CheckItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'regulation' | 'copy' | 'fact'>('regulation')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/seo/articles/${articleId}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `エラー: ${res.status}`)
      }
      setArticle(json.article)
      // 既存のチェック結果があれば復元
      if (json.article?.checkResults) {
        try {
          const parsed = typeof json.article.checkResults === 'string'
            ? JSON.parse(json.article.checkResults)
            : json.article.checkResults
          if (Array.isArray(parsed)) {
            setChecks(parsed)
          }
        } catch {
          // ignore
        }
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

  // チェック実行
  const runCheck = async () => {
    if (checking) return
    setChecking(true)
    setError(null)
    try {
      const res = await fetch(`/api/seo/articles/${articleId}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json().catch(async () => {
        const t = await res.text().catch(() => '')
        throw new Error(t ? `APIの応答が不正です: ${t.slice(0, 200)}` : 'APIの応答が不正です')
      })
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || 'チェックに失敗しました')
      }
      if (Array.isArray(json.items)) {
        setChecks(json.items)
      }
    } catch (e: any) {
      setError(e?.message || 'チェックに失敗しました')
    } finally {
      setChecking(false)
    }
  }

  // 修正を適用
  const applyFix = (id: string) => {
    setChecks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, applied: true } : c))
    )
  }

  // 修正をスキップ
  const skipFix = (id: string) => {
    setChecks((prev) => prev.filter((c) => c.id !== id))
  }

  const filteredChecks = checks.filter((c) => c.category === activeTab)
  const errorCount = checks.filter((c) => c.severity === 'error').length
  const warningCount = checks.filter((c) => c.severity === 'warning').length
  const pendingCount = checks.filter((c) => !c.applied).length

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
            <p className="text-[10px] font-bold text-gray-400 mt-1">品質チェック</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runCheck}
            disabled={checking}
            className="h-10 px-4 rounded-xl bg-gray-100 text-gray-600 text-xs font-black hover:bg-gray-200 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            再チェック
          </button>
          <Link href={`/seo/articles/${articleId}/export`}>
            <button className="h-10 px-5 rounded-xl bg-blue-600 text-white text-xs font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
              出力へ進む
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </header>

      {/* Summary */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${errorCount > 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
              {errorCount > 0 ? (
                <XCircle className="w-6 h-6 text-red-600" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">エラー</p>
              <p className="text-2xl font-black text-gray-900">{errorCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${warningCount > 0 ? 'bg-amber-100' : 'bg-gray-100'}`}>
              <AlertTriangle className={`w-6 h-6 ${warningCount > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">警告</p>
              <p className="text-2xl font-black text-gray-900">{warningCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">未対応</p>
              <p className="text-2xl font-black text-gray-900">{pendingCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6">
        <div className="flex gap-1 p-1 rounded-xl bg-white border border-gray-100 shadow-sm w-fit">
          {TABS.map((t) => {
            const count = checks.filter((c) => c.category === t.id).length
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
                  activeTab === t.id
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-400 hover:bg-gray-50'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
                {count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${
                    activeTab === t.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-5xl mx-auto px-4 md:px-8 mt-4"
          >
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm font-bold">
              {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Check Items */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        {checks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-12 text-center">
            {checking ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-gray-500 font-bold">チェック中...</p>
              </div>
            ) : (
              <>
                <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                <h3 className="text-lg font-black text-gray-900 mb-2">チェック結果がありません</h3>
                <p className="text-sm text-gray-400 font-bold mb-6">
                  「再チェック」ボタンでレギュレーション/コピペ/ファクトチェックを実行してください
                </p>
                <button
                  onClick={runCheck}
                  disabled={checking}
                  className="h-12 px-6 rounded-xl bg-blue-600 text-white text-sm font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                >
                  <RefreshCcw className="w-5 h-5" />
                  チェックを実行
                </button>
              </>
            )}
          </div>
        ) : filteredChecks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-lg font-black text-gray-900 mb-2">問題ありません 🎉</h3>
            <p className="text-sm text-gray-400 font-bold">
              このカテゴリでは問題が見つかりませんでした
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredChecks.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                  item.applied
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : item.severity === 'error'
                      ? 'border-red-200'
                      : item.severity === 'warning'
                        ? 'border-amber-200'
                        : 'border-gray-100'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      item.applied
                        ? 'bg-emerald-100'
                        : item.severity === 'error'
                          ? 'bg-red-100'
                          : item.severity === 'warning'
                            ? 'bg-amber-100'
                            : 'bg-blue-100'
                    }`}>
                      {item.applied ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : item.severity === 'error' ? (
                        <XCircle className="w-5 h-5 text-red-600" />
                      ) : item.severity === 'warning' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      ) : (
                        <FileText className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-gray-900">{item.title}</h4>
                      <p className="text-xs text-gray-500 font-bold mt-1">{item.description}</p>
                      {item.location && (
                        <p className="text-[10px] text-gray-400 font-bold mt-2 truncate">
                          📍 {item.location}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Before / After */}
                  {item.before && item.after && !item.applied && (
                    <div className="mt-4 grid sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Before</p>
                        <p className="text-xs text-red-800 font-bold">{item.before}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">After</p>
                        <p className="text-xs text-emerald-800 font-bold">{item.after}</p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {!item.applied && (
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={() => applyFix(item.id)}
                        className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 transition-colors inline-flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        適用
                      </button>
                      <button
                        onClick={() => skipFix(item.id)}
                        className="h-9 px-4 rounded-lg bg-gray-100 text-gray-600 text-xs font-black hover:bg-gray-200 transition-colors inline-flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        スキップ
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      {checks.length > 0 && pendingCount === 0 && (
        <div className="max-w-5xl mx-auto px-4 md:px-8 pb-8">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 text-center text-white shadow-xl shadow-emerald-500/20">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-90" />
            <h3 className="text-lg font-black mb-2">すべて確認しました！</h3>
            <p className="text-sm opacity-80 mb-4">記事を出力する準備が整いました</p>
            <Link href={`/seo/articles/${articleId}/export`}>
              <button className="h-12 px-8 rounded-xl bg-white text-emerald-600 text-sm font-black shadow-lg hover:bg-emerald-50 transition-colors inline-flex items-center gap-2">
                出力へ進む
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}

