'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  User, 
  Sparkles,
  Minimize2,
  Maximize2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const suggestedQuestions = [
  '効果的なキャッチコピーの作り方は？',
  'LP構成のベストプラクティスは？',
  'SNS投稿のエンゲージメント向上法',
  'ペルソナ分析のやり方を教えて',
]

const demoResponses: Record<string, string> = {
  'default': `こんにちは！DOYA-AIアシスタントです 👋

何かお手伝いできることはありますか？テンプレートの使い方や、マーケティングに関するご質問にお答えします。

よくあるご質問：
• テンプレートの選び方
• 効果的な文章の書き方
• 料金プランについて`,
  'キャッチコピー': `効果的なキャッチコピーのポイント：

1️⃣ **ベネフィットを明確に**
「〇〇できる」「〇〇が手に入る」など具体的に

2️⃣ **数字を入れる**
「3日で」「98%が満足」など信頼性UP

3️⃣ **感情に訴える**
不安、希望、好奇心を刺激

4️⃣ **ターゲットを明確に**
「忙しいあなたへ」「初心者でも」

💡 DOYA-AIの「キャッチコピー作成」テンプレートを使えば、10パターン一気に生成できますよ！`,
  'LP': `LP構成のベストプラクティス：

📍 **ファーストビュー**
- キャッチコピー + サブコピー
- CTAボタン

📍 **問題提起**
- ターゲットの悩みを明確化

📍 **解決策**
- あなたの商品/サービスを紹介

📍 **特徴・メリット**
- 3つ程度に絞る

📍 **お客様の声**
- 信頼性を高める

📍 **FAQ**
- 不安を解消

📍 **CTA**
- 行動を促す

DOYA-AIの「LP構成案作成」テンプレートで一発生成できます！`,
  'SNS': `SNS投稿のエンゲージメント向上法：

📱 **投稿タイミング**
- Instagram: 昼12時、夜9時
- Twitter: 朝7時、昼12時、夜8時

🎯 **コンテンツタイプ**
- 教育系コンテンツ（Tips、ハウツー）
- 共感コンテンツ（あるある）
- エンタメ系（面白い、感動）

🔥 **エンゲージメント施策**
- 質問を投げかける
- 絵文字を活用
- ハッシュタグは10-15個
- ストーリーで日常を共有

DOYA-AIのSNSテンプレートで毎日の投稿が楽になりますよ！`,
  'ペルソナ': `ペルソナ分析のやり方：

👤 **基本情報**
- 名前、年齢、性別、居住地
- 職業、年収、家族構成

📊 **行動特性**
- 1日のスケジュール
- 情報収集方法
- 使用SNS

💭 **心理特性**
- 価値観、考え方
- 悩み、不安
- 願望、目標

🛒 **購買行動**
- 意思決定のプロセス
- 重視するポイント

DOYA-AIの「ペルソナ作成」テンプレートを使えば、詳細なペルソナが一発で作れます！`,
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // 初回メッセージ
      setMessages([{
        id: '1',
        role: 'assistant',
        content: demoResponses['default'],
        timestamp: new Date(),
      }])
    }
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    // デモ応答
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))

    let response = demoResponses['default']
    if (input.includes('キャッチ') || input.includes('コピー')) {
      response = demoResponses['キャッチコピー']
    } else if (input.includes('LP') || input.includes('ランディング') || input.includes('構成')) {
      response = demoResponses['LP']
    } else if (input.includes('SNS') || input.includes('投稿') || input.includes('エンゲージ')) {
      response = demoResponses['SNS']
    } else if (input.includes('ペルソナ') || input.includes('分析') || input.includes('ターゲット')) {
      response = demoResponses['ペルソナ']
    }

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, assistantMessage])
    setIsTyping(false)
  }

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success('コピーしました')
  }

  const handleSuggestedQuestion = (question: string) => {
    setInput(question)
  }

  return (
    <>
      {/* フローティングボタン */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-[#635bff] to-[#00d4ff] shadow-lg shadow-[#635bff]/30 flex items-center justify-center text-white hover:scale-110 transition-transform z-50"
          >
            <MessageCircle className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* チャットウィンドウ */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? 'auto' : '600px'
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 w-[400px] bg-white rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col"
          >
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-[#635bff] to-[#00d4ff] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">DOYA-AI アシスタント</h3>
                  <p className="text-xs text-white/70">いつでもお手伝いします</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4 text-white" /> : <Minimize2 className="w-4 h-4 text-white" />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* メッセージエリア */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.role === 'user' 
                          ? 'bg-[#635bff]' 
                          : 'bg-gradient-to-br from-[#635bff] to-[#00d4ff]'
                      }`}>
                        {message.role === 'user' 
                          ? <User className="w-4 h-4 text-white" />
                          : <Sparkles className="w-4 h-4 text-white" />
                        }
                      </div>
                      <div className={`max-w-[280px] ${message.role === 'user' ? 'text-right' : ''}`}>
                        <div className={`inline-block p-3 rounded-2xl text-sm ${
                          message.role === 'user'
                            ? 'bg-[#635bff] text-white rounded-tr-sm'
                            : 'bg-white text-gray-700 rounded-tl-sm shadow-sm border border-gray-100'
                        }`}>
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        </div>
                        {message.role === 'assistant' && (
                          <div className="flex items-center gap-2 mt-1">
                            <button 
                              onClick={() => handleCopy(message.content, message.id)}
                              className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                            >
                              {copiedId === message.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                            <button className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600">
                              <ThumbsUp className="w-3 h-3" />
                            </button>
                            <button className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600">
                              <ThumbsDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  
                  {isTyping && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#635bff] to-[#00d4ff] flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white p-3 rounded-2xl rounded-tl-sm shadow-sm border border-gray-100">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                {/* サジェスト */}
                {messages.length <= 1 && (
                  <div className="p-3 border-t border-gray-100 bg-white">
                    <p className="text-xs text-gray-500 mb-2">よくある質問：</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedQuestions.map((question, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestedQuestion(question)}
                          className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 入力エリア */}
                <div className="p-3 border-t border-gray-100 bg-white">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder="質問を入力..."
                      className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#635bff]/50"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isTyping}
                      className="p-2.5 bg-[#635bff] hover:bg-[#4f46e5] disabled:bg-gray-300 rounded-xl text-white transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}


