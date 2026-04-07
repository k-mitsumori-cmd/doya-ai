'use client'

/**
 * ナグサメ 1対1チャットビュー
 *
 * 全員からの初回返答後、特定のキャラとの継続会話を行うモード。
 * NagusameRoom から呼ばれ、conversation 配列を受け取って表示する。
 * 新規メッセージ送信は POST /api/mitsuboshi/nagusame/chat。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { PersonaAvatar } from './PersonaAvatar'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  personaId: string
  personaName: string
  avatar: string
  imageUrl?: string
  /** 親が保持する会話履歴（fully controlled） */
  messages: ChatMessage[]
  onMessagesChange: (next: ChatMessage[]) => void
  onBack: () => void
  onSafetyEscalation: () => void
}

const MAX_LEN = 1000

export function ChatView({
  personaId,
  personaName,
  avatar,
  imageUrl,
  messages,
  onMessagesChange,
  onBack,
  onSafetyEscalation,
}: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // メッセージ追加時に末尾までスクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, sending])

  // 入力欄に最初フォーカス
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setErrorMsg(null)

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    onMessagesChange(nextMessages)
    setDraft('')

    try {
      const res = await fetch('/api/mitsuboshi/nagusame/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, messages: nextMessages }),
      })

      const data = await res.json().catch(() => ({}))

      if (data?.type === 'safety') {
        onSafetyEscalation()
        setSending(false)
        return
      }

      if (!res.ok || data?.type === 'error' || !data?.content) {
        setErrorMsg(data?.message || data?.error || 'うまく返事ができませんでした')
        setSending(false)
        return
      }

      onMessagesChange([...nextMessages, { role: 'assistant', content: data.content }])
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '通信エラー')
    } finally {
      setSending(false)
      // 送信後再フォーカス
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [draft, sending, messages, personaId, onMessagesChange, onSafetyEscalation])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 戻るボタン + キャラ名 */}
      <div className="flex items-center gap-3 rounded-2xl border border-mitsuboshi-twilight/80 bg-mitsuboshi-midnight/60 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="星々一覧に戻る"
          className="flex h-9 w-9 items-center justify-center rounded-full text-mitsuboshi-mist hover:bg-mitsuboshi-twilight/60 hover:text-mitsuboshi-champagne"
        >
          ←
        </button>
        <PersonaAvatar
          imageUrl={imageUrl}
          fallbackEmoji={avatar}
          alt={personaName}
          size={44}
        />
        <div className="flex flex-col leading-tight">
          <span className="text-[14px] text-mitsuboshi-moon">{personaName}</span>
          <span className="text-[10px] text-mitsuboshi-fog">1対1の会話</span>
        </div>
      </div>

      {/* 会話履歴 */}
      <div
        ref={scrollRef}
        className="flex max-h-[60vh] min-h-[280px] flex-col gap-4 overflow-y-auto rounded-3xl border border-mitsuboshi-twilight/60 bg-mitsuboshi-midnight/40 p-5"
      >
        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={i} className="flex justify-end animate-fade-in-up">
                <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-mitsuboshi-champagne/15 border border-mitsuboshi-champagne/40 px-4 py-3 text-[14px] leading-[1.85] text-mitsuboshi-moon">
                  {m.content}
                </p>
              </div>
            )
          }
          return (
            <div key={i} className="flex items-start gap-3 animate-fade-in-up">
              <PersonaAvatar
                imageUrl={imageUrl}
                fallbackEmoji={avatar}
                alt={personaName}
                size={36}
              />
              <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-mitsuboshi-twilight/80 bg-mitsuboshi-indigo/80 px-4 py-3 text-[14px] leading-[1.85] text-mitsuboshi-moon">
                {m.content}
              </p>
            </div>
          )
        })}
        {sending ? (
          <p className="text-center text-[11px] text-mitsuboshi-mist animate-pulse">
            {personaName}が言葉を選んでいます…
          </p>
        ) : null}
      </div>

      {errorMsg ? (
        <p className="text-center text-[12px] text-mitsuboshi-sakura">{errorMsg}</p>
      ) : null}

      {/* 入力欄 */}
      <div className="relative">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`${personaName}に返事を書く…`}
          rows={3}
          maxLength={MAX_LEN}
          aria-label={`${personaName}への返信`}
          disabled={sending}
          className="w-full resize-none rounded-3xl border border-mitsuboshi-twilight bg-mitsuboshi-indigo/60 p-4 text-[14px] leading-[1.85] text-mitsuboshi-moon placeholder:text-mitsuboshi-fog focus:border-mitsuboshi-champagne focus:outline-none disabled:opacity-60"
        />
        <div className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-mitsuboshi-fog">
          {draft.length} / {MAX_LEN}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] text-mitsuboshi-fog">
          <kbd className="rounded border border-mitsuboshi-fog/60 px-1 py-0.5">⌘</kbd>
          +
          <kbd className="rounded border border-mitsuboshi-fog/60 px-1 py-0.5">
            Enter
          </kbd>{' '}
          で送信
        </p>
        <button
          type="button"
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className="inline-flex items-center gap-2 rounded-full border border-mitsuboshi-champagne/70 bg-mitsuboshi-champagne/10 px-6 py-2.5 text-[13px] text-mitsuboshi-champagne shadow-glow-champagne transition hover:bg-mitsuboshi-champagne/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {sending ? '送信中…' : '送る ☆'}
        </button>
      </div>
    </div>
  )
}
