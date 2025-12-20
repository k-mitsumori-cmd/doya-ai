'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { 
  ArrowLeft, Sparkles, Loader2, Copy, Check, 
  RefreshCw, Wand2, LogIn, Send, ChevronRight, Rocket, Cpu, User, Bot, MessageSquare,
  Timer, FileText, Download, Zap, CheckCircle2, ChevronDown, History, Star
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { SAMPLE_TEMPLATES } from '@/lib/templates'

// ゲスト使用状況管理
const GUEST_DAILY_LIMIT = 3
const GUEST_STORAGE_KEY = 'kantan_guest_usage'

function getGuestUsage(): { count: number; date: string } {
  if (typeof window === 'undefined') return { count: 0, date: '' }
  const stored = localStorage.getItem(GUEST_STORAGE_KEY)
  if (!stored) return { count: 0, date: '' }
  try {
    return JSON.parse(stored)
  } catch {
    return { count: 0, date: '' }
  }
}

function setGuestUsage(count: number) {
  if (typeof window === 'undefined') return
  const today = new Date().toISOString().split('T')[0]
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ count, date: today }))
}

// チャットメッセージ型
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// サンプル入力データ
const SAMPLE_INPUTS: Record<string, Record<string, string>> = {
  'business-email': {
    emailType: '依頼・お願い',
    recipient: '取引先・クライアント',
    subject: '打ち合わせ日程の調整について',
    content: '来週中に1時間ほどお時間いただき、新サービスのご説明をさせていただきたく存じます。ご都合の良い日時をいくつかご教示いただけますと幸いです。',
    tone: '丁寧（無難に）',
  },
  'blog-article': {
    theme: 'リモートワークの生産性を上げる方法',
    target: '30代のビジネスパーソン',
    purpose: 'ハウツー',
    keywords: 'リモートワーク,在宅勤務,生産性,集中力',
    wordCount: '2000文字',
  },
  'catchcopy': {
    product: 'オンライン英会話サービス',
    target: '英語を学び直したい30代社会人',
    appeal: '1日15分から始められる、ネイティブ講師とのマンツーマンレッスン。通勤時間でも受講可能。',
    tone: 'インパクト重視',
  },
  'instagram-caption': {
    content: '新商品のオーガニックスキンケアセットを紹介。肌に優しい天然成分100%使用。',
    tone: 'ポップ',
    target: '20-30代の美容に関心のある女性',
  },
  'lp-full-text': {
    productName: 'AIマーケティングツール「カンタンマーケAI」',
    targetAudience: 'マーケティング業務を効率化したい中小企業のマーケター',
    description: 'LP構成案4時間→10分、バナーコピー40案を1分で生成できるAIツール',
    differentiator: 'Gemini 3.0搭載、チャット形式でブラッシュアップ可能、68種類以上のAIエージェント',
  },
  'lp-headline': {
    product: 'AIマーケティングツール',
    target: 'マーケター、事業責任者',
    benefit: 'LP構成案4時間→10分、広告コピー40案を1分で生成',
    difference: 'チャット形式で何度でもブラッシュアップ可能',
  },
  'google-ad-title': {
    productName: 'オンライン英会話アプリ',
    targetAudience: '英語を話せるようになりたい社会人',
    features: '1日10分から、ネイティブ講師とマンツーマン',
    objective: '無料体験申込',
  },
  'persona-creation': {
    productName: 'クラウド会計ソフト',
    description: '中小企業向けの経理業務を自動化するSaaS',
    targetAudience: '従業員30名以下の中小企業経営者',
  },
  'competitor-analysis': {
    ourService: 'AIマーケティングツール「カンタンマーケAI」',
    competitors: 'ChatGPT, Notion AI, Jasper AI',
    industry: 'AI SaaS / マーケティングツール',
  },
}

// 修正提案のサンプル
const REFINEMENT_SUGGESTIONS = [
  'もっとカジュアルに',
  '具体的な数値を入れて',
  '箇条書きで整理して',
  'CTAを強めに',
  '文章を短くして',
  '別の切り口で',
]

export default function TemplateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const templateId = params.templateId as string
  const chatEndRef = useRef<HTMLDivElement>(null)

  // テンプレート取得
  const template = SAMPLE_TEMPLATES.find(t => t.id === templateId)

  // フォーム状態
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [output, setOutput] = useState('')
  const [copied, setCopied] = useState(false)
  const [guestUsageCount, setGuestUsageCount] = useState(0)
  const [generationTime, setGenerationTime] = useState(0)
  const [showInputs, setShowInputs] = useState(true)
  
  // チャット状態
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatting, setIsChatting] = useState(false)

  const isGuest = !session
  
  // ゲスト使用状況を読み込み
  useEffect(() => {
    if (isGuest && typeof window !== 'undefined') {
      const usage = getGuestUsage()
      const today = new Date().toISOString().split('T')[0]
      if (usage.date === today) {
        setGuestUsageCount(usage.count)
      } else {
        setGuestUsageCount(0)
      }
    }
  }, [isGuest])

  // チャット末尾にスクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const guestRemainingCount = GUEST_DAILY_LIMIT - guestUsageCount
  const canGuestGenerate = guestRemainingCount > 0
  
  // 入力が全て揃っているかチェック
  const isFormValid = template?.inputFields.every(field => {
    if (!field.required) return true
    return inputs[field.name]?.trim()
  }) ?? false

  const canGenerate = isFormValid && (session || canGuestGenerate)

  // テンプレートが見つからない
  if (!template) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <p className="text-white/60 mb-4">テンプレートが見つかりません</p>
          <Link href="/kantan/dashboard" className="text-cyan-400 hover:underline">
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    )
  }

  // サンプル入力
  const handleSampleInput = () => {
    const sample = SAMPLE_INPUTS[templateId]
    if (sample) {
      setInputs(sample)
      toast.success('サンプルを入力しました！', { icon: '✨' })
    } else {
      // 汎用的なサンプル
      const genericInputs: Record<string, string> = {}
      template.inputFields.forEach(field => {
        if (field.type === 'select' && field.options) {
          genericInputs[field.name] = field.options[0]
        } else if (field.placeholder) {
          genericInputs[field.name] = field.placeholder.replace('例：', '')
        } else {
          genericInputs[field.name] = `サンプル${field.label}`
        }
      })
      setInputs(genericInputs)
      toast.success('サンプルを入力しました！', { icon: '✨' })
    }
  }

  // 生成
  const handleGenerate = async () => {
    if (!canGenerate) return

    setIsGenerating(true)
    setOutput('')
    setChatMessages([])
    const startTime = Date.now()

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          inputs,
        }),
      })

      const data = await response.json()
      const endTime = Date.now()
      setGenerationTime(Math.round((endTime - startTime) / 1000))

      if (!response.ok) {
        throw new Error(data.error || '生成に失敗しました')
      }

      setOutput(data.output)
      setShowInputs(false)
      
      // 初回生成結果をチャット履歴に追加
      setChatMessages([
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: data.output,
          timestamp: new Date(),
        }
      ])
      
      toast.success('生成完了！チャットでブラッシュアップできます', { icon: '🎉' })

      // ゲストの使用回数を更新
      if (isGuest) {
        const newCount = guestUsageCount + 1
        setGuestUsageCount(newCount)
        setGuestUsage(newCount)
      }
    } catch (error: any) {
      toast.error(error.message || '生成に失敗しました')
    } finally {
      setIsGenerating(false)
    }
  }

  // チャットで修正依頼
  const handleChatSubmit = async (message?: string) => {
    const inputMessage = message || chatInput
    if (!inputMessage.trim() || isChatting) return
    if (isGuest && !canGuestGenerate) {
      toast.error('本日の無料お試しは上限に達しました')
      return
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    }
    
    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsChatting(true)

    try {
      // 現在の出力と修正依頼を含めたプロンプト
      const refinementPrompt = `以下は先ほど生成した${template.name}の内容です：

---
${output}
---

ユーザーからの修正依頼：
${inputMessage}

上記の修正依頼を反映して、改善版を出力してください。`

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: 'chat-refinement',
          inputs: {
            prompt: refinementPrompt,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '生成に失敗しました')
      }

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.output,
        timestamp: new Date(),
      }
      
      setChatMessages(prev => [...prev, assistantMessage])
      setOutput(data.output) // 最新の出力を更新

      // ゲストの使用回数を更新
      if (isGuest) {
        const newCount = guestUsageCount + 1
        setGuestUsageCount(newCount)
        setGuestUsage(newCount)
      }
    } catch (error: any) {
      toast.error(error.message || '修正に失敗しました')
    } finally {
      setIsChatting(false)
    }
  }

  // コピー
  const handleCopy = () => {
    navigator.clipboard.writeText(output)
    setCopied(true)
    toast.success('コピーしました！')
    setTimeout(() => setCopied(false), 2000)
  }

  // リセット
  const handleReset = () => {
    setOutput('')
    setInputs({})
    setChatMessages([])
    setChatInput('')
    setShowInputs(true)
    setGenerationTime(0)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-2xl blur-2xl opacity-50 animate-pulse" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-8 h-8 text-white animate-bounce" />
            </div>
          </div>
          <p className="text-white/40">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      />
      
      {/* アニメーション背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-gradient-to-br from-cyan-500/30 via-transparent to-transparent rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-gradient-to-br from-purple-500/20 via-transparent to-transparent rounded-full blur-[60px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>
      
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/kantan/dashboard/text" className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-all">
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span className="hidden sm:inline text-sm">エージェント一覧</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-lg blur opacity-50" />
              <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                <Rocket className="w-4 h-4 text-white" />
              </div>
            </div>
            <h1 className="font-bold text-white truncate max-w-[200px]">{template.name}</h1>
          </div>
          
          <div className="flex items-center gap-2 px-2 py-1 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-full text-[10px] font-bold">
            <Cpu className="w-3 h-3 text-purple-400" />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Gemini 3.0</span>
            </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 relative">
        {/* ゲストバナー */}
        {isGuest && (
          <div className="mb-6 p-4 bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 backdrop-blur-xl border border-cyan-500/20 rounded-2xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-bold rounded-full">FREE TRIAL</span>
                  <p className="text-white/60 text-sm mt-1">
                    残り <span className="font-bold text-cyan-400">{guestRemainingCount}回</span>
                  </p>
                </div>
              </div>
              <Link href="/auth/signin?service=kantan">
                <button className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:scale-105 transition-transform">
                  <LogIn className="w-4 h-4" />
                  ログインで10回に！
                </button>
              </Link>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-6">
          {/* 左側：入力フォーム */}
          <div className={`lg:col-span-2 ${output && !showInputs ? 'hidden lg:block' : ''}`}>
            {/* テンプレート説明 */}
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h2 className="font-bold text-white">このエージェントについて</h2>
              </div>
              <p className="text-white/60 text-sm">{template.description}</p>
            </div>

            {/* サンプル入力ボタン */}
            <button
              onClick={handleSampleInput}
              className="group w-full mb-4 py-3 px-5 bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 hover:from-cyan-500/20 hover:to-emerald-500/20 border border-cyan-500/20 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-3"
            >
              <Wand2 className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform" />
              <span className="text-sm">ワンクリックでサンプル入力</span>
            </button>

            {/* 入力フォーム */}
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <span>入力項目</span>
                  <span className="text-xs text-white/40 font-normal">（{template.inputFields.filter(f => f.required).length}項目必須）</span>
                </h2>
              </div>
              <div className="space-y-4">
                {template.inputFields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-xs font-medium text-white/60 mb-1.5">
                      {field.label}
                      {field.required && <span className="text-cyan-400 ml-1">*</span>}
                    </label>
                    
                    {field.type === 'select' ? (
                      <select
                        value={inputs[field.name] || ''}
                        onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                      >
                        <option value="" className="bg-[#0a0a0f]">選択してください</option>
                        {field.options?.map((option) => (
                          <option key={option} value={option} className="bg-[#0a0a0f]">{option}</option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={inputs[field.name] || ''}
                        onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                        placeholder={field.placeholder}
                        rows={3}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={inputs[field.name] || ''}
                        onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                      />
                    )}
                  </div>
                ))}
            </div>

            {/* 生成ボタン */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !canGenerate}
              className={`
                  group w-full mt-6 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3
                ${canGenerate && !isGenerating
                    ? 'bg-gradient-to-r from-cyan-500 via-emerald-500 to-teal-500 text-white shadow-2xl shadow-cyan-500/25 hover:scale-[1.02]'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                }
              `}
            >
              {isGenerating ? (
                <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                    <Zap className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    AIで生成する
                </>
              )}
            </button>

            {!canGenerate && isGuest && !canGuestGenerate && (
                <p className="text-center text-xs text-white/40 mt-3">
                本日の無料お試しは上限に達しました。
                  <Link href="/auth/signin?service=kantan" className="text-cyan-400 hover:underline ml-1">
                  ログインで続ける
                </Link>
              </p>
            )}
            </div>
          </div>

          {/* 右側：出力結果とチャット */}
          <div className={`lg:col-span-3 ${!output ? 'hidden lg:flex lg:items-center lg:justify-center' : ''}`}>
            {output ? (
              <div className="space-y-4">
                {/* 生成情報 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-emerald-400 font-bold">生成完了</span>
                    </div>
                    {generationTime > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-white/40">
                        <Timer className="w-3.5 h-3.5" />
                        <span>{generationTime}秒</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowInputs(!showInputs)}
                    className="lg:hidden flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/60"
                  >
                    {showInputs ? '入力を隠す' : '入力を表示'}
                  </button>
                </div>

                {/* チャット履歴 */}
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-2xl p-5 max-h-[50vh] overflow-y-auto">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-cyan-400" />
                    <h2 className="font-bold text-white text-sm">チャットでブラッシュアップ</h2>
                    <span className="text-xs text-white/40">（何度でも修正OK）</span>
                  </div>
                  
                  <div className="space-y-4">
                    {chatMessages.map((msg, index) => (
                      <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user' 
                            ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30' 
                            : 'bg-white/5 border border-white/5'
                        }`}>
                          <div className="text-white/80 text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                          {msg.role === 'assistant' && index === chatMessages.length - 1 && !isChatting && (
                            <button
                              onClick={handleCopy}
                              className="mt-3 flex items-center gap-1.5 text-xs text-white/40 hover:text-cyan-400 transition-colors"
                            >
                              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copied ? 'コピー済み' : 'コピー'}
                            </button>
                          )}
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-white/60" />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {isChatting && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                            <span className="text-sm text-white/60">修正中...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={chatEndRef} />
                  </div>
                </div>

                {/* 修正提案ボタン */}
                <div className="flex flex-wrap gap-2">
                  {REFINEMENT_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleChatSubmit(suggestion)}
                      disabled={isChatting}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-white/60 hover:text-white transition-all disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                {/* チャット入力 */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-2xl blur-xl" />
                  <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-3">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSubmit()}
                        placeholder="修正依頼を入力... 例：もっとカジュアルに"
                        className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none"
                        disabled={isChatting}
                      />
                      <button
                        onClick={() => handleChatSubmit()}
                        disabled={!chatInput.trim() || isChatting}
                        className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 flex items-center justify-center text-white disabled:opacity-50 hover:scale-105 transition-transform"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'コピー済み' : '最新をコピー'}
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    新しく作成
                  </button>
                </div>
              </div>
            ) : (
              // 初期状態（出力なし）
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-10 h-10 text-white/20" />
                </div>
                <h3 className="text-white/40 text-lg mb-2">ここに生成結果が表示されます</h3>
                <p className="text-white/20 text-sm">左の入力フォームを埋めて「AIで生成する」をクリック</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
