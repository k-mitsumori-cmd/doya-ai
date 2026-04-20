'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, X, Sparkles, Wand2, Loader2, MessageSquare } from 'lucide-react'
import { consumeSse } from '@/lib/allinone/client-sse'
import type { ChatSseEvent } from '@/lib/allinone/types'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: string
  verbose?: boolean
  pending?: boolean
}

const QUICK_PROMPTS = [
  '最優先でやるべきことだけ3つ教えて',
  'SEO 記事のタイトル案を10個',
  'このペルソナに刺さるLP構成は？',
  '競合サイトの傾向をもっと具体的に',
  '広告コピー5パターンを作って',
]

export function ChatPanel({
  analysisId,
  isOpen,
  onClose,
  initialMessages,
  verbose,
  setVerbose,
  focusSection,
}: {
  analysisId: string
  isOpen: boolean
  onClose: () => void
  initialMessages: ChatMessage[]
  verbose: boolean
  setVerbose: (v: boolean) => void
  focusSection?: string
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || [])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || isSending) return
    setIsSending(true)

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
    }
    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', pending: true },
    ])
    setInput('')

    try {
      await consumeSse<ChatSseEvent>(
        `/api/allinone/analysis/${analysisId}/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, verbose, focusSection }),
        },
        (evt) => {
          if (evt.type === 'token') {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + evt.text } : m))
            )
          } else if (evt.type === 'done') {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m))
            )
          } else if (evt.type === 'error') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: `⚠️ ${evt.message}`, pending: false }
                  : m
              )
            )
          }
        }
      )
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  '⚠️ チャットに失敗しました: ' +
                  (err instanceof Error ? err.message : 'unknown'),
                pending: false,
              }
            : m
        )
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      {/* モバイル用フローティングボタン */}
      {!isOpen && (
        <button
          onClick={() => {}}
          className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-allinone-primary px-5 py-3 text-sm font-black text-white shadow-2xl shadow-allinone-primary/40 transition hover:-translate-y-0.5 lg:hidden"
        >
          <MessageSquare className="h-4 w-4" />
          AIチャット
        </button>
      )}

      {/* パネル */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-0 right-0 top-[64px] z-40 flex w-full max-w-md flex-col border-l border-allinone-line bg-white shadow-2xl lg:w-[420px]"
          >
            {/* ヘッダー */}
            <header className="relative flex items-center justify-between border-b border-allinone-line px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-allinone-primary via-fuchsia-500 to-allinone-cyan text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-black text-allinone-ink">AIアシスタント</div>
                  <div className="text-[10px] font-bold text-allinone-muted">
                    分析結果を元に深掘り・修正を対話で
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full border border-allinone-line bg-white text-allinone-muted hover:text-allinone-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* verbose トグル */}
            <div className="flex items-center gap-2 border-b border-allinone-line bg-allinone-surface px-4 py-2 text-xs">
              <Wand2 className="h-3.5 w-3.5 text-allinone-primary" />
              <span className="text-allinone-inkSoft">詳細モード</span>
              <button
                onClick={() => setVerbose(!verbose)}
                className={`relative ml-auto h-5 w-10 rounded-full transition ${
                  verbose ? 'bg-allinone-primary' : 'bg-allinone-line'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                    verbose ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <span className="text-[10px] text-allinone-muted">
                {verbose ? '800〜1500字で詳細回答' : '簡潔に回答'}
              </span>
            </div>

            {/* メッセージ */}
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="rounded-2xl border border-dashed border-allinone-line bg-allinone-surface p-5 text-center text-sm text-allinone-muted">
                  分析結果を元に AI と対話できます。<br />
                  下のボタンから話し始めてみてください。
                </div>
              )}
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>

            {/* クイックプロンプト */}
            <div className="border-t border-allinone-line px-4 py-2">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    disabled={isSending}
                    className="rounded-full border border-allinone-line bg-white px-2 py-1 text-[10px] font-bold text-allinone-inkSoft transition hover:border-allinone-primary hover:text-allinone-primary disabled:opacity-40"
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* 入力 */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  send(input)
                }}
                className="flex items-center gap-2 rounded-2xl border border-allinone-line bg-allinone-surface px-3 py-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="診断結果について質問する…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-allinone-mutedSoft"
                  disabled={isSending}
                />
                <button
                  type="submit"
                  disabled={isSending || !input.trim()}
                  className="grid h-8 w-8 place-items-center rounded-full bg-allinone-primary text-white transition hover:bg-allinone-primaryDeep disabled:opacity-40"
                >
                  {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </form>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? 'bg-allinone-ink text-white'
            : 'border border-allinone-line bg-white text-allinone-ink'
        }`}
      >
        {!isUser && (
          <div className="mb-1 inline-flex items-center gap-1 text-[10px] font-black text-allinone-primary">
            <Sparkles className="h-2.5 w-2.5" /> AI
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">
          {message.content}
          {message.pending && (
            <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-current align-baseline" />
          )}
        </div>
      </div>
    </motion.div>
  )
}
