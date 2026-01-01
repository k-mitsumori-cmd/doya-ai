'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  ExternalLink,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  Users,
  Zap,
  Globe,
  Mail,
  MessageSquare,
  TrendingUp,
  FileText,
  Search,
} from 'lucide-react'

// ========================================
// Types
// ========================================
type PersonaGenerateResponse = {
  site: {
    url: string
    title: string
    description: string
    headings: string[]
    text: string
  }
  output: any
  model: string
  usage?: {
    dailyLimit: number
    dailyUsed: number
    dailyRemaining: number
  }
}

type TabKey = 'summary' | 'personas' | 'creative' | 'checklist' | 'json'

// ========================================
// Onboarding Slides
// ========================================
const ONBOARDING_SLIDES = [
  {
    title: 'URLを入力するだけ',
    description: 'サイトURLを入れると、AIがページ内容を自動解析。商品・サービス情報を瞬時に読み取ります。',
    icon: Globe,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    title: 'ペルソナを自動生成',
    description: 'サイト情報から理想の顧客像を設計。デモグラ・悩み・目標・反論・購買トリガーまで網羅。',
    icon: Users,
    color: 'from-purple-500 to-pink-500',
  },
  {
    title: '売れるコピーを提案',
    description: 'キャッチコピー・LP構成・広告文・メール文まで、そのまま使えるクリエイティブを一括生成。',
    icon: Sparkles,
    color: 'from-amber-500 to-orange-500',
  },
  {
    title: '施策チェックリスト',
    description: 'マーケティング改善ポイントを優先度付きでリストアップ。次にやるべきことが明確に。',
    icon: CheckCircle2,
    color: 'from-emerald-500 to-teal-500',
  },
]

// ========================================
// Helpers
// ========================================
async function copyText(text: string) {
  const s = String(text || '')
  if (!s) return
  try {
    await navigator.clipboard.writeText(s)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = s
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

function downloadJson(filename: string, obj: any) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function badgeClass(priority: string) {
  const p = String(priority || '').toLowerCase()
  if (p === 'high') return 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
  if (p === 'medium') return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
  return 'bg-gradient-to-r from-slate-400 to-slate-500 text-white'
}

// ========================================
// Onboarding Carousel Component
// ========================================
function OnboardingCarousel({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState(0)

  const next = () => {
    if (current < ONBOARDING_SLIDES.length - 1) {
      setCurrent(current + 1)
    } else {
      onClose()
    }
  }

  const prev = () => {
    if (current > 0) setCurrent(current - 1)
  }

  const slide = ONBOARDING_SLIDES[current]
  const Icon = slide.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl shadow-purple-500/10"
    >
      {/* Progress dots */}
      <div className="absolute left-0 right-0 top-4 flex justify-center gap-2 z-10">
        {ONBOARDING_SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-2 rounded-full transition-all ${
              idx === current ? 'w-8 bg-purple-600' : 'w-2 bg-slate-300 hover:bg-slate-400'
            }`}
          />
        ))}
      </div>

      <div className="px-6 pb-6 pt-12">
        <div className="flex flex-col items-center text-center">
          <motion.div
            key={current}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            className={`mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${slide.color} shadow-lg`}
          >
            <Icon className="h-10 w-10 text-white" />
          </motion.div>
          <motion.h3
            key={`title-${current}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl font-black text-slate-900"
          >
            {slide.title}
          </motion.h3>
          <motion.p
            key={`desc-${current}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-2 text-sm leading-relaxed text-slate-600"
          >
            {slide.description}
          </motion.p>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={prev}
            disabled={current === 0}
            className="flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
            戻る
          </button>

          <button
            onClick={next}
            className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-purple-500/30 hover:shadow-xl transition-all"
          >
            {current === ONBOARDING_SLIDES.length - 1 ? '始める' : '次へ'}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ========================================
// Copy Button Component
// ========================================
function CopyButton({ text, label = 'コピー' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await copyText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all"
    >
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
      {copied ? 'コピー済み' : label}
    </button>
  )
}

// ========================================
// Tab Button Component
// ========================================
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  label: string
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
        active
          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
          : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-black ${
            active ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-600'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

// ========================================
// Main Component
// ========================================
export default function PersonaPage() {
  const { data: session, status } = useSession()
  const isLoggedIn = status === 'authenticated'
  const user = session?.user as any

  const [showOnboarding, setShowOnboarding] = useState(true)
  const [tab, setTab] = useState<TabKey>('summary')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PersonaGenerateResponse | null>(null)

  // Form state
  const [url, setUrl] = useState('')
  const [productName, setProductName] = useState('')
  const [price, setPrice] = useState('')
  const [features, setFeatures] = useState('')
  const [target, setTarget] = useState('')
  const [objective, setObjective] = useState('問い合わせ/資料DL')
  const [mustInclude, setMustInclude] = useState('')
  const [avoid, setAvoid] = useState('')
  const [notes, setNotes] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // JSON editor
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Usage info
  const [usageInfo, setUsageInfo] = useState<{ dailyLimit: number; dailyUsed: number; dailyRemaining: number } | null>(null)

  const parsedJson = useMemo(() => {
    if (!jsonText) return null
    try {
      return JSON.parse(jsonText)
    } catch {
      return null
    }
  }, [jsonText])

  useEffect(() => {
    if (!jsonText) {
      setJsonError(null)
      return
    }
    try {
      JSON.parse(jsonText)
      setJsonError(null)
    } catch (e: any) {
      setJsonError(e?.message || 'JSONの解析に失敗しました')
    }
  }, [jsonText])

  // Check onboarding preference
  useEffect(() => {
    const seen = localStorage.getItem('doya_persona_onboarding_seen')
    if (seen === '1') setShowOnboarding(false)
  }, [])

  const handleCloseOnboarding = useCallback(() => {
    setShowOnboarding(false)
    localStorage.setItem('doya_persona_onboarding_seen', '1')
  }, [])

  async function onGenerate() {
    setError(null)
    setLoading(true)
    setData(null)
    try {
      const res = await fetch('/api/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          productName: productName || undefined,
          price: price || undefined,
          features: features || undefined,
          target: target || undefined,
          objective: objective || undefined,
          mustInclude: mustInclude || undefined,
          avoid: avoid || undefined,
          notes: notes || undefined,
        }),
      })
      const json = (await res.json().catch(() => null)) as any
      if (!res.ok) {
        if (json?.code === 'DAILY_LIMIT_REACHED') {
          throw new Error(json?.error || '本日の生成上限に達しました')
        }
        throw new Error(json?.error || `生成に失敗しました（status=${res.status}）`)
      }
      const payload = json as PersonaGenerateResponse
      setData(payload)
      setJsonText(JSON.stringify(payload.output ?? {}, null, 2))
      setTab('summary')
      if (payload.usage) {
        setUsageInfo(payload.usage)
      }
    } catch (e: any) {
      setError(e?.message || '生成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const out = data?.output || {}
  const site = data?.site

  const personaCount = Array.isArray(out?.personas) ? out.personas.length : 0
  const checklistCount = Array.isArray(out?.marketingChecklist) ? out.marketingChecklist.length : 0

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">ペルソナ＆クリエイティブ生成</h1>
              <p className="text-xs text-slate-500 font-bold mt-0.5">URLから売れるマーケティング素材を一括生成</p>
            </div>

            <div className="flex items-center gap-3">
              {usageInfo && usageInfo.dailyLimit > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm text-slate-600">
                    残り <span className="font-black text-slate-900">{usageInfo.dailyRemaining}</span>
                    <span className="text-slate-400">/{usageInfo.dailyLimit}回</span>
                  </span>
                </div>
              )}

              {!isLoggedIn && (
                <Link
                  href="/auth/doyamarke/signin?callbackUrl=%2Fpersona"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-purple-500/20 hover:shadow-xl transition-all"
                >
                  ログインで回数UP
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="grid gap-6 xl:grid-cols-12">
          {/* Left: Input Panel */}
          <div className="xl:col-span-4">
            <div className="sticky top-24 space-y-5">
              {/* Onboarding */}
              <AnimatePresence>
                {showOnboarding && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20, height: 0 }}
                  >
                    <OnboardingCarousel onClose={handleCloseOnboarding} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input Form */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Search className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">サイト解析</h2>
                    <p className="text-xs text-slate-500 font-bold">URLを入力して解析開始</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-black text-slate-700">
                      サイトURL <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-4 py-3.5 text-sm font-bold outline-none transition-all focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/10"
                        placeholder="https://example.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">商品/サービス名</label>
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none transition-all focus:border-purple-500 focus:bg-white"
                        placeholder="例: ドヤAI"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">価格/プラン</label>
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none transition-all focus:border-purple-500 focus:bg-white"
                        placeholder="例: 月額9,980円"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-600">特徴/強み</label>
                    <textarea
                      className="h-20 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none transition-all focus:border-purple-500 focus:bg-white"
                      placeholder="AIで広告バナーを自動生成..."
                      value={features}
                      onChange={(e) => setFeatures(e.target.value)}
                    />
                  </div>

                  {/* Advanced Options Toggle */}
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      詳細オプション
                    </span>
                    <ChevronRight className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showAdvanced && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 overflow-hidden"
                      >
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div>
                            <label className="mb-1 block text-xs font-bold text-slate-600">ターゲット補足</label>
                            <input
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-purple-500"
                              placeholder="例: 40代の中小企業経営者"
                              value={target}
                              onChange={(e) => setTarget(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold text-slate-600">目的（CV）</label>
                            <input
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-purple-500"
                              value={objective}
                              onChange={(e) => setObjective(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-bold text-slate-600">必須要素</label>
                              <textarea
                                className="h-16 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-purple-500"
                                value={mustInclude}
                                onChange={(e) => setMustInclude(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-bold text-slate-600">NG/避ける表現</label>
                              <textarea
                                className="h-16 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-purple-500"
                                value={avoid}
                                onChange={(e) => setAvoid(e.target.value)}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold text-slate-600">その他メモ</label>
                            <textarea
                              className="h-16 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-purple-500"
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-4 text-sm font-black text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-xl disabled:opacity-50"
                    disabled={loading || !url.trim()}
                    onClick={onGenerate}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        解析・生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        ペルソナ＆クリエイティブを生成
                      </>
                    )}
                  </button>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
                  >
                    <div className="text-sm font-black text-red-800">エラー</div>
                    <div className="mt-1 text-sm text-red-700">{error}</div>
                    {error.includes('上限') && (
                      <Link
                        href="/banner/pricing"
                        className="mt-2 inline-flex items-center gap-1 text-sm font-black text-red-700 underline hover:text-red-900"
                      >
                        プランをアップグレード
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Pro Plan CTA */}
              {(!user?.bannerPlan || user?.bannerPlan === 'FREE') && !showOnboarding && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-5 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/20 to-orange-400/20 rounded-full blur-2xl" />
                  <div className="relative flex items-start gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
                      <Zap className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900">プロプランで無制限に</h3>
                      <p className="mt-1 text-sm text-slate-600 font-bold">1日50回まで生成可能。全機能が使えます。</p>
                      <Link
                        href="/banner/pricing"
                        className="mt-3 inline-flex items-center gap-1 text-sm font-black text-amber-700 hover:text-amber-800"
                      >
                        プランを見る
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Right: Results Panel */}
          <div className="xl:col-span-8">
            {!data ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex h-[500px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50"
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mb-4">
                  <Target className="h-10 w-10 text-purple-400" />
                </div>
                <h3 className="text-lg font-black text-slate-700">結果がここに表示されます</h3>
                <p className="mt-2 text-sm text-slate-500 font-bold">左のフォームにURLを入力して「生成」ボタンを押してください</p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                {/* Tabs */}
                <div className="flex flex-wrap gap-2">
                  <TabButton
                    active={tab === 'summary'}
                    onClick={() => setTab('summary')}
                    icon={Target}
                    label="サイト要約"
                  />
                  <TabButton
                    active={tab === 'personas'}
                    onClick={() => setTab('personas')}
                    icon={Users}
                    label="ペルソナ"
                    count={personaCount}
                  />
                  <TabButton
                    active={tab === 'creative'}
                    onClick={() => setTab('creative')}
                    icon={Sparkles}
                    label="クリエイティブ"
                  />
                  <TabButton
                    active={tab === 'checklist'}
                    onClick={() => setTab('checklist')}
                    icon={CheckCircle2}
                    label="チェックリスト"
                    count={checklistCount}
                  />
                  <TabButton
                    active={tab === 'json'}
                    onClick={() => setTab('json')}
                    icon={FileText}
                    label="JSON"
                  />
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-sm text-slate-500 font-bold">
                    解析元: <span className="font-black text-slate-700">{site?.title || site?.url}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onGenerate}
                      disabled={loading}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all"
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                      再生成
                    </button>
                    <button
                      onClick={() => data && downloadJson('doya-persona.json', data)}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 transition-all"
                    >
                      <Download className="h-4 w-4" />
                      保存
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  {/* Summary Tab */}
                  {tab === 'summary' && (
                    <div className="space-y-6">
                      {/* Site Info */}
                      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                              <Globe className="h-5 w-5 text-slate-600" />
                            </div>
                            <h3 className="font-black text-slate-900">解析したサイト</h3>
                          </div>
                          <a
                            href={site?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm font-bold text-purple-600 hover:text-purple-700"
                          >
                            開く <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                        <div className="mt-4 space-y-2">
                          <div className="text-sm">
                            <span className="font-black text-slate-600">タイトル:</span>{' '}
                            <span className="font-bold text-slate-800">{site?.title || '—'}</span>
                          </div>
                          <div className="text-sm">
                            <span className="font-black text-slate-600">説明:</span>{' '}
                            <span className="font-bold text-slate-700">{site?.description || '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Site Summary */}
                      <div>
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-lg font-black text-slate-900">提案の核</h3>
                          <CopyButton text={JSON.stringify(out.siteSummary ?? {}, null, 2)} />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-xl" />
                            <div className="relative">
                              <div className="text-xs font-black uppercase tracking-wider text-blue-600">業界</div>
                              <div className="mt-2 text-lg font-black text-slate-900">{out?.siteSummary?.industry || '—'}</div>
                            </div>
                          </div>
                          <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-xl" />
                            <div className="relative">
                              <div className="text-xs font-black uppercase tracking-wider text-purple-600">オファー</div>
                              <div className="mt-2 text-lg font-black text-slate-900">{out?.siteSummary?.offer || '—'}</div>
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:col-span-2">
                            <div className="text-xs font-black uppercase tracking-wider text-slate-500">価値提案</div>
                            <div className="mt-2 text-slate-900 font-bold leading-relaxed">{out?.siteSummary?.valueProposition || '—'}</div>
                          </div>
                          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5">
                            <div className="text-xs font-black uppercase tracking-wider text-emerald-600">主CTA</div>
                            <div className="mt-2 font-black text-slate-900">{out?.siteSummary?.primaryCTA || '—'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                            <div className="text-xs font-black uppercase tracking-wider text-slate-500">副CTA</div>
                            <div className="mt-2 font-black text-slate-900">{out?.siteSummary?.secondaryCTA || '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Personas Tab */}
                  {tab === 'personas' && (
                    <div className="space-y-6">
                      {(Array.isArray(out?.personas) ? out.personas : []).map((p: any, idx: number) => (
                        <motion.div
                          key={p?.id || idx}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
                        >
                          {/* Persona Header */}
                          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-purple-50 via-white to-indigo-50 px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-2xl font-black text-white shadow-lg shadow-purple-500/30">
                                {(p?.name || `P${idx + 1}`).charAt(0)}
                              </div>
                              <div>
                                <h4 className="text-lg font-black text-slate-900">{p?.name || `ペルソナ${idx + 1}`}</h4>
                                {p?.archetype && <div className="text-sm font-bold text-purple-600">{p.archetype}</div>}
                              </div>
                            </div>
                            <CopyButton text={JSON.stringify(p, null, 2)} />
                          </div>

                          {/* Persona Content */}
                          <div className="p-6">
                            <div className="grid gap-4 sm:grid-cols-2">
                              {/* Situation */}
                              <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                                <div className="text-xs font-black uppercase tracking-wider text-slate-500">状況</div>
                                <div className="mt-2 text-sm font-bold text-slate-700 whitespace-pre-wrap leading-relaxed">{p?.situation || '—'}</div>
                              </div>

                              {/* Goals */}
                              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                                <div className="text-xs font-black uppercase tracking-wider text-emerald-600">目標</div>
                                <ul className="mt-3 space-y-2">
                                  {(Array.isArray(p?.goals) ? p.goals : [])
                                    .filter(Boolean)
                                    .slice(0, 5)
                                    .map((x: string, i: number) => (
                                      <li key={i} className="flex items-start gap-2 text-sm font-bold text-slate-700">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                                        {x}
                                      </li>
                                    ))}
                                </ul>
                              </div>

                              {/* Pains */}
                              <div className="rounded-xl bg-red-50 border border-red-100 p-4">
                                <div className="text-xs font-black uppercase tracking-wider text-red-600">悩み</div>
                                <ul className="mt-3 space-y-2">
                                  {(Array.isArray(p?.pains) ? p.pains : [])
                                    .filter(Boolean)
                                    .slice(0, 5)
                                    .map((x: string, i: number) => (
                                      <li key={i} className="flex items-start gap-2 text-sm font-bold text-slate-700">
                                        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-red-400" />
                                        {x}
                                      </li>
                                    ))}
                                </ul>
                              </div>

                              {/* Messaging Angles */}
                              <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 sm:col-span-2">
                                <div className="text-xs font-black uppercase tracking-wider text-amber-600">刺さる訴求角度</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {(Array.isArray(p?.messagingAngles) ? p.messagingAngles : [])
                                    .filter(Boolean)
                                    .slice(0, 8)
                                    .map((x: string, i: number) => (
                                      <button
                                        key={i}
                                        onClick={() => copyText(x)}
                                        className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-amber-300 hover:shadow-md hover:bg-amber-50"
                                      >
                                        {x}
                                      </button>
                                    ))}
                                </div>
                              </div>

                              {/* Best Offer & CTA */}
                              <div className="rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 p-4">
                                <div className="text-xs font-black uppercase tracking-wider text-purple-600">最適オファー</div>
                                <div className="mt-2 text-sm font-black text-slate-900">{p?.bestOffer || '—'}</div>
                              </div>
                              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 p-4">
                                <div className="text-xs font-black uppercase tracking-wider text-emerald-600">推奨CTA</div>
                                <div className="mt-2 text-sm font-black text-slate-900">{p?.recommendedCTA || '—'}</div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {!personaCount && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                            <Users className="h-8 w-8 text-slate-400" />
                          </div>
                          <p className="text-slate-500 font-bold">ペルソナが生成されませんでした</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Creative Tab */}
                  {tab === 'creative' && (
                    <div className="space-y-8">
                      {/* Hero Headlines */}
                      <div>
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                              <Lightbulb className="h-5 w-5 text-white" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900">キャッチコピー</h3>
                          </div>
                          <CopyButton text={JSON.stringify(out?.creative?.catchCopy ?? {}, null, 2)} />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          {(Array.isArray(out?.creative?.catchCopy?.heroHeadlines) ? out.creative.catchCopy.heroHeadlines : [])
                            .filter(Boolean)
                            .slice(0, 6)
                            .map((x: string, i: number) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="group relative flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 transition-all hover:border-purple-200 hover:shadow-lg cursor-pointer"
                                onClick={() => copyText(x)}
                              >
                                <div className="text-lg font-black leading-tight text-slate-900">{x}</div>
                                <ClipboardCopy className="h-4 w-4 text-slate-300 group-hover:text-purple-500 transition-colors flex-shrink-0" />
                              </motion.div>
                            ))}
                        </div>

                        {/* CTA Buttons */}
                        <div className="mt-5">
                          <div className="mb-3 text-sm font-black text-slate-600">CTAボタン</div>
                          <div className="flex flex-wrap gap-3">
                            {(Array.isArray(out?.creative?.catchCopy?.ctaButtons) ? out.creative.catchCopy.ctaButtons : [])
                              .filter(Boolean)
                              .slice(0, 5)
                              .map((x: string, i: number) => (
                                <button
                                  key={i}
                                  onClick={() => copyText(x)}
                                  className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-xl hover:scale-105"
                                >
                                  {x}
                                </button>
                              ))}
                          </div>
                        </div>
                      </div>

                      {/* LP Structure */}
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <TrendingUp className="h-5 w-5 text-white" />
                          </div>
                          <h3 className="text-lg font-black text-slate-900">LP構成（叩き台）</h3>
                        </div>
                        <div className="space-y-3">
                          {(Array.isArray(out?.creative?.lpStructure) ? out.creative.lpStructure : []).map((s: any, i: number) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-4">
                                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-black text-slate-600">
                                    {i + 1}
                                  </div>
                                  <div>
                                    <div className="font-black text-slate-900">{s?.section || `セクション${i + 1}`}</div>
                                    {s?.goal && <div className="mt-0.5 text-xs font-bold text-slate-500">目的: {s.goal}</div>}
                                  </div>
                                </div>
                                <CopyButton text={String(s?.copy || '')} />
                              </div>
                              <div className="mt-4 whitespace-pre-wrap text-sm font-bold text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-4">{s?.copy || '—'}</div>
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* Ads */}
                      <div className="grid gap-6 lg:grid-cols-2">
                        {/* Google Ads */}
                        <div>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                              <Search className="h-5 w-5 text-white" />
                            </div>
                            <h4 className="font-black text-slate-900">Google検索広告</h4>
                          </div>
                          <div className="space-y-3">
                            {(Array.isArray(out?.creative?.ads?.googleSearch) ? out.creative.ads.googleSearch : [])
                              .slice(0, 3)
                              .map((ad: any, i: number) => (
                                <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
                                  <div className="text-sm font-black text-blue-600">
                                    {ad?.headline1 || '—'} | {ad?.headline2 || '—'}
                                  </div>
                                  <div className="mt-1 text-sm font-bold text-slate-600">{ad?.description || '—'}</div>
                                  <div className="mt-2 flex items-center justify-between">
                                    <div className="text-xs font-bold text-emerald-600">
                                      example.com{ad?.path1 ? `/${ad.path1}` : ''}
                                      {ad?.path2 ? `/${ad.path2}` : ''}
                                    </div>
                                    <CopyButton text={JSON.stringify(ad, null, 2)} />
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Meta Ads */}
                        <div>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
                              <MessageSquare className="h-5 w-5 text-white" />
                            </div>
                            <h4 className="font-black text-slate-900">Meta広告</h4>
                          </div>
                          <div className="space-y-3">
                            {(Array.isArray(out?.creative?.ads?.metaAds) ? out.creative.ads.metaAds : [])
                              .slice(0, 3)
                              .map((ad: any, i: number) => (
                                <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
                                  <div className="text-sm font-bold text-slate-600 line-clamp-2">{ad?.primaryText || '—'}</div>
                                  <div className="mt-2 text-sm font-black text-slate-900">{ad?.headline || '—'}</div>
                                  <div className="mt-1 text-sm font-bold text-slate-500">{ad?.description || '—'}</div>
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
                                      {ad?.cta || 'Learn More'}
                                    </span>
                                    <CopyButton text={JSON.stringify(ad, null, 2)} />
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>

                      {/* Email */}
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Mail className="h-5 w-5 text-white" />
                          </div>
                          <h3 className="text-lg font-black text-slate-900">メール</h3>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-white p-5">
                            <div className="mb-3 flex items-center justify-between">
                              <div className="text-sm font-black text-slate-700">件名</div>
                              <CopyButton text={JSON.stringify(out?.creative?.email?.subjectLines ?? [], null, 2)} />
                            </div>
                            <div className="space-y-2">
                              {(Array.isArray(out?.creative?.email?.subjectLines) ? out.creative.email.subjectLines : [])
                                .filter(Boolean)
                                .slice(0, 5)
                                .map((x: string, i: number) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-4 py-2.5 text-sm hover:bg-slate-100 cursor-pointer transition-colors"
                                    onClick={() => copyText(x)}
                                  >
                                    <span className="font-bold text-slate-700">{x}</span>
                                    <ClipboardCopy className="h-3.5 w-3.5 text-slate-400" />
                                  </div>
                                ))}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-5">
                            <div className="text-sm font-black text-slate-700">本文（ドラフト）</div>
                            <div className="mt-3 space-y-3">
                              {(Array.isArray(out?.creative?.email?.bodyDrafts) ? out.creative.email.bodyDrafts : [])
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((x: string, i: number) => (
                                  <div key={i} className="rounded-lg bg-slate-50 p-4">
                                    <div className="mb-2 flex items-center justify-between">
                                      <span className="text-xs font-black text-slate-500">ドラフト {i + 1}</span>
                                      <CopyButton text={x} />
                                    </div>
                                    <div className="max-h-32 overflow-y-auto text-sm font-bold text-slate-700 whitespace-pre-wrap leading-relaxed">{x}</div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Checklist Tab */}
                  {tab === 'checklist' && (
                    <div className="space-y-4">
                      {(Array.isArray(out?.marketingChecklist) ? out.marketingChecklist : [])
                        .slice(0, 20)
                        .map((c: any, i: number) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <span
                                  className={`rounded-lg px-3 py-1.5 text-xs font-black ${badgeClass(c?.priority)}`}
                                >
                                  {String(c?.priority || 'medium').toUpperCase()}
                                </span>
                                <div className="font-black text-slate-900">{c?.item || '—'}</div>
                              </div>
                              <CopyButton text={JSON.stringify(c, null, 2)} />
                            </div>
                            {c?.reason && <div className="mt-3 text-sm font-bold text-slate-600">理由: {c.reason}</div>}
                            {c?.example && (
                              <div className="mt-3 rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {c.example}
                              </div>
                            )}
                          </motion.div>
                        ))}

                      {!checklistCount && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                            <CheckCircle2 className="h-8 w-8 text-slate-400" />
                          </div>
                          <p className="font-bold text-slate-500">チェックリストがありません</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* JSON Tab */}
                  {tab === 'json' && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-blue-800">
                          <Lightbulb className="h-4 w-4" />
                          JSONを直接編集できます。編集後はそのままコピー/保存してください。
                        </div>
                      </div>

                      <textarea
                        className="h-[480px] w-full rounded-xl border border-slate-300 bg-slate-900 p-4 font-mono text-xs text-slate-100 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10"
                        value={jsonText}
                        onChange={(e) => setJsonText(e.target.value)}
                        spellCheck={false}
                      />

                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold">
                          {jsonError ? (
                            <span className="text-red-600">エラー: {jsonError}</span>
                          ) : (
                            <span className="text-emerald-600">✓ JSON OK</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyText(jsonText)}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
                          >
                            <ClipboardCopy className="h-4 w-4" />
                            コピー
                          </button>
                          <button
                            disabled={!parsedJson || !!jsonError}
                            onClick={() => parsedJson && downloadJson('doya-persona-output.json', parsedJson)}
                            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50 hover:bg-slate-800"
                          >
                            <Download className="h-4 w-4" />
                            保存
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

