'use client'

/**
 * ナグサメ メイン画面（クライアントコンポーネント）
 *
 * - 投稿入力欄
 * - 送信後に SSE 購読して ReplyBubble を順次追加
 * - StarConstellation で灯る星数を表示
 * - 危機ワード検知時に SafetyModal を出す
 */

import { useCallback, useRef, useState } from 'react'
import { ReplyBubble } from './ReplyBubble'
import { StarConstellation } from './StarConstellation'
import { SafetyModal } from './SafetyModal'
import { MITSUBOSHI_APPS } from '@/lib/mitsuboshi/_shared/constants'
import type { NagusameSegmentMeta } from '@/lib/mitsuboshi/nagusame/segments'

interface Reply {
  id: string
  personaId: string
  personaName: string
  avatar: string
  content: string
}

interface Props {
  segment: NagusameSegmentMeta
}

type Phase = 'idle' | 'streaming' | 'done' | 'limit' | 'error'

export function NagusameRoom({ segment }: Props) {
  const [content, setContent] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [replies, setReplies] = useState<Reply[]>([])
  const [expected, setExpected] = useState(5)
  const [safetyOpen, setSafetyOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [limitMsg, setLimitMsg] = useState<string | null>(null)
  const submittedRef = useRef<string>('')

  const currentApp = MITSUBOSHI_APPS[0]

  const handleSubmit = useCallback(async () => {
    const body = content.trim()
    if (!body || phase === 'streaming') return

    setPhase('streaming')
    setReplies([])
    setErrorMsg(null)
    setLimitMsg(null)
    submittedRef.current = body

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

  const resetForAnother = () => {
    setContent('')
    setReplies([])
    setPhase('idle')
    setErrorMsg(null)
    setLimitMsg(null)
  }

  return (
    <>
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-10">
        {phase === 'idle' || phase === 'limit' || phase === 'error' ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] tracking-[0.3em] text-mitsuboshi-mist">
                ☆ ☆ ☆
              </span>
              <h1 className="font-mitsuboshi text-3xl text-mitsuboshi-moon">
                今夜は、どうしましたか？
              </h1>
              <p className="text-[13px] text-mitsuboshi-mist">{segment.subtitle}</p>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={segment.placeholder}
              rows={6}
              maxLength={1000}
              className="w-full resize-none rounded-3xl border border-mitsuboshi-twilight bg-mitsuboshi-indigo/60 p-5 text-[15px] leading-[1.9] text-mitsuboshi-moon placeholder:text-mitsuboshi-fog focus:border-mitsuboshi-champagne focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!content.trim() || phase === 'limit'}
              className="group inline-flex items-center gap-2 rounded-full border border-mitsuboshi-champagne/70 bg-mitsuboshi-champagne/10 px-8 py-3 text-[15px] text-mitsuboshi-champagne transition hover:bg-mitsuboshi-champagne/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              そっと送る
              <span className="transition-transform group-hover:translate-y-[-2px]">☆</span>
            </button>
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
                  personaName={r.personaName}
                  content={r.content}
                />
              ))}
              {phase === 'streaming' && replies.length < expected ? (
                <p className="text-center text-[11px] text-mitsuboshi-mist animate-pulse">
                  星々が言葉を選んでいます…
                </p>
              ) : null}
            </div>

            {phase === 'done' ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={resetForAnother}
                  className="rounded-full border border-mitsuboshi-twilight bg-mitsuboshi-indigo/70 px-6 py-3 text-[13px] text-mitsuboshi-mist hover:text-mitsuboshi-champagne"
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
