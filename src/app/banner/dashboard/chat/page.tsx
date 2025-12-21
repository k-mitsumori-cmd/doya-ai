'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import DashboardSidebar from '@/components/DashboardSidebar'
import LoadingProgress from '@/components/LoadingProgress'
import { Send, Sparkles, Bot, User, Wand2, Image as ImageIcon, Download } from 'lucide-react'
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

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-gray-900">AIチャット生成</h1>
                <p className="text-xs text-gray-500">会話からバナー条件を整理して、そのまま生成できます</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
              <Wand2 className="w-4 h-4 text-blue-500" />
              例: 「美容院の新規向け。ストーリー広告。上品で明るい。笑顔の女性。ピンク系」
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_360px] gap-4">
            {/* Chat */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-4 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
                <p className="text-sm font-bold text-gray-800">会話リクエスト</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Active AI</span>
                </div>
              </div>

              <div className="h-[55vh] overflow-y-auto p-5 space-y-4 bg-white">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {m.role === 'assistant' && (
                      <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-slate-50 text-gray-800 border border-slate-100'
                      }`}
                    >
                      {m.content}
                    </div>
                    {m.role === 'user' && (
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                        <User className="w-5 h-5 text-slate-500" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <div className="p-4 border-t border-gray-100 bg-white">
                <div className="flex items-end gap-3">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="例: IT企業の採用バナー。ターゲットは30代エンジニア。青ベースで信頼感のある感じ。"
                    rows={2}
                    className="flex-1 resize-none px-4 py-3 rounded-xl border border-gray-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none text-sm transition-all"
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
                    className="w-12 h-12 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center hover:bg-blue-700 transition-all flex-shrink-0 active:scale-95"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[10px] text-gray-400 font-medium">
                    Shift+Enterで改行 / Enterで送信
                  </p>
                  <div className="flex gap-2">
                    {['#SNS', '#YouTube', '#LP'].map(tag => (
                      <button 
                        key={tag}
                        onClick={() => setInput(prev => prev + (prev ? ' ' : '') + tag)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded-md bg-blue-50"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Proposal / Result */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-60" />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-black text-gray-900 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-blue-600" />
                      生成プラン案
                    </p>
                    {proposedSpec && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-black rounded-full uppercase tracking-wider">
                        Ready
                      </span>
                    )}
                  </div>

                  {!proposedSpec ? (
                    <div className="py-8 text-center px-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
                        <Wand2 className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        チャットに要件を入力してください。<br />AIが自動で最適な生成プランを構成します。
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          {summary.split(' / ').map((s, i) => (
                            <span key={i} className="px-2 py-1 bg-white rounded-lg text-[10px] font-bold text-slate-600 border border-slate-200 shadow-sm">
                              {s}
                            </span>
                          ))}
                        </div>
                        
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">訴求キーワード</p>
                          <p className="text-sm font-bold text-slate-800 leading-relaxed">
                            {proposedSpec.keyword}
                          </p>
                        </div>

                        {proposedSpec.imageDescription && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ビジュアル指示</p>
                            <p className="text-[11px] text-slate-600 leading-relaxed italic">
                              "{proposedSpec.imageDescription}"
                            </p>
                          </div>
                        )}

                        {Array.isArray(proposedSpec.brandColors) && proposedSpec.brandColors.length > 0 && (
                          <div className="pt-2 border-t border-slate-200">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">使用カラー</p>
                            <div className="flex flex-wrap gap-1.5">
                              {proposedSpec.brandColors.slice(0, 8).map((c) => (
                                <div key={c} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200 shadow-sm">
                                  <span className="w-3 h-3 rounded-sm" style={{ background: c }} />
                                  <span className="text-[10px] text-slate-600 font-mono font-medium uppercase">{c}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handleGenerate}
                        disabled={isThinking || isGenerating}
                        className="w-full px-6 py-4 rounded-xl bg-blue-600 text-white font-black text-sm shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                      >
                        <Sparkles className="w-5 h-5" />
                        このプランで生成を開始する
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {generatedBanners.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-black text-gray-900">生成結果 (A/B/C)</p>
                    <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Select to Download</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {generatedBanners.slice(0, 3).map((b, i) => (
                      <div key={i} className="group relative rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 shadow-sm transition-all hover:shadow-xl hover:scale-[1.02]">
                        <img src={b} alt={`banner-${i}`} className="w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 text-center">
                          <p className="text-white font-black text-lg mb-4">
                            {String.fromCharCode(65 + i)}案
                          </p>
                          <button
                            onClick={() => downloadImage(b, `banner-${String.fromCharCode(65 + i)}.png`)}
                            className="px-6 py-3 rounded-xl bg-white text-blue-600 font-black text-sm flex items-center gap-2 shadow-2xl transition-all active:scale-95"
                          >
                            <Download className="w-5 h-5" />
                            高画質で保存
                          </button>
                        </div>
                        <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-white/90 backdrop-blur-sm text-blue-600 text-[10px] font-black shadow-sm">
                          PROPOSAL {String.fromCharCode(65 + i)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-[10px] text-center text-slate-400 font-medium">
                    ※ テキストの微調整が必要な場合はダッシュボードから行えます。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


