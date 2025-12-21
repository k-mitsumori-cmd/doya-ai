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
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-cyan-50">
                <p className="text-sm font-bold text-gray-800">チャット</p>
              </div>

              <div className="h-[60vh] overflow-y-auto p-4 space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-start gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {m.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-blue-600" />
                      </div>
                    )}
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap border ${
                        m.role === 'user'
                          ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white border-transparent'
                          : 'bg-gray-50 text-gray-800 border-gray-200'
                      }`}
                    >
                      {m.content}
                    </div>
                    {m.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-600" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <div className="p-3 border-t border-gray-100 bg-white">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="バナーの要件を自由に書いてください…"
                    rows={2}
                    className="flex-1 resize-none px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
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
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-sm shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    送信
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-gray-400">
                  Enterで送信 / Shift+Enterで改行
                </p>
              </div>
            </div>

            {/* Proposal / Result */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    生成プラン
                  </p>
                </div>

                {!proposedSpec ? (
                  <p className="text-sm text-gray-500">
                    チャットに要件を書いて送信すると、ここにAIの提案が表示されます。
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="px-3 py-2 rounded-xl bg-sky-50 border border-sky-200/60">
                      <p className="text-xs font-bold text-sky-800">{summary}</p>
                      <p className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">
                        訴求: {proposedSpec.keyword}
                        {proposedSpec.imageDescription ? `\nイメージ: ${proposedSpec.imageDescription}` : ''}
                      </p>
                      {Array.isArray(proposedSpec.brandColors) && proposedSpec.brandColors.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {proposedSpec.brandColors.slice(0, 8).map((c) => (
                            <div key={c} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-gray-200">
                              <span className="w-3 h-3 rounded" style={{ background: c }} />
                              <span className="text-[10px] text-gray-600 font-mono">{c}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleGenerate}
                      disabled={isThinking || isGenerating}
                      className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-black text-sm shadow-lg shadow-blue-500/25 disabled:opacity-50"
                    >
                      この内容でバナー生成（A/B/C）
                    </button>
                  </div>
                )}
              </div>

              {generatedBanners.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                  <p className="text-sm font-bold text-gray-900 mb-3">生成結果</p>
                  <div className="grid grid-cols-3 gap-2">
                    {generatedBanners.slice(0, 3).map((b, i) => (
                      <div key={i} className="group relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                        <img src={b} alt={`banner-${i}`} className="w-full h-full object-cover aspect-square" />
                        <button
                          onClick={() => downloadImage(b, `banner-${String.fromCharCode(65 + i)}.png`)}
                          className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          title="ダウンロード"
                        >
                          <div className="px-3 py-2 rounded-xl bg-white text-gray-900 font-bold text-xs flex items-center gap-2 shadow-lg">
                            <Download className="w-4 h-4" />
                            {String.fromCharCode(65 + i)}案をDL
                          </div>
                        </button>
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/50 text-white text-[10px] font-bold">
                          {String.fromCharCode(65 + i)}案
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


