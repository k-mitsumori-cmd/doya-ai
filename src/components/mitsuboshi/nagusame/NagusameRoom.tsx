'use client'

/**
 * ナグサメ メイン画面（クライアントコンポーネント）
 *
 * - 投稿入力欄（Cmd+Enter送信、文字数カウント、オートフォーカス、キャラ見せ）
 * - 送信後に SSE 購読して ReplyBubble を順次追加
 * - StarConstellation で灯る星数を表示、満点で confetti
 * - 危機ワード検知時に SafetyModal を出す
 * - 結果画面に X(Twitter) シェアボタン
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReplyBubble } from './ReplyBubble'
import { StarConstellation } from './StarConstellation'
import { SafetyModal } from './SafetyModal'
import { ChatView, type ChatMessage } from './ChatView'
import { PersonaAvatar } from './PersonaAvatar'
import { MITSUBOSHI_APPS, MITSUBOSHI_BRAND } from '@/lib/mitsuboshi/_shared/constants'
import {
  DEFAULT_PERSONAS,
  getFreePersonas,
} from '@/lib/mitsuboshi/nagusame/personas/default'
import type { NagusameSegmentMeta } from '@/lib/mitsuboshi/nagusame/segments'

interface Reply {
  id: string
  personaId: string
  personaName: string
  avatar: string
  imageUrl?: string
  content: string
}

interface Props {
  segment: NagusameSegmentMeta
}

type Phase = 'idle' | 'streaming' | 'done' | 'limit' | 'error'

const MAX_LEN = 1000

export function NagusameRoom({ segment }: Props) {
  const [content, setContent] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [replies, setReplies] = useState<Reply[]>([])
  const [expected, setExpected] = useState(5)
  const [safetyOpen, setSafetyOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [limitMsg, setLimitMsg] = useState<string | null>(null)
  const submittedRef = useRef<string>('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const completionFiredRef = useRef(false)

  // チャットモード（1対1継続会話）
  const [chatPersona, setChatPersona] = useState<{
    id: string
    name: string
    avatar: string
    imageUrl?: string
  } | null>(null)
  // ペルソナID → 会話履歴 のマップ。戻る → 別キャラと話す → 戻る で履歴保持
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({})

  const enterChat = useCallback(
    (reply: Reply) => {
      setChatPersona({
        id: reply.personaId,
        name: reply.personaName,
        avatar: reply.avatar,
        imageUrl: reply.imageUrl,
      })
      setChatHistories((prev) => {
        if (prev[reply.personaId]) return prev
        // 初回は「ユーザーの最初の投稿」と「そのキャラの初回返答」をシード
        return {
          ...prev,
          [reply.personaId]: [
            { role: 'user', content: submittedRef.current },
            { role: 'assistant', content: reply.content },
          ],
        }
      })
    },
    []
  )

  const exitChat = useCallback(() => {
    setChatPersona(null)
  }, [])

  // ChatView から会話履歴を更新するためのコールバック
  const updateChatHistory = useCallback(
    (personaId: string, messages: ChatMessage[]) => {
      setChatHistories((prev) => ({ ...prev, [personaId]: messages }))
    },
    []
  )

  const currentApp = MITSUBOSHI_APPS[0]
  const teaserPersonas = useMemo(() => getFreePersonas(), [])
  const allPersonaCount = DEFAULT_PERSONAS.length

  // 入力欄に最初フォーカス
  useEffect(() => {
    if (phase === 'idle' && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [phase])

  // 全員から届いた瞬間に confetti を撃つ（reduced motion 配慮）
  useEffect(() => {
    if (
      phase === 'streaming' &&
      replies.length > 0 &&
      replies.length >= expected &&
      !completionFiredRef.current
    ) {
      completionFiredRef.current = true
      const reduce =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      if (reduce) return
      // 動的import で初期バンドルを膨らませない
      import('canvas-confetti')
        .then((mod) => {
          const confetti = mod.default
          const colors = ['#E8C766', '#F5E5B8', '#D4D8F0', '#F5F3E8']
          confetti({
            particleCount: 80,
            spread: 70,
            startVelocity: 38,
            origin: { y: 0.4 },
            colors,
            shapes: ['star'] as unknown as ('square' | 'circle')[],
            scalar: 1.1,
            disableForReducedMotion: true,
          })
          setTimeout(() => {
            confetti({
              particleCount: 60,
              angle: 60,
              spread: 55,
              origin: { x: 0, y: 0.6 },
              colors,
              shapes: ['star'] as unknown as ('square' | 'circle')[],
              disableForReducedMotion: true,
            })
            confetti({
              particleCount: 60,
              angle: 120,
              spread: 55,
              origin: { x: 1, y: 0.6 },
              colors,
              shapes: ['star'] as unknown as ('square' | 'circle')[],
              disableForReducedMotion: true,
            })
          }, 220)
        })
        .catch(() => {
          /* confetti is non-essential */
        })
    }
  }, [replies.length, expected, phase])

  const handleSubmit = useCallback(async () => {
    const body = content.trim()
    if (!body || phase === 'streaming') return

    setPhase('streaming')
    setReplies([])
    setErrorMsg(null)
    setLimitMsg(null)
    submittedRef.current = body
    completionFiredRef.current = false

    try {
      const res = await fetch('/api/mitsuboshi/nagusame/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: body, segment: segment.id }),
      })

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}))
        setPhase('limit')
        setLimitMsg(data?.error || '本日の無料枠を使い切りました')
        return
      }

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        setPhase('error')
        setErrorMsg(data?.error || '通信に失敗しました')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const rawLine of lines) {
          const trimmed = rawLine.trim()
          if (!trimmed.startsWith('data:')) continue
          const jsonStr = trimmed.slice(5).trim()
          if (!jsonStr) continue
          let evt: Record<string, unknown>
          try {
            evt = JSON.parse(jsonStr)
          } catch {
            continue
          }

          switch (evt.type) {
            case 'start':
              setExpected(Number(evt.expectedReplies) || 5)
              break
            case 'reply':
              setReplies((prev) => [
                ...prev,
                {
                  id: `${evt.personaId}-${prev.length}`,
                  personaId: String(evt.personaId),
                  personaName: String(evt.personaName),
                  avatar: String(evt.avatar || '☆'),
                  imageUrl: evt.imageUrl ? String(evt.imageUrl) : undefined,
                  content: String(evt.content || ''),
                },
              ])
              break
            case 'safety_escalation':
              setSafetyOpen(true)
              break
            case 'limit_reached':
              setPhase('limit')
              setLimitMsg(String(evt.reason || '上限に達しました'))
              break
            case 'done':
              setPhase('done')
              break
            case 'error':
              setPhase('error')
              setErrorMsg(String(evt.message || 'エラー'))
              break
            default:
              break
          }
        }
      }
    } catch (err) {
      setPhase('error')
      setErrorMsg(err instanceof Error ? err.message : '通信エラー')
    }
  }, [content, phase, segment.id])

  // Cmd/Ctrl + Enter で送信
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const resetForAnother = () => {
    setContent('')
    setReplies([])
    setPhase('idle')
    setErrorMsg(null)
    setLimitMsg(null)
    completionFiredRef.current = false
    setChatHistories({})
    setChatPersona(null)
  }

  const shareToX = () => {
    const text = `${replies.length}人の星から、そっと慰めてもらえました。\n\n${MITSUBOSHI_BRAND.tagline}\n#ナグサメ #三ツ星アプリ`
    const url = 'https://mitsuboshi.surisuta.jp/nagusame'
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(url)}`
    window.open(intent, '_blank', 'noopener,noreferrer')
  }

  const charCount = content.length
  const charCountPercent = Math.min(100, Math.round((charCount / MAX_LEN) * 100))

  // チャットモード中はチャットビューだけを表示する（投稿欄や全員返信は隠す）
  if (chatPersona) {
    const messages = chatHistories[chatPersona.id] || []
    return (
      <>
        <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8">
          <ChatView
            personaId={chatPersona.id}
            personaName={chatPersona.name}
            avatar={chatPersona.avatar}
            imageUrl={chatPersona.imageUrl}
            messages={messages}
            onMessagesChange={(next) => updateChatHistory(chatPersona.id, next)}
            onBack={exitChat}
            onSafetyEscalation={() => setSafetyOpen(true)}
          />
          <p className="text-center text-[10px] text-mitsuboshi-fog">
            {currentApp.name}はAIで、専門家ではありません。つらい気持ちが続くときは専門機関にご相談ください。
          </p>
        </section>
        <SafetyModal open={safetyOpen} onClose={() => setSafetyOpen(false)} />
      </>
    )
  }

  return (
    <>
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-10">
        {phase === 'idle' || phase === 'limit' || phase === 'error' ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] tracking-[0.3em] text-mitsuboshi-mist animate-star-twinkle">
                ☆ ☆ ☆
              </span>
              <h1 className="font-mitsuboshi text-3xl text-mitsuboshi-moon sm:text-4xl">
                今夜は、どうしましたか？
              </h1>
              <p className="text-[13px] text-mitsuboshi-mist">{segment.subtitle}</p>
            </div>

            <div className="relative w-full">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={segment.placeholder}
                rows={6}
                maxLength={MAX_LEN}
                aria-label="今夜の気持ちを書く"
                className="w-full resize-none rounded-3xl border border-mitsuboshi-twilight bg-mitsuboshi-indigo/60 p-5 text-[15px] leading-[1.9] text-mitsuboshi-moon placeholder:text-mitsuboshi-fog focus:border-mitsuboshi-champagne focus:outline-none"
              />
              <div className="pointer-events-none absolute bottom-3 right-4 flex items-center gap-2 text-[11px] text-mitsuboshi-fog">
                <span
                  className={
                    charCountPercent >= 90
                      ? 'text-mitsuboshi-sakura'
                      : charCountPercent >= 70
                      ? 'text-mitsuboshi-champagne'
                      : ''
                  }
                >
                  {charCount}
                </span>
                <span>/ {MAX_LEN}</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!content.trim() || phase === 'limit'}
                className="group inline-flex items-center gap-2 rounded-full border border-mitsuboshi-champagne/70 bg-mitsuboshi-champagne/10 px-8 py-3 text-[15px] text-mitsuboshi-champagne shadow-glow-champagne transition hover:bg-mitsuboshi-champagne/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                そっと送る
                <span className="transition-transform group-hover:translate-y-[-2px]">
                  ☆
                </span>
              </button>
              <p className="text-[10px] text-mitsuboshi-fog">
                <kbd className="rounded border border-mitsuboshi-fog/60 px-1.5 py-0.5">
                  ⌘
                </kbd>
                <span className="mx-1">+</span>
                <kbd className="rounded border border-mitsuboshi-fog/60 px-1.5 py-0.5">
                  Enter
                </kbd>{' '}
                でも送れます
              </p>
            </div>

            {/* キャラ見せ */}
            <div className="mt-2 flex flex-col items-center gap-3">
              <p className="text-[11px] tracking-wide text-mitsuboshi-mist">
                今夜あなたの言葉に応える星々
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {teaserPersonas.map((p) => (
                  <div key={p.id} title={`${p.name}（${p.tagline}）`}>
                    <PersonaAvatar
                      imageUrl={`/mitsuboshi/personas/${p.id}.jpg`}
                      fallbackEmoji={p.avatar}
                      alt={p.name}
                      size={48}
                    />
                  </div>
                ))}
                <div
                  className="flex h-12 items-center justify-center rounded-full border border-dashed border-mitsuboshi-fog px-3 text-[11px] text-mitsuboshi-fog"
                  title="PROで全員が応える"
                >
                  +{allPersonaCount - teaserPersonas.length} PRO
                </div>
              </div>
            </div>

            {limitMsg ? (
              <p className="rounded-2xl border border-mitsuboshi-champagne/40 bg-mitsuboshi-champagne/5 px-5 py-3 text-[12px] text-mitsuboshi-champagne">
                {limitMsg}
              </p>
            ) : null}
            {errorMsg ? (
              <p className="text-[12px] text-mitsuboshi-sakura">{errorMsg}</p>
            ) : null}
          </div>
        ) : null}

        {phase === 'streaming' || phase === 'done' ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 rounded-3xl border border-mitsuboshi-twilight/80 bg-mitsuboshi-midnight/50 p-5">
              <p className="text-[11px] tracking-[0.2em] text-mitsuboshi-mist">
                あなたの言葉
              </p>
              <p className="whitespace-pre-wrap text-[14px] leading-[1.9] text-mitsuboshi-moon">
                {submittedRef.current}
              </p>
              <StarConstellation lit={replies.length} total={expected} />
            </div>

            <div className="flex flex-col gap-4">
              {replies.map((r) => (
                <ReplyBubble
                  key={r.id}
                  avatar={r.avatar}
                  imageUrl={r.imageUrl}
                  personaName={r.personaName}
                  content={r.content}
                  onContinue={phase === 'done' ? () => enterChat(r) : undefined}
                />
              ))}
              {phase === 'streaming' && replies.length < expected ? (
                <p className="text-center text-[11px] text-mitsuboshi-mist animate-pulse">
                  星々が言葉を選んでいます…
                </p>
              ) : null}
            </div>

            {phase === 'done' ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={shareToX}
                  className="inline-flex items-center gap-2 rounded-full border border-mitsuboshi-champagne/60 bg-mitsuboshi-champagne/10 px-5 py-3 text-[13px] text-mitsuboshi-champagne hover:bg-mitsuboshi-champagne/20"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.84l-5.36-7.01L4.6 22H1.34l8.04-9.18L1 2h7l4.84 6.4L18.244 2zm-2.39 18h1.86L7.27 4H5.32L15.854 20z" />
                  </svg>
                  そっとシェア
                </button>
                <button
                  type="button"
                  onClick={resetForAnother}
                  className="inline-flex items-center gap-2 rounded-full border border-mitsuboshi-twilight bg-mitsuboshi-indigo/70 px-5 py-3 text-[13px] text-mitsuboshi-mist hover:text-mitsuboshi-champagne"
                >
                  もう一度、打ち明ける
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="mt-8 text-center text-[10px] text-mitsuboshi-fog">
          {currentApp.name}はAIで、専門家ではありません。つらい気持ちが続くときは専門機関にご相談ください。
        </p>
      </section>
      <SafetyModal open={safetyOpen} onClose={() => setSafetyOpen(false)} />
    </>
  )
}
