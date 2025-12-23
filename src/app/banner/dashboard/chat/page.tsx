'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import DashboardSidebar from '@/components/DashboardSidebar'
import LoadingProgress from '@/components/LoadingProgress'
import { Send, Sparkles, Bot, User, Wand2, Image as ImageIcon, Download, MessageSquare, ArrowRight, Bell, Settings } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getNotificationPermission,
  isBrowserNotificationSupported,
  readNotifyOnComplete,
  requestNotificationPermission,
  sendBrowserNotification,
  writeNotifyOnComplete,
} from '@/lib/browser-notify'

type ChatMsg = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

type BannerSpec = {
  purpose: string
  category: string
  size: string
  keyword: string
  imageDescription?: string
  brandColors?: string[]
}

const DEFAULT_REFINE_PREDICT_MS = 45_000
const REFINEMENT_PHASES = [
  '指示を読み取り中',
  'レイアウト調整中',
  'テキスト最適化中',
  '訴求/CTA強調中',
  '最終チェック中',
]
const REFINEMENT_TIPS = [
  '例：「CTAをもっと目立たせて」「人物をもう少し明るく」「背景をシンプルに」',
  '「文字を太めに」「余白を減らして」「価格を入れて」なども効果的です',
  '「Instagram向け」「YouTube向け」など媒体を指定すると安定します',
  '「配色は青/白で」「高級感」「ポップ」などトーン指定が効きます',
  '長文は要点3つくらいに絞ると反映が安定します',
]

function readRefineEmaMs(): number {
  try {
    const v = localStorage.getItem('doya-refine-ema-ms')
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_REFINE_PREDICT_MS
  } catch {
    return DEFAULT_REFINE_PREDICT_MS
  }
}

function writeRefineEmaMs(ms: number) {
  try {
    localStorage.setItem('doya-refine-ema-ms', String(Math.max(1000, Math.floor(ms))))
  } catch {
    // ignore
  }
}

function updateEma(prev: number, next: number, alpha = 0.25) {
  const p = Number.isFinite(prev) && prev > 0 ? prev : next
  const n = Number.isFinite(next) && next > 0 ? next : p
  return Math.round(p * (1 - alpha) + n * alpha)
}

export default function BannerChatPage() {
  const { data: session } = useSession()
  const [notifyOnComplete, setNotifyOnComplete] = useState(false)
  const [logoImage, setLogoImage] = useState<string | null>(null)
  const [logoFileName, setLogoFileName] = useState('')
  const [personImages, setPersonImages] = useState<string[]>([])
  const [personFileNames, setPersonFileNames] = useState<string[]>([])
  const [generateCount, setGenerateCount] = useState<number>(3)
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'hello-1',
      role: 'assistant',
      content:
        'AIチャットでバナーを作れます。\n「何の商品/誰向け/どこで使う（SNS/YouTube/LPなど）/どんな雰囲気（人物・背景・色）」を自由に書いてください。',
      createdAt: Date.now(),
    },
  ])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [proposedSpec, setProposedSpec] = useState<BannerSpec | null>(null)
  const [generatedBanners, setGeneratedBanners] = useState<string[]>([])
  const [selectedBannerIndex, setSelectedBannerIndex] = useState(0)
  const [refineInstruction, setRefineInstruction] = useState('')

  const [refineStartedAt, setRefineStartedAt] = useState<number | null>(null)
  const [refineElapsedSec, setRefineElapsedSec] = useState(0)
  const [predictedRefineTotalMs, setPredictedRefineTotalMs] = useState<number>(DEFAULT_REFINE_PREDICT_MS)
  const [predictedRefineRemainingMs, setPredictedRefineRemainingMs] = useState<number>(DEFAULT_REFINE_PREDICT_MS)
  const [refineTipIndex, setRefineTipIndex] = useState(0)
  const [refinePhaseIndex, setRefinePhaseIndex] = useState(0)

  const endRef = useRef<HTMLDivElement | null>(null)
  const refinePanelRef = useRef<HTMLDivElement | null>(null)

  // 完了通知設定（全ページ共通で永続化）
  useEffect(() => {
    setNotifyOnComplete(readNotifyOnComplete())
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, generatedBanners.length, proposedSpec?.keyword])

  const canSend = input.trim().length > 0 && !isThinking && !isGenerating && !isRefining

  const isGuest = !session
  const bannerPlan = session
    ? String((session.user as any)?.bannerPlan || (session.user as any)?.plan || 'FREE').toUpperCase()
    : 'GUEST'
  const isProUser = !isGuest && bannerPlan === 'PRO'

  useEffect(() => {
    if (!isProUser) {
      if (generateCount !== 3) setGenerateCount(3)
      return
    }
    if (generateCount < 3) setGenerateCount(3)
    if (generateCount > 10) setGenerateCount(10)
  }, [isProUser, generateCount])

  const summary = useMemo(() => {
    if (!proposedSpec) return null
    const parts = [
      `用途: ${proposedSpec.purpose}`,
      `業種: ${proposedSpec.category}`,
      `サイズ: ${proposedSpec.size}`,
    ]
    return parts.join(' / ')
  }, [proposedSpec])

  const pushAssistant = (content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `a-${Date.now()}`, role: 'assistant', content, createdAt: Date.now() },
    ])
  }

  const handleSend = async () => {
    if (!canSend) return
    const text = input.trim()
    setInput('')
    setGeneratedBanners([])
    setProposedSpec(null)
    setSelectedBannerIndex(0)
    setRefineInstruction('')
    // ロゴ/人物はチャット中に保持してOK（会話をまたいで使える）

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: text, createdAt: Date.now() },
    ])

    setIsThinking(true)
    try {
      const res = await fetch('/api/banner/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { id: 'tmp', role: 'user', content: text, createdAt: Date.now() }]
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AIチャットに失敗しました')

      pushAssistant(String(data.reply || '了解です。'))
      if (data.spec) {
        setProposedSpec(data.spec as BannerSpec)
      } else {
        setProposedSpec(null)
      }
    } catch (e: any) {
      pushAssistant('すみません、エラーが発生しました。もう一度お試しください。')
      toast.error(e?.message || 'エラーが発生しました')
    } finally {
      setIsThinking(false)
    }
  }

  const handleGenerate = async () => {
    if (!proposedSpec || isGenerating) return
    setIsGenerating(true)
    setGeneratedBanners([])
    setSelectedBannerIndex(0)
    try {
      const res = await fetch('/api/banner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: proposedSpec.category,
          purpose: proposedSpec.purpose,
          size: proposedSpec.size,
          keyword: proposedSpec.keyword,
          count: generateCount,
          imageDescription: proposedSpec.imageDescription,
          brandColors: proposedSpec.brandColors,
          logoImage: logoImage || undefined,
          personImages: personImages.length > 0 ? personImages : undefined,
          // 後方互換（念のため）
          personImage: personImages[0] || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成に失敗しました')
      setGeneratedBanners(Array.isArray(data.banners) ? data.banners : [])
      setSelectedBannerIndex(0)
      pushAssistant('生成できました。気になる案をダウンロードして使えます。')
      if (notifyOnComplete) {
        sendBrowserNotification('ドヤバナーAI', 'AIチャットのバナー生成が完了しました（A/B/C）')
      }
    } catch (e: any) {
      pushAssistant('生成に失敗しました。条件を少し変えてもう一度試してください。')
      toast.error(e?.message || '生成に失敗しました')
    } finally {
      setIsGenerating(false)
    }
  }

  const canRefine =
    generatedBanners.length > 0 &&
    !isThinking &&
    !isGenerating &&
    !isRefining &&
    refineInstruction.trim().length >= 3 &&
    selectedBannerIndex >= 0 &&
    selectedBannerIndex < generatedBanners.length

  // 修正進捗UI（予測残り/フェーズ/チップ）
  useEffect(() => {
    if (!isRefining) {
      setRefineStartedAt(null)
      setRefineElapsedSec(0)
      setPredictedRefineTotalMs(readRefineEmaMs())
      setPredictedRefineRemainingMs(readRefineEmaMs())
      setRefinePhaseIndex(0)
      setRefineTipIndex(0)
      return
    }
    const started = refineStartedAt ?? Date.now()
    if (!refineStartedAt) setRefineStartedAt(started)
    const tick = setInterval(() => setRefineElapsedSec(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(tick)
  }, [isRefining, refineStartedAt])

  useEffect(() => {
    if (!isRefining || !refineStartedAt) return
    const t = setInterval(() => {
      const elapsedMs = Date.now() - refineStartedAt
      const total = predictedRefineTotalMs || DEFAULT_REFINE_PREDICT_MS
      const remaining = Math.max(0, total - elapsedMs)
      setPredictedRefineRemainingMs(remaining)

      const r = elapsedMs / Math.max(1, total)
      const idx = r < 0.2 ? 0 : r < 0.4 ? 1 : r < 0.6 ? 2 : r < 0.8 ? 3 : 4
      setRefinePhaseIndex(idx)
    }, 500)
    return () => clearInterval(t)
  }, [isRefining, refineStartedAt, predictedRefineTotalMs])

  useEffect(() => {
    if (!isRefining) return
    const t = setInterval(() => setRefineTipIndex((prev) => (prev + 1) % REFINEMENT_TIPS.length), 4800)
    return () => clearInterval(t)
  }, [isRefining])

  const handleRefine = async () => {
    if (!canRefine) return
    const instruction = refineInstruction.trim()
    const idx = selectedBannerIndex
    const originalImage = generatedBanners[idx]
    setIsRefining(true)
    const startedAt = Date.now()
    try {
      const res = await fetch('/api/banner/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImage,
          instruction,
          category: proposedSpec?.category,
          size: proposedSpec?.size,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) throw new Error(data?.error || '修正に失敗しました')
      const refined = String(data.refinedImage || '')
      if (!refined.startsWith('data:')) throw new Error('修正画像が取得できませんでした')

      setGeneratedBanners((prev) => prev.map((b, i) => (i === idx ? refined : b)))
      pushAssistant('修正できました。気になる点があれば、さらに指示して改善できます。')
      toast.success('AIで修正しました')
      if (notifyOnComplete) {
        sendBrowserNotification('ドヤバナーAI', `AIチャットのバナー修正が完了しました（PATTERN ${String.fromCharCode(65 + idx)}）`)
      }

      // EMA更新（次回予測用）
      const actualMs = Date.now() - startedAt
      const next = updateEma(readRefineEmaMs(), actualMs)
      writeRefineEmaMs(next)
      setPredictedRefineTotalMs(next)
    } catch (e: any) {
      pushAssistant('修正に失敗しました。指示を短くして、もう一度お試しください。')
      toast.error(e?.message || '修正に失敗しました')
    } finally {
      setIsRefining(false)
    }
  }

  const downloadImage = (dataUrl: string, name: string) => {
    try {
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch {
      toast.error('ダウンロードに失敗しました')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      <DashboardSidebar />
      <div className="pl-[72px] md:pl-[240px] transition-all duration-200">
        <LoadingProgress isLoading={isThinking || isGenerating || isRefining} />

        {/* ========================================
            Header - Doya Banner Style
            ======================================== */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-8">
            <div className="h-16 sm:h-20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/banner/dashboard" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <ArrowRight className="w-5 h-5 text-slate-400 rotate-180" />
                </Link>
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                  ドヤバナーAI チャット
                </h1>
              </div>
              
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="hidden md:flex items-center gap-2">
                  <button
                    className={`p-2.5 rounded-full transition-all relative ${
                      notifyOnComplete ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                    title={`完了通知 ${notifyOnComplete ? 'ON' : 'OFF'}`}
                    onClick={async () => {
                      if (!isBrowserNotificationSupported()) {
                        toast.error('このブラウザは通知に対応していません')
                        return
                      }
                      const perm = getNotificationPermission()
                      if (perm === 'granted') {
                        setNotifyOnComplete((v) => {
                          const next = !v
                          writeNotifyOnComplete(next)
                          if (next) {
                            sendBrowserNotification('ドヤバナーAI', '完了通知がONになりました（テスト通知）')
                            toast.success('完了通知をONにしました')
                          } else {
                            toast('完了通知をOFFにしました')
                          }
                          return next
                        })
                        return
                      }
                      const asked = await requestNotificationPermission()
                      if (asked === 'granted') {
                        setNotifyOnComplete(true)
                        writeNotifyOnComplete(true)
                        sendBrowserNotification('ドヤバナーAI', '完了通知がONになりました（テスト通知）')
                        toast.success('完了通知をONにしました')
                      } else {
                        setNotifyOnComplete(false)
                        writeNotifyOnComplete(false)
                        toast.error('通知が許可されませんでした（ブラウザ設定から許可してください）')
                      }
                    }}
                  >
                    <Bell className="w-5 h-5" />
                    {notifyOnComplete && (
                      <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full border-2 border-white" />
                    )}
                  </button>
                  <button className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
                <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                <div className="flex items-center gap-3 pl-2">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-800 leading-none">{session?.user?.name || '田中 太郎'}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Admin</p>
                  </div>
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-blue-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                    {session?.user?.image ? (
                      <img src={session.user.image} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                        {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

          <div className="grid lg:grid-cols-[1fr_360px] gap-4">
            {/* Chat */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[700px]">
              <div className="px-6 py-4 border-b border-gray-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-sm font-bold text-slate-800">AIアドバイザー</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Support</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center border-2 border-white shadow-sm ${
                        m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'
                      }`}>
                        {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                      </div>
                      <div
                        className={`rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${
                          m.role === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-none font-medium'
                            : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none font-medium'
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <div className="p-6 border-t border-gray-100 bg-slate-50/30">
                <div className="relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="こちらにバナーの要件を入力してください...（Enter=改行 / Ctrl+Enter or ⌘+Enter=送信）"
                    rows={2}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-6 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm font-medium resize-none"
                    onKeyDown={(e) => {
                      // Enter は改行。送信は Ctrl/⌘+Enter のみ。
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        void handleSend()
                      }
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!canSend}
                    className="absolute right-3 bottom-4 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-4 px-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Suggested:</span>
                  <button onClick={() => setInput("Instagram向けの美容系バナー")} className="text-[10px] font-bold text-blue-600 hover:underline">美容系バナー</button>
                  <button onClick={() => setInput("求人募集のSNS広告")} className="text-[10px] font-bold text-blue-600 hover:underline">求人募集</button>
                </div>
              </div>
            </div>

            {/* Proposal / Result */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-60" />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-blue-600" />
                      生成プラン案
                    </p>
                    {proposedSpec && (
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 text-[10px] font-black rounded-full uppercase tracking-wider animate-pulse">
                        Ready to Generate
                      </span>
                    )}
                  </div>

                  {!proposedSpec ? (
                    <div className="py-12 text-center px-6">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                        <Wand2 className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed font-bold">
                        チャットに要件を入力してください。<br />AIが自動で最適なプランを構成します。
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {summary.split(' / ').map((s, i) => (
                            <span key={i} className="px-3 py-1.5 bg-white rounded-xl text-[11px] font-bold text-slate-600 border border-slate-100 shadow-sm">
                              {s}
                            </span>
                          ))}
                        </div>
                        
                        <div className="pt-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">訴求キーワード</p>
                          <p className="text-base font-black text-slate-800 leading-relaxed">
                            {proposedSpec.keyword}
                          </p>
                        </div>

                        {proposedSpec.imageDescription && (
                          <div className="pt-2 border-t border-slate-200">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">ビジュアル指示</p>
                            <p className="text-xs text-slate-600 leading-relaxed italic font-medium">
                              "{proposedSpec.imageDescription}"
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Logo / Person Upload */}
                      <div className="rounded-2xl border border-slate-100 bg-white p-5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">ロゴ / 人物写真（任意）</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-black text-slate-700">ロゴ</p>
                              {logoImage && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLogoImage(null)
                                    setLogoFileName('')
                                    toast('ロゴを解除しました')
                                  }}
                                  className="text-xs font-black text-slate-500 hover:text-slate-900"
                                >
                                  解除
                                </button>
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-3">
                              <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center">
                                {logoImage ? (
                                  <img src={logoImage} alt="logo" className="h-full w-full object-contain" />
                                ) : (
                                  <span className="text-[10px] font-black text-slate-400">LOGO</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-slate-600 font-bold truncate">{logoFileName || '未設定'}</p>
                                <label className="mt-1 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-black text-slate-800 cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const f = e.target.files?.[0]
                                      e.target.value = ''
                                      if (!f) return
                                      try {
                                        if (!f.type.startsWith('image/')) throw new Error('画像ファイルを選択してください')
                                        if (f.size > 6 * 1024 * 1024) throw new Error('画像が大きすぎます（6MB以内）')
                                        const url = await new Promise<string>((resolve, reject) => {
                                          const r = new FileReader()
                                          r.onload = () => resolve(String(r.result || ''))
                                          r.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
                                          r.readAsDataURL(f)
                                        })
                                        setLogoImage(url)
                                        setLogoFileName(f.name)
                                        toast.success('ロゴを設定しました')
                                      } catch (err: any) {
                                        toast.error(err?.message || 'ロゴの設定に失敗しました')
                                      }
                                    }}
                                  />
                                  アップロード
                                </label>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-black text-slate-700">人物写真</p>
                              {personImages.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPersonImages([])
                                    setPersonFileNames([])
                                    toast('人物写真をすべて解除しました')
                                  }}
                                  className="text-xs font-black text-slate-500 hover:text-slate-900"
                                >
                                  全解除
                                </button>
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                {personImages.length > 0 ? (
                                  <div className="flex -space-x-2">
                                    {personImages.slice(0, 3).map((p, idx) => (
                                      <div key={idx} className="h-12 w-12 rounded-xl bg-white border border-slate-200 overflow-hidden">
                                        <img src={p} alt={`person-${idx}`} className="h-full w-full object-cover" />
                                      </div>
                                    ))}
                                    {personImages.length > 3 && (
                                      <div className="h-12 w-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600">
                                        +{personImages.length - 3}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center">
                                    <span className="text-[10px] font-black text-slate-400">PERSON</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-slate-600 font-bold truncate">
                                  {personImages.length > 0 ? `${personImages.length}枚設定済み` : '未設定'}
                                </p>
                                <label className="mt-1 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-black text-slate-800 cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={async (e) => {
                                      const files = e.target.files
                                      e.target.value = ''
                                      try {
                                        if (!files || files.length === 0) return
                                        const MAX_PERSON_IMAGES = 4
                                        const remain = Math.max(0, MAX_PERSON_IMAGES - personImages.length)
                                        if (remain <= 0) {
                                          toast.error(`人物写真は最大${MAX_PERSON_IMAGES}枚までです`)
                                          return
                                        }
                                        const list = Array.from(files).slice(0, remain)
                                        const urls: string[] = []
                                        const names: string[] = []
                                        for (const f of list) {
                                          if (!f.type.startsWith('image/')) throw new Error('画像ファイルを選択してください')
                                          if (f.size > 6 * 1024 * 1024) throw new Error('画像が大きすぎます（6MB以内）')
                                          const url = await new Promise<string>((resolve, reject) => {
                                            const r = new FileReader()
                                            r.onload = () => resolve(String(r.result || ''))
                                            r.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
                                            r.readAsDataURL(f)
                                          })
                                          urls.push(url)
                                          names.push(f.name)
                                        }
                                        setPersonImages((prev) => prev.concat(urls))
                                        setPersonFileNames((prev) => prev.concat(names))
                                        toast.success(`人物写真を${urls.length}枚追加しました`)
                                      } catch (err: any) {
                                        toast.error(err?.message || '人物写真の追加に失敗しました')
                                      }
                                    }}
                                  />
                                  追加
                                </label>
                                {personImages.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {personFileNames.map((name, idx) => (
                                      <button
                                        key={`${name}-${idx}`}
                                        type="button"
                                        onClick={() => {
                                          setPersonImages((prev) => prev.filter((_, i) => i !== idx))
                                          setPersonFileNames((prev) => prev.filter((_, i) => i !== idx))
                                        }}
                                        className="px-2 py-1 bg-white rounded-lg border border-slate-200 hover:bg-slate-100 text-[10px] font-bold text-slate-700"
                                        title="クリックで削除"
                                      >
                                        {name.length > 18 ? name.slice(0, 18) + '…' : name} ×
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <p className="mt-2 text-[10px] text-slate-500 font-bold">
                                  ※ 最大4枚まで（人物は提供画像を優先して自然に合成します）
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="mt-3 text-[11px] text-slate-500 font-medium leading-relaxed">
                          ※ ロゴは「提供されたロゴ画像のみ」を使用します。人物写真はアップした写真を自然に合成します。
                        </p>
                      </div>

                      {/* Generate Count */}
                      <div className="rounded-2xl border border-slate-100 bg-white p-5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">生成枚数</p>
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-xs text-slate-600 font-bold leading-relaxed">
                            デフォルト3枚（A/B/C）。有料プランは最大10枚まで。<span className="text-slate-900">枚数が多いほど時間がかかります。</span>
                          </p>
                          <p className="text-xs font-black text-slate-900 tabular-nums whitespace-nowrap">{generateCount}枚</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                            <button
                              key={n}
                              type="button"
                              disabled={!isProUser && n !== 3}
                              onClick={() => setGenerateCount(n)}
                              className={`px-3 py-2 rounded-xl text-xs font-black border transition-colors ${
                                generateCount === n
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white disabled:cursor-not-allowed'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                        {!isProUser && (
                          <p className="mt-3 text-[11px] text-slate-500 font-medium">
                            ※ 4枚以上は有料プラン限定です。
                          </p>
                        )}
                      </div>

                      <button
                        onClick={handleGenerate}
                        disabled={isThinking || isGenerating}
                        className="w-full px-6 py-5 rounded-2xl bg-blue-600 text-white font-black text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                      >
                        <Sparkles className="w-5 h-5" />
                        このプランでバナーを生成する
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {generatedBanners.length > 0 && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-sm font-black text-slate-800">生成結果 (A/B/C)</p>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    {generatedBanners.slice(0, 3).map((b, i) => (
                      <div key={i} className="group relative rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 shadow-sm transition-all hover:shadow-2xl hover:scale-[1.02]">
                        <img src={b} alt={`banner-${i}`} className="w-full object-cover transition-opacity duration-300" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-8 text-center">
                          <p className="text-white font-black text-xl mb-6 tracking-tighter">
                            PATTERN {String.fromCharCode(65 + i)}
                          </p>
                          <div className="flex flex-col gap-3 w-full items-center">
                            <button
                              onClick={() => downloadImage(b, `banner-${proposedSpec?.keyword || 'ai'}-${i + 1}.png`)}
                              className="px-8 py-3 bg-white text-slate-900 font-black rounded-xl text-sm shadow-xl hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2"
                            >
                              <Download className="w-4 h-4" />
                              ダウンロード
                            </button>
                            <button
                              onClick={() => {
                                setSelectedBannerIndex(i)
                                requestAnimationFrame(() => {
                                  refinePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                })
                              }}
                              className="px-8 py-3 bg-white/10 text-white font-black rounded-xl text-sm border border-white/20 hover:bg-white hover:text-slate-900 transition-all flex items-center gap-2"
                            >
                              <Wand2 className="w-4 h-4" />
                              AIでこの案を修正
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Refine (Chat Edit) */}
              {generatedBanners.length > 0 && (
                <div ref={refinePanelRef} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <Wand2 className="w-5 h-5 text-blue-600" />
                      AIでバナーを修正
                    </p>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {`対象: PATTERN ${String.fromCharCode(65 + Math.min(selectedBannerIndex, 2))}`}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                      <img
                        src={generatedBanners[Math.min(selectedBannerIndex, generatedBanners.length - 1)]}
                        alt="selected-banner"
                        className="w-full object-cover transition-opacity duration-300"
                      />
                    </div>

                    <div className="flex gap-2">
                      {[0, 1, 2].map((i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedBannerIndex(i)}
                          disabled={i >= generatedBanners.length}
                          className={`flex-1 py-2 rounded-xl text-[11px] font-black border transition-colors ${
                            selectedBannerIndex === i
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white'
                          }`}
                        >
                          {`PATTERN ${String.fromCharCode(65 + i)}`}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <textarea
                        value={refineInstruction}
                        onChange={(e) => setRefineInstruction(e.target.value)}
                        placeholder="例：CTAをもっと目立たせて、文字を太く。背景はシンプルに。価格も入れて。"
                        rows={3}
                        className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm font-medium resize-none"
                        onKeyDown={(e) => {
                          // Enter は改行。実行は Ctrl/⌘+Enter のみ。
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            void handleRefine()
                          }
                        }}
                      />
                    </div>

                    {!isRefining ? (
                      <button
                        onClick={handleRefine}
                        disabled={!canRefine}
                        className="w-full px-6 py-4 rounded-2xl bg-blue-600 text-white font-black text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                      >
                        <Wand2 className="w-5 h-5" />
                        この案をAIで修正する
                      </button>
                    ) : (
                      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-black text-slate-800">{REFINEMENT_PHASES[refinePhaseIndex]}</p>
                          <p className="text-xs font-bold text-slate-500">
                            予測残り {Math.max(0, Math.ceil(predictedRefineRemainingMs / 1000))} 秒
                          </p>
                        </div>
                        <div className="mt-3 h-2 bg-white rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all"
                            style={{
                              width: `${Math.min(
                                95,
                                Math.max(2, (refineElapsedSec * 1000) / Math.max(1, predictedRefineTotalMs) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="mt-3 text-xs text-slate-600 font-medium leading-relaxed">
                          {REFINEMENT_TIPS[refineTipIndex]}
                        </p>
                        <p className="mt-2 text-[10px] text-slate-400 font-bold">
                          タブは開いたままでOK（バックグラウンド可）。閉じる/更新すると中断される場合があります。
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


