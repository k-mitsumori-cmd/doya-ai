'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import DashboardSidebar from '@/components/DashboardSidebar'
import LoadingProgress from '@/components/LoadingProgress'
import { Send, Sparkles, Bot, User, Wand2, Image as ImageIcon, Download, MessageSquare, ArrowRight, Bell, Settings } from 'lucide-react'
import toast from 'react-hot-toast'

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

export default function BannerChatPage() {
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
  const [proposedSpec, setProposedSpec] = useState<BannerSpec | null>(null)
  const [generatedBanners, setGeneratedBanners] = useState<string[]>([])

  const endRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, generatedBanners.length, proposedSpec?.keyword])

  const canSend = input.trim().length > 0 && !isThinking && !isGenerating

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
    try {
      const res = await fetch('/api/banner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: proposedSpec.category,
          purpose: proposedSpec.purpose,
          size: proposedSpec.size,
          keyword: proposedSpec.keyword,
          imageDescription: proposedSpec.imageDescription,
          brandColors: proposedSpec.brandColors,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成に失敗しました')
      setGeneratedBanners(Array.isArray(data.banners) ? data.banners : [])
      pushAssistant('生成できました。気になる案をダウンロードして使えます。')
    } catch (e: any) {
      pushAssistant('生成に失敗しました。条件を少し変えてもう一度試してください。')
      toast.error(e?.message || '生成に失敗しました')
    } finally {
      setIsGenerating(false)
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
      <div className="pl-[72px] lg:pl-[240px] transition-all duration-200">
        <LoadingProgress isLoading={isThinking || isGenerating} />

        {/* ========================================
            Header - Bunridge Style
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
                  Bunridge AI チャット
                </h1>
              </div>
              
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="hidden md:flex items-center gap-2">
                  <button className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
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
                    placeholder="こちらにバナーの要件を入力してください..."
                    rows={2}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-6 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm font-medium resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
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
                        <img src={b} alt={`banner-${i}`} className="w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-8 text-center">
                          <p className="text-white font-black text-xl mb-6 tracking-tighter">
                            PATTERN {String.fromCharCode(65 + i)}
                          </p>
                          <button
                            onClick={() => downloadImage(b, `banner-${proposedSpec?.keyword || 'ai'}-${i + 1}.png`)}
                            className="px-8 py-3 bg-white text-slate-900 font-black rounded-xl text-sm shadow-xl hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            ダウンロード
                          </button>
                        </div>
                      </div>
                    ))}
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


