'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  FileText,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Play,
  Download,
  Sparkles,
} from 'lucide-react'
import { Button } from '@seo/components/ui/Button'
import { Badge } from '@seo/components/ui/Badge'
import { ProgressBar } from '@seo/components/ui/ProgressBar'
import { FeatureGuide } from '@/components/FeatureGuide'

type SeoArticleRow = {
  id: string
  title: string
  keywords?: string[]
  status: string
  targetChars: number
  createdAt: string
  updatedAt: string
  jobs?: { id: string; status: string; progress: number; step: string }[]
  images?: { id: string; kind: string; createdAt: string }[]
}

// ステップ定義（進行バー用）
const WORKFLOW_STEPS = [
  { id: 'keyword', label: 'KW', icon: Sparkles },
  { id: 'outline', label: '構成', icon: FileText },
  { id: 'generate', label: '本文', icon: Play },
  { id: 'edit', label: '編集', icon: Edit3 },
  { id: 'check', label: 'チェック', icon: CheckCircle2 },
  { id: 'export', label: '出力', icon: Download },
]

// ステータスからステップを判定
function getStepIndex(status: string): number {
  switch (status) {
    case 'DRAFT': return 1 // 構成済み
    case 'RUNNING': return 2 // 本文生成中
    case 'EDITING': return 3 // 編集中
    case 'DONE': return 4 // チェック可能
    case 'EXPORTED': return 5 // 出力済み
    default: return 0
  }
}

const STATUS_CONFIG = {
  DRAFT: { label: '構成済み', color: 'text-blue-600', bg: 'bg-blue-100', tone: 'blue' as const },
  RUNNING: { label: '生成中', color: 'text-orange-600', bg: 'bg-orange-100', tone: 'amber' as const },
  EDITING: { label: '編集中', color: 'text-purple-600', bg: 'bg-purple-100', tone: 'purple' as const },
  DONE: { label: '完成', color: 'text-emerald-600', bg: 'bg-emerald-100', tone: 'green' as const },
  EXPORTED: { label: '出力済', color: 'text-teal-600', bg: 'bg-teal-100', tone: 'green' as const },
  ERROR: { label: 'エラー', color: 'text-red-600', bg: 'bg-red-100', tone: 'red' as const },
} as const

// ジョブステップ名を日本語に変換
const STEP_LABELS: Record<string, string> = {
  init: '準備中',
  outline: '構成生成',
  sections: '本文執筆',
  integrate: '記事統合',
  media: '図解生成',
  done: '完成',
  OUTLINE: '構成生成',
  SECTIONS: '本文執筆',
  INTEGRATE: '記事統合',
  MEDIA: '図解生成',
  DONE: '完成',
  cmp_ref: '参考記事解析',
  cmp_candidates: '候補収集',
  cmp_crawl: 'サイト巡回',
  cmp_extract: '情報抽出',
  cmp_sources: '出典整形',
  cmp_tables: '比較表生成',
  cmp_outline: '章立て生成',
  cmp_polish: '校正中',
}

export default function SeoDashboardPage() {
  const router = useRouter()
  const [articles, setArticles] = useState<SeoArticleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const isLoadingRef = useRef(false)

  async function load(opts?: { showLoading?: boolean }) {
    // 二重呼び出し防止
    if (isLoadingRef.current) return
    isLoadingRef.current = true

    if (opts?.showLoading) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch('/api/seo/articles', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `API Error: ${res.status}`)
      }
      setArticles(json.articles || [])
      if (opts?.showLoading) setError(null)
    } catch (e: any) {
      // ポーリング中はエラーで既存データを消さない
      if (opts?.showLoading) {
        setArticles([])
        setError(e?.message || '読み込みに失敗しました')
      }
    }
    if (opts?.showLoading) setLoading(false)
    isLoadingRef.current = false
  }

  // 生成中の記事があるかどうか
  const hasRunning = useMemo(() => articles.some(a => a.status === 'RUNNING'), [articles])

  useEffect(() => {
    load({ showLoading: true })
  }, [])

  // 生成中の記事がある場合のみポーリング
  useEffect(() => {
    if (!hasRunning) return
    const t = setInterval(() => load(), 6000)
    return () => clearInterval(t)
  }, [hasRunning])

  const counts = useMemo(() => {
    const total = articles.length
    const running = articles.filter((a) => a.status === 'RUNNING').length
    const done = articles.filter((a) => a.status === 'DONE' || a.status === 'EXPORTED').length
    const draft = articles.filter((a) => a.status === 'DRAFT').length
    return { total, running, done, draft }
  }, [articles])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return articles
      .filter((a) => (!q ? true : a.title.toLowerCase().includes(q) || (a.keywords || []).some(k => k.toLowerCase().includes(q))))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
  }, [articles, query])

  // 記事の続きへのリンクを決定
  function getResumeLink(a: SeoArticleRow): string {
    // 一覧からは常に「本文＋画像が見られる記事詳細」へ統一（迷いをなくす）
    return `/seo/articles/${a.id}`
  }

  return (
    <main className="max-w-6xl mx-auto py-6 sm:py-8 px-4">
      {/* 統計カード */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
            <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">合計</p>
            <p className="text-2xl sm:text-3xl font-black text-gray-900">{counts.total}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-orange-50 flex items-center justify-center">
            <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-orange-600 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">生成中</p>
            <p className="text-2xl sm:text-3xl font-black text-gray-900">{counts.running}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">完成</p>
            <p className="text-2xl sm:text-3xl font-black text-gray-900">{counts.done}</p>
          </div>
        </div>
      </div>

      {/* Header with Progress Bar */}
      <div className="mb-8 sm:mb-10">
        {/* 進行バー（常時表示） */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.id} className="flex-1 flex flex-col items-center relative">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
                  i === 0 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-100 text-gray-400'
                }`}>
                  <step.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <p className={`text-[10px] sm:text-xs font-black mt-2 ${i === 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                  {step.label}
                </p>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className="absolute top-5 sm:top-6 left-[60%] w-[80%] h-0.5 bg-gray-100" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* タイトル & CTA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">生成記事一覧</h1>
            <p className="text-sm text-gray-400 font-bold mt-1">
              {counts.total}件の記事 · {counts.running}件が生成中 · {counts.done}件が完成
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100 text-[11px] font-bold text-gray-600">
                直近3ヶ月分のみ表示（データ保持容量の都合上、それ以前は自動削除されます）
              </span>
              <FeatureGuide
                featureId="seo.generatedList"
                title="生成記事一覧の使い方"
                description="生成した記事を一覧で管理し、クリックひとつで本文・画像・SEO改善まで確認できます。"
                steps={[
                  'カードをクリックすると、記事詳細（本文＋画像）をすぐ開けます',
                  '生成中の記事も「途中の本文」や進捗を確認できます',
                  '完成後はSEOスコアの改善提案→手動/AI修正で仕上げます',
                  '必要に応じてダウンロードや画像の再生成も可能です',
                ]}
                imageMode="off"
              />
            </div>
          </div>
          <Link href="/seo/create">
            <button className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm sm:text-base shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 hover:translate-y-[-2px] transition-all flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" />
              新規記事作成
            </button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="flex justify-end mb-6">
        <div className="relative w-full sm:max-w-sm">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-100 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-blue-500 shadow-sm transition-all"
            placeholder="タイトル・キーワードで検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Article Cards */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 font-black text-xs uppercase tracking-widest">読み込み中...</p>
          </div>
        ) : error ? (
          <div className="py-16 bg-white rounded-3xl border border-red-100 text-center">
            <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
            <p className="text-red-600 font-bold text-sm">{error}</p>
            <button onClick={() => load({ showLoading: true })} className="mt-4 px-6 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-black hover:bg-red-100 transition-colors">
              再読み込み
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 text-center"
          >
            <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-10 h-10 text-gray-200" />
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">まだ記事はありません</h3>
            <p className="text-sm text-gray-400 font-bold mb-6">最初の1本を作りましょう</p>
            <Link href="/seo/create">
              <button className="h-12 px-8 rounded-xl bg-blue-600 text-white text-sm font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
                <Plus className="w-5 h-5" />
                新規記事作成
              </button>
            </Link>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map((a, idx) => {
              const config = STATUS_CONFIG[a.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.DRAFT
              const stepIndex = getStepIndex(a.status)
              const job = a.jobs?.[0]
              const mainKw = (a.keywords || [])[0] || ''
              const detailHref = `/seo/articles/${a.id}`
              const resumeHref = getResumeLink(a)
              const bannerId = a.images?.[0]?.id || ''

              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(detailHref)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') router.push(detailHref)
                    }}
                    className="group bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 hover:translate-y-[-2px] transition-all cursor-pointer"
                    title="クリックで記事詳細（本文/画像）を開く"
                  >
                      <div className="flex items-start sm:items-center gap-4">
                        {/* バナーサムネ（一覧で“ひと目で違いが分かる”） */}
                        <div className="hidden sm:block w-28">
                          <div className="aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 border border-gray-100">
                            {bannerId ? (
                              <img
                                src={`/api/seo/images/${bannerId}`}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-blue-500/60">
                                <FileText className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ステップインジケーター */}
                        <div className="hidden sm:flex flex-col items-center gap-1">
                          {WORKFLOW_STEPS.slice(0, 5).map((s, i) => (
                            <div
                              key={s.id}
                              className={`w-2 h-2 rounded-full transition-all ${
                                i < stepIndex ? 'bg-blue-600' : i === stepIndex ? 'bg-blue-400 animate-pulse' : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>

                        {/* メインコンテンツ */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge tone={config.tone}>{config.label}</Badge>
                            {mainKw && (
                              <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded truncate max-w-[120px]">
                                {mainKw}
                              </span>
                            )}
                          </div>
                          <h3 className="font-black text-gray-900 text-sm sm:text-base truncate group-hover:text-blue-600 transition-colors">
                            {a.title}
                          </h3>
                          <p className="text-[10px] text-gray-400 font-bold mt-1">
                            最終更新: {new Date(a.updatedAt || a.createdAt).toLocaleDateString('ja-JP')}
                          </p>
                        </div>

                        {/* 進捗 or CTA */}
                        <div className="flex items-center gap-3">
                          {a.status === 'RUNNING' && job && (
                            <div className="hidden sm:block w-28">
                              <div className="flex justify-between text-[10px] font-black text-orange-600 mb-1">
                                <span className="truncate">{STEP_LABELS[job.step] || job.step}</span>
                                <span>{job.progress}%</span>
                              </div>
                              <ProgressBar value={job.progress} />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(resumeHref)
                            }}
                            className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                            title="記事詳細（本文＋画像）を開く"
                          >
                            {a.status === 'RUNNING' ? '途中を見る' : '記事を開く'}
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </main>
  )
}
