'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
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
  Lock,
  RefreshCw,
  Sparkles,
  Target,
  Users,
  Zap,
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
    icon: Target,
    color: 'from-blue-500 to-indigo-600',
  },
  {
    title: 'ペルソナを自動生成',
    description: 'サイト情報から理想の顧客像を設計。デモグラ・悩み・目標・反論・購買トリガーまで網羅。',
    icon: Users,
    color: 'from-purple-500 to-pink-600',
  },
  {
    title: '売れるコピーを提案',
    description: 'キャッチコピー・LP構成・広告文・メール文まで、そのまま使えるクリエイティブを一括生成。',
    icon: Sparkles,
    color: 'from-amber-500 to-orange-600',
  },
  {
    title: '施策チェックリスト',
    description: 'マーケティング改善ポイントを優先度付きでリストアップ。次にやるべきことが明確に。',
    icon: CheckCircle2,
    color: 'from-emerald-500 to-teal-600',
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
  if (p === 'high') return 'bg-red-100 text-red-700 border-red-200'
  if (p === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
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
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
      {/* Progress dots */}
      <div className="absolute left-0 right-0 top-4 flex justify-center gap-2">
        {ONBOARDING_SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-2 rounded-full transition-all ${
              idx === current ? 'w-8 bg-slate-900' : 'w-2 bg-slate-300 hover:bg-slate-400'
            }`}
          />
        ))}
      </div>

      <div className="px-6 pb-6 pt-12">
        <div className="flex flex-col items-center text-center">
          <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${slide.color}`}>
            <Icon className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">{slide.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{slide.description}</p>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={prev}
            disabled={current === 0}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            戻る
          </button>

          <button
            onClick={next}
            className="flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {current === ONBOARDING_SLIDES.length - 1 ? '始める' : '次へ'}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
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
      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
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
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
        active
          ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
          : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
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
        // Handle usage limit error
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 shadow-lg">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">ドヤペルソナ</h1>
                  <p className="text-sm text-slate-500">URLから売れるペルソナ＆クリエイティブを自動生成</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {usageInfo && usageInfo.dailyLimit > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <span className="text-slate-500">残り</span>
                  <span className="ml-1 font-semibold text-slate-900">{usageInfo.dailyRemaining}</span>
                  <span className="text-slate-500">/{usageInfo.dailyLimit}回</span>
                </div>
              )}

              {!isLoggedIn && (
                <Link
                  href="/auth/doyamarke/signin?callbackUrl=%2Fpersona"
                  className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  ログインで回数UP
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left: Input Panel */}
          <div className="lg:col-span-4">
            {/* Onboarding */}
            {showOnboarding && (
              <div className="mb-6">
                <OnboardingCarousel onClose={handleCloseOnboarding} />
              </div>
            )}

            {/* Input Form */}
            <div className="sticky top-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  <h2 className="text-lg font-semibold text-slate-900">サイト解析</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      サイトURL <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition-colors focus:border-slate-900 focus:bg-white"
                      placeholder="https://example.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">商品/サービス名</label>
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-slate-900 focus:bg-white"
                        placeholder="例: ドヤAI"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">価格/プラン</label>
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-slate-900 focus:bg-white"
                        placeholder="例: 月額9,980円"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">特徴/強み</label>
                    <textarea
                      className="h-20 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-slate-900 focus:bg-white"
                      placeholder="AIで広告バナーを自動生成..."
                      value={features}
                      onChange={(e) => setFeatures(e.target.value)}
                    />
                  </div>

                  {/* Advanced Options Toggle */}
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    詳細オプション
                    <ChevronRight className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                  </button>

                  {showAdvanced && (
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">ターゲット補足</label>
                        <input
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
                          placeholder="例: 40代の中小企業経営者"
                          value={target}
                          onChange={(e) => setTarget(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">目的（CV）</label>
                        <input
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
                          value={objective}
                          onChange={(e) => setObjective(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">必須要素</label>
                          <textarea
                            className="h-16 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
                            value={mustInclude}
                            onChange={(e) => setMustInclude(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">NG/避ける表現</label>
                          <textarea
                            className="h-16 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
                            value={avoid}
                            onChange={(e) => setAvoid(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">その他メモ</label>
                        <textarea
                          className="h-16 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:shadow-xl disabled:opacity-50"
                    disabled={loading || !url.trim()}
                    onClick={onGenerate}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        解析・生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        ペルソナ＆クリエイティブを生成
                      </>
                    )}
                  </button>
                </div>

                {error && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <div className="font-medium">エラー</div>
                    <div className="mt-1">{error}</div>
                    {error.includes('上限') && (
                      <Link
                        href="/banner/pricing"
                        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-red-700 underline hover:text-red-900"
                      >
                        プランをアップグレード
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Pro Plan CTA */}
              {!user?.bannerPlan || user?.bannerPlan === 'FREE' ? (
                <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
                      <Zap className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">プロプランで無制限に</h3>
                      <p className="mt-1 text-sm text-slate-600">1日50回まで生成可能。全機能が使えます。</p>
                      <Link
                        href="/banner/pricing"
                        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-800"
                      >
                        プランを見る
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right: Results Panel */}
          <div className="lg:col-span-8">
            {!data ? (
              <div className="flex h-96 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50">
                <Target className="mb-4 h-12 w-12 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-700">結果がここに表示されます</h3>
                <p className="mt-2 text-sm text-slate-500">左のフォームにURLを入力して「生成」ボタンを押してください</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Tabs */}
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-100/50 p-2">
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
                    icon={Download}
                    label="JSON"
                  />
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-slate-500">
                    解析元: <span className="font-medium text-slate-700">{site?.title || site?.url}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onGenerate}
                      disabled={loading}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                      再生成
                    </button>
                    <button
                      onClick={() => data && downloadJson('doya-persona.json', data)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
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
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-slate-900">解析したサイト</h3>
                          <a
                            href={site?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
                          >
                            開く <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                        <div className="mt-3 space-y-2 text-sm">
                          <div>
                            <span className="font-medium text-slate-700">タイトル:</span>{' '}
                            <span className="text-slate-600">{site?.title || '—'}</span>
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">説明:</span>{' '}
                            <span className="text-slate-600">{site?.description || '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Site Summary */}
                      <div>
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-slate-900">提案の核</h3>
                          <CopyButton text={JSON.stringify(out.siteSummary ?? {}, null, 2)} />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">業界</div>
                            <div className="mt-2 text-lg font-semibold text-slate-900">{out?.siteSummary?.industry || '—'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-purple-50 to-pink-50 p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-purple-600">オファー</div>
                            <div className="mt-2 text-lg font-semibold text-slate-900">{out?.siteSummary?.offer || '—'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">価値提案</div>
                            <div className="mt-2 text-slate-900">{out?.siteSummary?.valueProposition || '—'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">主CTA</div>
                            <div className="mt-2 font-medium text-slate-900">{out?.siteSummary?.primaryCTA || '—'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">副CTA</div>
                            <div className="mt-2 font-medium text-slate-900">{out?.siteSummary?.secondaryCTA || '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Personas Tab */}
                  {tab === 'personas' && (
                    <div className="space-y-6">
                      {(Array.isArray(out?.personas) ? out.personas : []).map((p: any, idx: number) => (
                        <div key={p?.id || idx} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                          {/* Persona Header */}
                          <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-lg font-bold text-white">
                                {(p?.name || `P${idx + 1}`).charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-900">{p?.name || `ペルソナ${idx + 1}`}</h4>
                                {p?.archetype && <div className="text-sm text-slate-500">{p.archetype}</div>}
                              </div>
                            </div>
                            <CopyButton text={JSON.stringify(p, null, 2)} />
                          </div>

                          {/* Persona Content */}
                          <div className="p-5">
                            <div className="grid gap-4 sm:grid-cols-2">
                              {/* Situation */}
                              <div className="rounded-lg bg-slate-50 p-4 sm:col-span-2">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">状況</div>
                                <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{p?.situation || '—'}</div>
                              </div>

                              {/* Goals */}
                              <div className="rounded-lg bg-emerald-50 p-4">
                                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">目標</div>
                                <ul className="mt-2 space-y-1.5">
                                  {(Array.isArray(p?.goals) ? p.goals : [])
                                    .filter(Boolean)
                                    .slice(0, 5)
                                    .map((x: string, i: number) => (
                                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                                        {x}
                                      </li>
                                    ))}
                                </ul>
                              </div>

                              {/* Pains */}
                              <div className="rounded-lg bg-red-50 p-4">
                                <div className="text-xs font-semibold uppercase tracking-wide text-red-600">悩み</div>
                                <ul className="mt-2 space-y-1.5">
                                  {(Array.isArray(p?.pains) ? p.pains : [])
                                    .filter(Boolean)
                                    .slice(0, 5)
                                    .map((x: string, i: number) => (
                                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                        <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                                        {x}
                                      </li>
                                    ))}
                                </ul>
                              </div>

                              {/* Messaging Angles */}
                              <div className="rounded-lg bg-amber-50 p-4 sm:col-span-2">
                                <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">刺さる訴求角度</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {(Array.isArray(p?.messagingAngles) ? p.messagingAngles : [])
                                    .filter(Boolean)
                                    .slice(0, 8)
                                    .map((x: string, i: number) => (
                                      <button
                                        key={i}
                                        onClick={() => copyText(x)}
                                        className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-amber-300 hover:shadow-md"
                                      >
                                        {x}
                                      </button>
                                    ))}
                                </div>
                              </div>

                              {/* Best Offer & CTA */}
                              <div className="rounded-lg bg-white border border-slate-200 p-4">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">最適オファー</div>
                                <div className="mt-2 text-sm font-medium text-slate-900">{p?.bestOffer || '—'}</div>
                              </div>
                              <div className="rounded-lg bg-white border border-slate-200 p-4">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">推奨CTA</div>
                                <div className="mt-2 text-sm font-medium text-slate-900">{p?.recommendedCTA || '—'}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {!personaCount && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Users className="mb-4 h-12 w-12 text-slate-300" />
                          <p className="text-slate-500">ペルソナが生成されませんでした</p>
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
                          <div className="flex items-center gap-2">
                            <Lightbulb className="h-5 w-5 text-amber-500" />
                            <h3 className="text-lg font-semibold text-slate-900">キャッチコピー</h3>
                          </div>
                          <CopyButton text={JSON.stringify(out?.creative?.catchCopy ?? {}, null, 2)} />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          {(Array.isArray(out?.creative?.catchCopy?.heroHeadlines) ? out.creative.catchCopy.heroHeadlines : [])
                            .filter(Boolean)
                            .slice(0, 6)
                            .map((x: string, i: number) => (
                              <div
                                key={i}
                                className="group flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 transition-all hover:border-slate-300 hover:shadow-md"
                              >
                                <div className="text-lg font-semibold leading-tight text-slate-900">{x}</div>
                                <button
                                  onClick={() => copyText(x)}
                                  className="opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                  <ClipboardCopy className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                                </button>
                              </div>
                            ))}
                        </div>

                        {/* CTA Buttons */}
                        <div className="mt-4">
                          <div className="mb-2 text-sm font-medium text-slate-600">CTAボタン</div>
                          <div className="flex flex-wrap gap-2">
                            {(Array.isArray(out?.creative?.catchCopy?.ctaButtons) ? out.creative.catchCopy.ctaButtons : [])
                              .filter(Boolean)
                              .slice(0, 5)
                              .map((x: string, i: number) => (
                                <button
                                  key={i}
                                  onClick={() => copyText(x)}
                                  className="rounded-lg bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl"
                                >
                                  {x}
                                </button>
                              ))}
                          </div>
                        </div>
                      </div>

                      {/* LP Structure */}
                      <div>
                        <h3 className="mb-4 text-lg font-semibold text-slate-900">LP構成（叩き台）</h3>
                        <div className="space-y-3">
                          {(Array.isArray(out?.creative?.lpStructure) ? out.creative.lpStructure : []).map((s: any, i: number) => (
                            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                                    {i + 1}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-slate-900">{s?.section || `セクション${i + 1}`}</div>
                                    {s?.goal && <div className="mt-0.5 text-xs text-slate-500">目的: {s.goal}</div>}
                                  </div>
                                </div>
                                <CopyButton text={String(s?.copy || '')} />
                              </div>
                              <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{s?.copy || '—'}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Ads */}
                      <div className="grid gap-6 lg:grid-cols-2">
                        {/* Google Ads */}
                        <div>
                          <h4 className="mb-3 font-semibold text-slate-900">Google検索広告</h4>
                          <div className="space-y-3">
                            {(Array.isArray(out?.creative?.ads?.googleSearch) ? out.creative.ads.googleSearch : [])
                              .slice(0, 3)
                              .map((ad: any, i: number) => (
                                <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                                  <div className="text-sm font-semibold text-blue-600">
                                    {ad?.headline1 || '—'} | {ad?.headline2 || '—'}
                                  </div>
                                  <div className="mt-1 text-sm text-slate-600">{ad?.description || '—'}</div>
                                  <div className="mt-2 flex items-center justify-between">
                                    <div className="text-xs text-emerald-600">
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
                          <h4 className="mb-3 font-semibold text-slate-900">Meta広告</h4>
                          <div className="space-y-3">
                            {(Array.isArray(out?.creative?.ads?.metaAds) ? out.creative.ads.metaAds : [])
                              .slice(0, 3)
                              .map((ad: any, i: number) => (
                                <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                                  <div className="text-sm text-slate-600">{ad?.primaryText || '—'}</div>
                                  <div className="mt-2 text-sm font-semibold text-slate-900">{ad?.headline || '—'}</div>
                                  <div className="mt-1 text-sm text-slate-500">{ad?.description || '—'}</div>
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
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
                        <h3 className="mb-4 text-lg font-semibold text-slate-900">メール</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <div className="text-sm font-semibold text-slate-700">件名</div>
                              <CopyButton text={JSON.stringify(out?.creative?.email?.subjectLines ?? [], null, 2)} />
                            </div>
                            <div className="space-y-2">
                              {(Array.isArray(out?.creative?.email?.subjectLines) ? out.creative.email.subjectLines : [])
                                .filter(Boolean)
                                .slice(0, 5)
                                .map((x: string, i: number) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                                  >
                                    <span className="text-slate-700">{x}</span>
                                    <button onClick={() => copyText(x)}>
                                      <ClipboardCopy className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
                                    </button>
                                  </div>
                                ))}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="text-sm font-semibold text-slate-700">本文（ドラフト）</div>
                            <div className="mt-3 space-y-3">
                              {(Array.isArray(out?.creative?.email?.bodyDrafts) ? out.creative.email.bodyDrafts : [])
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((x: string, i: number) => (
                                  <div key={i} className="rounded-lg bg-slate-50 p-3">
                                    <div className="mb-2 flex items-center justify-between">
                                      <span className="text-xs font-medium text-slate-500">ドラフト {i + 1}</span>
                                      <CopyButton text={x} />
                                    </div>
                                    <div className="max-h-32 overflow-y-auto text-sm text-slate-700 whitespace-pre-wrap">{x}</div>
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
                          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <span
                                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(c?.priority)}`}
                                >
                                  {String(c?.priority || 'medium').toUpperCase()}
                                </span>
                                <div className="font-semibold text-slate-900">{c?.item || '—'}</div>
                              </div>
                              <CopyButton text={JSON.stringify(c, null, 2)} />
                            </div>
                            {c?.reason && <div className="mt-2 text-sm text-slate-600">理由: {c.reason}</div>}
                            {c?.example && (
                              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
                                {c.example}
                              </div>
                            )}
                          </div>
                        ))}

                      {!checklistCount && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <CheckCircle2 className="mb-4 h-12 w-12 text-slate-300" />
                          <p className="text-slate-500">チェックリストがありません</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* JSON Tab */}
                  {tab === 'json' && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="h-4 w-4" />
                          JSONを直接編集できます。編集後はそのままコピー/保存してください。
                        </div>
                      </div>

                      <textarea
                        className="h-[480px] w-full rounded-xl border border-slate-300 bg-slate-900 p-4 font-mono text-xs text-slate-100 outline-none focus:border-slate-600"
                        value={jsonText}
                        onChange={(e) => setJsonText(e.target.value)}
                        spellCheck={false}
                      />

                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          {jsonError ? (
                            <span className="text-red-600">エラー: {jsonError}</span>
                          ) : (
                            <span className="text-emerald-600">✓ JSON OK</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyText(jsonText)}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                          >
                            <ClipboardCopy className="h-4 w-4" />
                            コピー
                          </button>
                          <button
                            disabled={!parsedJson || !!jsonError}
                            onClick={() => parsedJson && downloadJson('doya-persona-output.json', parsedJson)}
                            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            <Download className="h-4 w-4" />
                            保存
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
