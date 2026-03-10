'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Send, Bot, User, Loader2, CheckCircle, MessageSquare } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'interviewer' | 'respondent'
  content: string
  topicIndex?: number
}

interface ProjectData {
  id: string
  title: string
  companyName: string | null
  companyLogo: string | null
  brandColor: string
  purpose: string | null
  tone: string
  questions: { id: string; text: string; order: number }[]
}

export default function ChatInterviewPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  // プロジェクトデータ
  const [project, setProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 回答者情報
  const [step, setStep] = useState<'info' | 'chat' | 'complete'>('info')
  const [respondentName, setRespondentName] = useState('')
  const [respondentEmail, setRespondentEmail] = useState('')
  const [respondentRole, setRespondentRole] = useState('')
  const [respondentCompany, setRespondentCompany] = useState('')

  // チャット状態
  const [responseId, setResponseId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [topicsCovered, setTopicsCovered] = useState(0)
  const [topicsTotal, setTopicsTotal] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const brandColor = project?.brandColor || '#3B82F6'

  // プロジェクト読み込み
  useEffect(() => {
    if (!token) return
    fetch(`/api/interviewx/public/${token}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) {
          setError(data.error || 'エラーが発生しました')
          return
        }
        if (data.project.interviewMode !== 'chat') {
          router.replace(`/interviewx/respond/${token}`)
          return
        }
        setProject(data.project)

        // localStorage からセッション復元チェック
        try {
          const savedResponseId = localStorage.getItem(`ix-chat-${token}`)
          if (savedResponseId) {
            restoreSession(savedResponseId)
          }
        } catch {}
      })
      .catch(() => setError('読み込みに失敗しました'))
      .finally(() => setLoading(false))
  }, [token])

  // 自動スクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAiTyping])

  // エラー自動クリア（5秒後）— プロジェクト読み込み完了後のみ
  useEffect(() => {
    if (!error || !project) return
    const timer = setTimeout(() => setError(''), 5000)
    return () => clearTimeout(timer)
  }, [error, project])

  // セッション復元
  async function restoreSession(rid: string) {
    try {
      const res = await fetch(`/api/interviewx/public/${token}/chat/history?responseId=${rid}`)
      const data = await res.json()
      if (data.success && data.messages.length > 0) {
        setResponseId(rid)
        setMessages(data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          topicIndex: m.topicIndex,
        })))
        setTopicsCovered(data.topicsCovered)
        setTopicsTotal(data.topicsTotal)
        setIsComplete(data.isComplete)
        setStep(data.isComplete ? 'complete' : 'chat')
      }
    } catch {
      // 復元失敗は無視
    }
  }

  // チャット開始
  async function handleStartChat() {
    if (!respondentName.trim()) return
    setIsAiTyping(true)
    setStep('chat')

    try {
      const res = await fetch(`/api/interviewx/public/${token}/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respondentName: respondentName.trim(),
          respondentEmail: respondentEmail.trim() || undefined,
          respondentRole: respondentRole.trim() || undefined,
          respondentCompany: respondentCompany.trim() || undefined,
        }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error)
        setStep('info')
        return
      }

      setResponseId(data.responseId)
      setTopicsTotal(data.topicsTotal)
      setTopicsCovered(data.topicsCovered)
      try { localStorage.setItem(`ix-chat-${token}`, data.responseId) } catch {}

      if (data.resumed) {
        await restoreSession(data.responseId)
      } else {
        setMessages([{
          id: data.message.id,
          role: 'interviewer',
          content: data.message.content,
          topicIndex: data.message.topicIndex,
        }])
      }
    } catch {
      setError('チャットの開始に失敗しました')
      setStep('info')
    } finally {
      setIsAiTyping(false)
    }
  }

  // メッセージ送信
  async function handleSendMessage() {
    if (!inputText.trim() || !responseId || isAiTyping || isComplete) return

    const savedText = inputText.trim()
    const userMessage: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: 'respondent',
      content: savedText,
    }
    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setIsAiTyping(true)
    setError('')

    try {
      const res = await fetch(`/api/interviewx/public/${token}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId, content: savedText }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error)
        setInputText(savedText)
        setMessages(prev => prev.filter(m => m.id !== userMessage.id))
        return
      }

      setMessages(prev => [...prev, {
        id: data.message.id,
        role: 'interviewer',
        content: data.message.content,
        topicIndex: data.message.topicIndex,
      }])
      setTopicsCovered(data.topicsCovered)

      if (data.isComplete) {
        setIsComplete(true)
        setTimeout(() => setStep('complete'), 2000)
      }
    } catch {
      setError('送信に失敗しました。もう一度お試しください。')
      setInputText(savedText)
      setMessages(prev => prev.filter(m => m.id !== userMessage.id))
    } finally {
      setIsAiTyping(false)
      inputRef.current?.focus()
    }
  }

  // Enter送信
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // ローディング
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  // エラー
  if (error && !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 text-lg">{error}</p>
        </div>
      </div>
    )
  }

  if (!project) return null

  // 回答者情報入力
  if (step === 'info') {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* ヘッダー */}
        <div className="relative overflow-hidden py-10 px-6" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}>
          <div className="relative z-10 max-w-md mx-auto text-center text-white">
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 text-sm mb-4">
              <MessageSquare className="w-4 h-4" />
              AIチャットインタビュー
            </div>
            <h1 className="text-2xl font-bold mb-2">{project.title}</h1>
            {project.companyName && <p className="text-white/80 text-sm">{project.companyName}</p>}
          </div>
        </div>

        {/* フォーム */}
        <div className="max-w-md mx-auto px-6 -mt-4">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900 mb-1">はじめに</h2>
            <p className="text-sm text-slate-500 mb-6">
              AIインタビュアーとの対話形式でインタビューを行います。所要時間は10〜15分程度です。
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  お名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={respondentName}
                  onChange={e => setRespondentName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2"
                  style={{ ['--tw-ring-color' as any]: brandColor }}
                  placeholder="例: 田中太郎"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={respondentEmail}
                  onChange={e => setRespondentEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="任意"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">役職</label>
                  <input
                    type="text"
                    value={respondentRole}
                    onChange={e => setRespondentRole(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    placeholder="任意"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">所属</label>
                  <input
                    type="text"
                    value={respondentCompany}
                    onChange={e => setRespondentCompany(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    placeholder="任意"
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

            <button
              onClick={handleStartChat}
              disabled={!respondentName.trim()}
              className="w-full mt-6 py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
              style={{ background: brandColor }}
            >
              インタビューを開始
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 完了画面
  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: `${brandColor}20` }}>
            <CheckCircle className="w-8 h-8" style={{ color: brandColor }} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">インタビュー完了</h2>
          <p className="text-sm text-slate-500 mb-6">
            ご協力ありがとうございました。いただいた内容をもとに、AIが記事を自動生成します。
          </p>
          <button
            onClick={() => router.push(`/interviewx/respond/${token}/complete`)}
            className="px-6 py-3 rounded-xl font-bold text-sm text-white"
            style={{ background: brandColor }}
          >
            完了ページへ
          </button>
        </div>
      </div>
    )
  }

  // チャットUI
  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50">
      {/* ヘッダー */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${brandColor}20` }}>
              <Bot className="w-5 h-5" style={{ color: brandColor }} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{project.title}</p>
              {project.companyName && <p className="text-xs text-slate-500">{project.companyName}</p>}
            </div>
          </div>
          {topicsTotal > 0 && (
            <div className="text-right">
              <p className="text-xs text-slate-500">{topicsCovered}/{topicsTotal} トピック</p>
              <div className="w-20 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden" role="progressbar" aria-valuenow={topicsCovered} aria-valuemax={topicsTotal}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(topicsCovered / topicsTotal) * 100}%`, background: brandColor }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'respondent' ? 'flex-row-reverse' : ''}`}>
              {/* アバター */}
              <div
                className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'interviewer' ? '' : 'bg-slate-200'
                }`}
                style={msg.role === 'interviewer' ? { background: `${brandColor}20` } : undefined}
              >
                {msg.role === 'interviewer' ? (
                  <Bot className="w-4 h-4" style={{ color: brandColor }} />
                ) : (
                  <User className="w-4 h-4 text-slate-500" />
                )}
              </div>
              {/* バブル */}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'interviewer'
                    ? 'bg-white border border-slate-200 text-slate-800'
                    : 'text-white'
                }`}
                style={msg.role === 'respondent' ? { background: brandColor } : undefined}
              >
                {msg.content.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
                ))}
              </div>
            </div>
          ))}

          {/* タイピングインジケーター */}
          {isAiTyping && (
            <div className="flex gap-3" aria-label="AIが入力中">
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: `${brandColor}20` }}>
                <Bot className="w-4 h-4" style={{ color: brandColor }} />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* インタビュー完了カード */}
          {isComplete && step === 'chat' && (
            <div className="flex justify-center pt-4">
              <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 text-center">
                <CheckCircle className="w-6 h-6 mx-auto mb-2" style={{ color: brandColor }} />
                <p className="text-sm font-bold text-slate-900">インタビューが完了しました</p>
                <p className="text-xs text-slate-500 mt-1">ご協力ありがとうございました</p>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* 入力エリア */}
      {!isComplete && (
        <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-3">
          <div className="max-w-2xl mx-auto flex gap-3">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              aria-label="メッセージ入力"
              rows={1}
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2"
              style={{ ['--tw-ring-color' as any]: brandColor }}
              disabled={isAiTyping}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isAiTyping}
              aria-label="送信"
              className="px-4 py-3 rounded-xl text-white transition-all disabled:opacity-50"
              style={{ background: brandColor }}
            >
              {isAiTyping ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2">
          {error}
        </div>
      )}
    </div>
  )
}
