'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { 
  Send, Paperclip, MoreHorizontal, Sparkles, LogIn,
  FileText, Target, TrendingUp, Users, BarChart3, Lightbulb,
  Home, Cpu, Clock, Settings, HelpCircle, DollarSign, Bell,
  MessageSquare, Rocket, Bot, User, Loader2, ChevronRight
} from 'lucide-react'
import { KANTAN_PRICING, getGuestRemainingCount } from '@/lib/pricing'

// サイドバーメニュー
const SIDEBAR_MENU = [
  { id: 'dashboard', label: 'ダッシュボード', icon: <Home className="w-5 h-5" />, href: '/kantan/dashboard' },
  { id: 'agents', label: 'AIエージェント', icon: <Cpu className="w-5 h-5" />, href: '/kantan/dashboard/text' },
  { id: 'chat', label: 'AIチャット', icon: <MessageSquare className="w-5 h-5" />, href: '/kantan/dashboard/chat', active: true },
  { id: 'history', label: '生成履歴', icon: <Clock className="w-5 h-5" />, href: '/kantan/dashboard/history' },
  { id: 'analytics', label: 'アナリティクス', icon: <BarChart3 className="w-5 h-5" />, href: '#', disabled: true },
]

const SIDEBAR_MENU_BOTTOM = [
  { id: 'pricing', label: '料金プラン', icon: <DollarSign className="w-5 h-5" />, href: '/kantan/pricing' },
  { id: 'settings', label: '設定', icon: <Settings className="w-5 h-5" />, href: '#', disabled: true },
  { id: 'help', label: 'ヘルプ', icon: <HelpCircle className="w-5 h-5" />, href: '#', disabled: true },
]

// チャットカテゴリ（課題解決テンプレート）
const CHAT_CATEGORIES = [
  {
    id: 'customer-docs',
    title: '顧客対応文書',
    description: '営業メールや報告書をデータに基づき自動作成。',
    icon: <FileText className="w-6 h-6" />,
    color: 'bg-blue-500',
    prompt: '営業メールや報告書の作成を手伝ってください。',
  },
  {
    id: 'target-analysis',
    title: 'ターゲット分析',
    description: '顧客データから最適なターゲットと次の一手を提案。',
    icon: <Target className="w-6 h-6" />,
    color: 'bg-purple-500',
    prompt: 'ターゲット顧客の分析と戦略提案をお願いします。',
  },
  {
    id: 'sales-strategy',
    title: '営業戦略提案',
    description: '営業実績を分析し、売上向上への具体的な戦略を提案。',
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'bg-emerald-500',
    prompt: '営業戦略の立案を手伝ってください。',
  },
]

// チャットメッセージ型
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function KantanChatPage() {
  const { data: session, status } = useSession()
  const [guestRemainingCount, setGuestRemainingCount] = useState(KANTAN_PRICING.guestLimit)
  const [selectedCategory, setSelectedCategory] = useState<typeof CHAT_CATEGORIES[0] | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  const isGuest = !session
  const userName = session?.user?.name || 'ゲスト'
  const userInitial = userName[0]?.toUpperCase() || 'G'

  // ゲスト使用状況を読み込み
  useEffect(() => {
    if (isGuest && typeof window !== 'undefined') {
      setGuestRemainingCount(getGuestRemainingCount('kantan'))
    }
  }, [isGuest])

  // チャット末尾にスクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // カテゴリ選択時
  const handleSelectCategory = (category: typeof CHAT_CATEGORIES[0]) => {
    setSelectedCategory(category)
    setMessages([
      {
        id: `msg-${Date.now()}-1`,
        role: 'assistant',
        content: 'こんにちは',
        timestamp: new Date(),
      },
      {
        id: `msg-${Date.now()}-2`,
        role: 'assistant',
        content: 'ご相談の内容はどのようなものでしょうか？',
        timestamp: new Date(),
      },
    ])
  }

  // メッセージ送信
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // マーケティング課題解決用のプロンプト
      const systemContext = selectedCategory 
        ? `あなたはマーケティングの専門家です。「${selectedCategory.title}」に関する相談に対応しています。`
        : 'あなたはマーケティングの専門家です。';

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: 'chat-refinement',
          inputs: {
            prompt: `${systemContext}

以下のユーザーからの相談に対して、具体的で実践的なアドバイスを日本語で提供してください。

ユーザーの相談:
${inputValue}

【回答のポイント】
- 具体的なアクションプランを提示
- 数値目標があれば示す
- 必要に応じて事例を交える
- 簡潔かつ分かりやすく`,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'エラーが発生しました')
      }

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.output,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'すみません、エラーが発生しました。もう一度お試しください。',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* サイドバー */}
      <aside className="w-64 bg-[#1e3a5f] text-white flex flex-col fixed h-full z-40">
        {/* ロゴ */}
        <div className="p-5 border-b border-white/10">
          <Link href="/kantan" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-lg">カンタンマーケ</div>
              <div className="text-[10px] text-cyan-300 font-medium">Powered by Gemini 3.0</div>
            </div>
          </Link>
        </div>

        {/* メインメニュー */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {SIDEBAR_MENU.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.disabled ? '#' : item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    item.active
                      ? 'bg-white/10 text-white'
                      : item.disabled
                      ? 'text-white/30 cursor-not-allowed'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                  {item.disabled && (
                    <span className="ml-auto text-[10px] bg-white/10 px-2 py-0.5 rounded-full">Soon</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3 px-4">その他</p>
            <ul className="space-y-1">
              {SIDEBAR_MENU_BOTTOM.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.disabled ? '#' : item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      item.disabled
                        ? 'text-white/30 cursor-not-allowed'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* 他サービスへのリンク */}
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3 px-2">他のAIツール</p>
          <div className="space-y-2">
            <Link href="/banner" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 transition-colors">
              <span className="text-lg">🎨</span>
              <span className="text-sm text-white/80">ドヤバナーAI</span>
            </Link>
            <Link href="/seo" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 transition-colors">
              <span className="text-lg">🧠</span>
              <span className="text-sm text-white/80">ドヤSEO</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 ml-64 flex flex-col h-screen">
        {/* ヘッダー */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-8 h-16 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">AIチャット</h1>
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <Settings className="w-5 h-5" />
              </button>

              {session ? (
                <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-800">{userName}</div>
                    <div className="text-xs text-gray-400">Admin</div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                    {userInitial}
                  </div>
                </div>
              ) : (
                <Link href="/auth/signin?service=kantan">
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors">
                    <LogIn className="w-4 h-4" />
                    ログイン
                  </button>
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* チャットエリア */}
        <div className="flex-1 overflow-hidden flex flex-col p-8">
          {/* カテゴリ選択 */}
          {!selectedCategory ? (
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {CHAT_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleSelectCategory(category)}
                  className="group text-left p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
                >
                  <div className={`w-12 h-12 ${category.color} rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
                    {category.icon}
                  </div>
                  <h3 className="font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                    {category.title}
                  </h3>
                  <p className="text-sm text-gray-500">{category.description}</p>
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* 選択中のカテゴリ */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${selectedCategory.color} rounded-xl flex items-center justify-center text-white`}>
                      {selectedCategory.icon}
                    </div>
                    <h2 className="font-bold text-gray-800">{selectedCategory.title}</h2>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedCategory(null)
                      setMessages([])
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>

                {/* チャットメッセージ */}
                <div className="p-6 max-h-[50vh] overflow-y-auto">
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] ${
                          msg.role === 'user' 
                            ? 'bg-blue-500 text-white rounded-2xl rounded-br-md px-5 py-3' 
                            : 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md px-5 py-3'
                        }`}>
                          <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md px-5 py-3">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        </div>
                      </div>
                    )}
                    
                    <div ref={chatEndRef} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 入力エリア */}
          {selectedCategory && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder="入力"
                  className="flex-1 bg-transparent text-gray-800 placeholder-gray-400 outline-none"
                  disabled={isLoading}
                />
                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium rounded-xl transition-colors"
                >
                  送信
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ゲストバナー */}
          {isGuest && (
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  <p className="text-sm text-gray-700">
                    🆓 お試しモード：残り <strong className="text-blue-600">{guestRemainingCount}回</strong>
                  </p>
                </div>
                <Link href="/auth/signin?service=kantan">
                  <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors">
                    ログインで10回/日に！
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

