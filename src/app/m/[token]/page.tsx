'use client'

// ============================================
// ドヤAI商談 商談ルーム（見込み客向け・未ログイン）
// ============================================
// 同意 → 準備 → 商談 → 終了。スマホで開かれる前提で組む。
//
// ⚠️ この画面は第三者が開く。フィットスコア・判定理由・社内向けの設定は
//    絶対に表示しない。表示に使う情報はサーバの toPublicRoom() を通ったものだけ。

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Avatar from '@/components/mensetsu/Avatar'
import Waveform from '@/components/mensetsu/Waveform'
import { useRealtimeMeeting } from '@/lib/aishodan/useRealtimeMeeting'

interface PublicRoom {
  roomName: string
  companyName: string
  productName: string
  oneLiner: string | null
  durationMin: number
  phaseNames: string[]
  retentionDays: number
  /** 日程調整ボタン（ホストが設定していれば出す） */
  schedulingUrl: string | null
  schedulingLabel: string | null
}

type Step = 'loading' | 'consent' | 'check' | 'live' | 'done' | 'unavailable'

/**
 * 見込み客の画面にマーケティング用のポップアップ（HubSpot CTA）を出さない。
 * 商談に来た相手へ自社サービスの営業を重ねるのは不適切で、操作の妨げにもなる。
 */
const SUPPRESS_MARKETING_CSS = `
  #hs-web-interactives-top-anchor,
  [id^='hs-overlay-cta'],
  iframe[src*='hs-web-interactive'] {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
`

/**
 * 日程調整ボタン。
 * ⚠️ URLはサーバ側で https のみに検証済み（lib/aishodan/scheduling.ts）。
 *    それでも新規タブ＋noopener で開き、遷移先からこのページを触らせない。
 * ⚠️ 記録は投げっぱなしにする。記録が失敗しても遷移は止めない
 *    （相手を待たせない。予約に進めないことの方が損失が大きい）。
 */
function SchedulingButton({
  url,
  label,
  onClick,
  variant = 'primary',
}: {
  url: string
  label: string | null
  onClick: () => void
  variant?: 'primary' | 'inline'
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={
        variant === 'primary'
          ? 'inline-flex items-center gap-2 rounded-lg bg-[#0066ff] px-6 py-3.5 text-sm font-black text-white'
          : 'inline-flex items-center gap-1.5 rounded-full bg-[#0066ff] px-4 py-2 text-[13px] font-black text-white'
      }
    >
      <span className="material-symbols-outlined text-[18px]">event_available</span>
      {label || '担当者と日程を決める'}
    </a>
  )
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function AishodanRoomPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token as string

  const [step, setStep] = useState<Step>('loading')
  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string>('')

  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [micOn, setMicOn] = useState(true)
  const [showText, setShowText] = useState(false)
  const [draft, setDraft] = useState('')
  /** 直近でワンタップ送信した選択肢。二度押しを防ぐ */
  const [sentQuick, setSentQuick] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'agenda' | 'log' | null>(null)
  const startedRef = useRef(false)

  const rt = useRealtimeMeeting({
    roomToken: token,
    sessionId,
    onEnded: () => setStep('done'),
  })

  useEffect(() => {
    if (!token) return
    let alive = true
    fetch(`/api/aishodan/room/${token}`)
      .then(async (r) => {
        const d = await r.json()
        if (!alive) return
        if (!r.ok) {
          setMessage(d?.error || 'この商談ルームはご利用いただけません。')
          setStep('unavailable')
          return
        }
        setRoom(d.room)
        setStep('consent')
      })
      .catch(() => {
        if (!alive) return
        setMessage('通信に失敗しました。時間をおいて再度お試しください。')
        setStep('unavailable')
      })
    return () => {
      alive = false
    }
  }, [token])

  const submitConsent = useCallback(async () => {
    if (!agreed || submitting) return
    setSubmitting(true)
    setMessage(null)
    try {
      const r = await fetch(`/api/aishodan/room/${token}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: true, name, company, email }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '開始できませんでした')
      setSessionId(d.session.id)
      setStep('check')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '開始できませんでした')
    } finally {
      setSubmitting(false)
    }
  }, [agreed, company, email, name, submitting, token])

  const beginMeeting = useCallback(() => {
    if (!sessionId) return
    setStep('live')
    // 二重に start() を呼ぶと接続が二重に張られる
    if (startedRef.current) return
    startedRef.current = true
    void rt.start()
  }, [rt, sessionId])

  /** 日程調整ボタンが押されたことを記録する（成果指標） */
  const recordScheduling = useCallback(() => {
    if (!sessionId) return
    // 遷移を止めないよう待たない
    void fetch(`/api/aishodan/room/${token}/scheduling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
      keepalive: true,
    }).catch(() => {})
  }, [sessionId, token])

  const toggleMic = useCallback(() => {
    setMicOn((v) => {
      rt.setMicEnabled(!v)
      return !v
    })
  }, [rt])

  /**
   * テキスト入力を開いたらマイクを自動で切る。
   * ⚠️ 文字で話す人はマイクを使わないのに音は拾われ続け、
   *    無音・雑音に対する文字起こしの捏造が商談ログに混ざる（実機で発生）。
   *    閉じたときにマイクを戻すことはしない。勝手に音を拾い始める方が驚かせる。
   */
  const toggleText = useCallback(() => {
    setShowText((v) => {
      const next = !v
      if (next && micOn) {
        rt.setMicEnabled(false)
        setMicOn(false)
      }
      return next
    })
  }, [micOn, rt])

  // ---------------- 画面 ----------------

  // ⚠️ 質問が切り替わったら送信済みの印を消す。
  //    消さないと、次の質問で同じ文言の選択肢が押せないままになる。
  const quickSlotKey = rt.quickReplies?.slotKey ?? null
  useEffect(() => {
    setSentQuick(null)
  }, [quickSlotKey])

  if (step === 'loading') {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f2f6ff]">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#0066ff] border-t-transparent" />
      </main>
    )
  }

  if (step === 'unavailable') {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f2f6ff] px-5">
        <div className="max-w-md text-center">
          <span className="material-symbols-outlined text-3xl text-[#8a94ad]">link_off</span>
          <p className="mt-3 text-sm font-bold leading-relaxed text-[#0a0f3c]">{message}</p>
        </div>
      </main>
    )
  }

  if (step === 'done') {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f2f6ff] px-5">
        <style dangerouslySetInnerHTML={{ __html: SUPPRESS_MARKETING_CSS }} />
        <div className="max-w-md text-center">
          <span className="material-symbols-outlined text-4xl text-[#0066ff]">check_circle</span>
          <h1 className="mt-3 text-xl font-black text-[#0a0f3c]">ありがとうございました</h1>
          <p className="mt-3 text-sm font-medium leading-relaxed text-[#425071]">
            本日の内容は担当者へ共有いたします。
            {room?.schedulingUrl
              ? '続けて、担当者との打ち合わせのご都合をお選びいただけます。'
              : '追ってご連絡差し上げますので、少々お待ちください。'}
          </p>
          {room?.schedulingUrl && (
            <div className="mt-6">
              <SchedulingButton
                url={room.schedulingUrl}
                label={room.schedulingLabel}
                onClick={recordScheduling}
              />
            </div>
          )}
        </div>
      </main>
    )
  }

  if (step === 'consent' && room) {
    return (
      <main className="min-h-[100dvh] bg-[#f2f6ff] px-5 py-10">
        <style dangerouslySetInnerHTML={{ __html: SUPPRESS_MARKETING_CSS }} />
        <div className="mx-auto max-w-xl">
          <p className="text-xs font-bold text-[#0066ff]">{room.companyName}</p>
          <h1 className="mt-1 text-2xl font-black leading-tight text-[#0a0f3c]">{room.productName} のご説明</h1>
          {room.oneLiner && <p className="mt-2 text-sm font-medium leading-relaxed text-[#425071]">{room.oneLiner}</p>}

          <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
            <div className="rounded-lg bg-[#f7faff] p-4">
              <p className="text-sm font-black text-[#0a0f3c]">はじめにご確認ください</p>
              <ul className="mt-3 space-y-2 text-[13px] font-medium leading-relaxed text-[#425071]">
                <li>本日の商談は、AIが担当いたします。</li>
                <li>会話の内容はテキストとして記録され、担当者が確認いたします。</li>
                <li>記録は{room.retentionDays}日間保管したのち削除いたします。</li>
                <li>所要時間は約{room.durationMin}分です。</li>
                <li>金額や条件の確定は、後日あらためて担当者よりご案内いたします。</li>
              </ul>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="text-xs font-bold text-[#5b6785]">お名前</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="山田 太郎"
                  className="mt-1 w-full rounded-lg border border-[#d8e7ff] px-4 py-3 text-sm font-medium text-[#0a0f3c] outline-none focus:border-[#0066ff]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-[#5b6785]">会社名</span>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="株式会社サンプル"
                  className="mt-1 w-full rounded-lg border border-[#d8e7ff] px-4 py-3 text-sm font-medium text-[#0a0f3c] outline-none focus:border-[#0066ff]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-[#5b6785]">メールアドレス（任意）</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="taro@example.com"
                  className="mt-1 w-full rounded-lg border border-[#d8e7ff] px-4 py-3 text-sm font-medium text-[#0a0f3c] outline-none focus:border-[#0066ff]"
                />
              </label>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#0066ff]"
              />
              <span className="text-sm font-bold text-[#0a0f3c]">上記に同意して商談を始めます</span>
            </label>

            {message && <p className="mt-3 text-sm font-bold text-[#ff1e72]">{message}</p>}

            <button
              onClick={submitConsent}
              disabled={!agreed || submitting}
              className="mt-6 w-full rounded-lg bg-[#0066ff] px-6 py-3.5 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:bg-[#b9cdf5]"
            >
              {submitting ? '処理中…' : '同意して次へ'}
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (step === 'check' && room) {
    return (
      <main className="min-h-[100dvh] bg-[#f2f6ff] px-5 py-12">
        <style dangerouslySetInnerHTML={{ __html: SUPPRESS_MARKETING_CSS }} />
        <div className="mx-auto max-w-xl">
          <h1 className="text-2xl font-black text-[#0a0f3c]">準備はよろしいですか</h1>
          <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
            <ul className="space-y-3 text-sm font-medium leading-relaxed text-[#425071]">
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#0066ff]">headphones</span>
                <span>静かな場所で、イヤホンのご利用をおすすめします。</span>
              </li>
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#0066ff]">mic</span>
                <span>マイクの使用許可を求められます。お使いになれない場合は、そのまま文字入力でも進められます。</span>
              </li>
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#0066ff]">forum</span>
                <span>途中で話し始めていただいて構いません。ご質問はいつでもどうぞ。</span>
              </li>
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#0066ff]">timer</span>
                <span>所要時間は約{room.durationMin}分です。</span>
              </li>
            </ul>
            <button
              onClick={beginMeeting}
              className="mt-6 w-full rounded-lg bg-[#0066ff] px-6 py-3.5 text-sm font-black text-white"
            >
              商談を始める
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ---------------- 商談中 ----------------
  const remaining = Math.max(0, rt.durationMin * 60 - rt.elapsedSec)
  const connecting = rt.state === 'connecting' || rt.state === 'requesting_mic'
  const lastLine = rt.lines[rt.lines.length - 1]
  const statusLabel = rt.speaking ? '担当が話しています' : rt.listening ? 'お話しください' : 'お待ちください'
  const currentPhaseIndex = room ? room.phaseNames.findIndex((p) => p === rt.phaseName) : -1

  return (
    <main className="flex h-[100dvh] flex-col bg-gradient-to-b from-[#f7faff] to-[#e9f0fb]">
      <style dangerouslySetInnerHTML={{ __html: SUPPRESS_MARKETING_CSS }} />

      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#dfe6f3] bg-white/85 px-3 py-2.5 backdrop-blur lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0066ff]">
            <span className="material-symbols-outlined text-[18px] text-white">support_agent</span>
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black leading-tight text-[#0a0f3c] lg:text-sm">
              {room?.productName} のご説明
            </p>
            <p className="truncate text-[10px] font-bold text-[#8a94ad] lg:text-[11px]">{room?.companyName}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setSheet(sheet === 'agenda' ? null : 'agenda')}
            className="flex items-center gap-1 rounded-full border border-[#dfe6f3] bg-white px-3 py-1.5 text-[11px] font-black text-[#425071]"
          >
            進み方
            <span className="material-symbols-outlined text-[16px]">expand_more</span>
          </button>
          <span className="rounded-full bg-[#0a0f3c] px-2.5 py-1 text-[11px] font-black tabular-nums text-white">
            {fmt(remaining)}
          </span>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 lg:flex-row lg:items-center lg:gap-8 lg:overflow-hidden lg:p-8">
        {connecting ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#0066ff] border-t-transparent" />
            <p className="text-sm font-bold text-[#425071]">
              {rt.state === 'requesting_mic' ? 'マイクの許可を確認しています…' : '担当に接続しています…'}
            </p>
          </div>
        ) : rt.state === 'error' ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="material-symbols-outlined text-3xl text-[#8a94ad]">error</span>
            <p className="mt-2 max-w-sm text-sm font-bold text-[#0a0f3c]">{rt.error}</p>
            <button
              onClick={() => {
                startedRef.current = false
                beginMeeting()
              }}
              className="mt-4 rounded-lg bg-[#0066ff] px-5 py-2.5 text-sm font-black text-white"
            >
              もう一度試す
            </button>
          </div>
        ) : (
          <>
            <div className="order-1 flex shrink-0 flex-col items-center lg:order-2 lg:w-[38%] lg:max-w-[420px]">
              <div className="h-40 w-40 lg:h-auto lg:w-full">
                <Avatar level={rt.level} speaking={rt.speaking} listening={rt.listening} circle name="AI営業担当" />
              </div>
              <p className="mt-2 text-sm font-black text-[#0a0f3c]">{room?.companyName} 担当</p>
              <Waveform level={rt.level} speaking={rt.speaking} listening={rt.listening} />

              {/* ⚠️ どちらのターンか一目で分かるようにする。
                   担当の発話中はマイクが閉じており、話しかけても届かない。
                   それが分からないと話し続けてしまい、説明の繰り返しにつながる。 */}
              <div
                className={`mt-3 w-full rounded-xl px-4 py-3 text-center ring-2 transition-colors ${
                  rt.speaking
                    ? 'bg-[#fff4e5] text-[#8a5a00] ring-[#ffcf8a]'
                    : 'bg-[#e6f7ee] text-[#0a6b3d] ring-[#7ddaa8]'
                }`}
              >
                <p className="text-base font-black leading-tight lg:text-lg">
                  {rt.speaking ? 'いま担当が話しています' : 'あなたが話すターンです'}
                </p>
                <p className="mt-1 text-xs font-bold leading-relaxed">
                  {rt.speaking
                    ? '途中で話しかけていただいても大丈夫です'
                    : 'そのままお話しください'}
                </p>
              </div>
            </div>

            <div className="order-2 flex min-h-0 flex-1 flex-col justify-center lg:order-1">
              {rt.phaseName && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#0066ff] px-3 py-1 text-[11px] font-black text-white">
                    {rt.phaseName}
                  </span>
                  {room && room.phaseNames.length > 0 && (
                    <span className="hidden items-center gap-1 lg:flex">
                      {room.phaseNames.map((p, i) => (
                        <span
                          key={p}
                          className={`h-1.5 rounded-full transition-all ${
                            currentPhaseIndex >= 0 && i < currentPhaseIndex
                              ? 'w-4 bg-[#0066ff]'
                              : i === currentPhaseIndex
                                ? 'w-8 bg-[#0066ff]'
                                : 'w-4 bg-[#cfe3ff]'
                          }`}
                        />
                      ))}
                    </span>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-[#dfe6f3] border-l-[6px] border-l-[#0066ff] bg-white p-5 shadow-sm lg:p-8">
                <p className="text-base font-black leading-[1.75] tracking-tight text-[#0a0f3c] lg:text-2xl">
                  {/* ⚠️ 「直近の1発話」で出すと、相手が話した瞬間にAIの発言が消えて
                       プレースホルダに戻る（実機で確認）。AIの最新発話を保持して出す。 */}
                  {rt.lastAiText || 'まもなく商談を始めます。'}
                </p>
              </div>

              {lastLine?.speaker === 'guest' && (
                <p className="mt-3 line-clamp-3 text-[13px] font-medium leading-relaxed text-[#5b6785] lg:text-sm">
                  <span className="font-black text-[#0a0f3c]">あなた: </span>
                  {lastLine.text}
                </p>
              )}

              {/* 日程調整。⚠️ 商談中いつでも押せるようにする。
                  締めまで隠すと、途中で「では日程を」となった相手が押せない。 */}
              {room?.schedulingUrl && (
                <div className="mt-4">
                  <SchedulingButton
                    url={room.schedulingUrl}
                    label={room.schedulingLabel}
                    onClick={recordScheduling}
                    variant="inline"
                  />
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* ワンタップ回答。
           ⚠️ 声で答えるのが面倒な相手のための入口なので、テキスト欄を開いていなくても出す。
              押したら即送信し、選び直しの余地は残さない（商談中に迷わせない）。 */}
      {rt.state === 'live' && rt.quickReplies && rt.quickReplies.choices.length > 0 && (
        <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-2">
          <p className="mb-1.5 text-[11px] font-black text-[#8a94ad]">
            {rt.quickReplies.label}：タップで答えられます
          </p>
          <div className="flex flex-col gap-1.5">
            {rt.quickReplies.choices.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  // 送信できたら候補を消す。同じ答えを二度押させない
                  if (rt.sendText(c)) setSentQuick(c)
                }}
                disabled={sentQuick === c}
                className="w-full rounded-xl border-2 border-[#d8e7ff] bg-white px-4 py-3 text-left text-sm font-bold text-[#0a0f3c] transition hover:border-[#0066ff] hover:bg-[#f7faff] disabled:opacity-40"
              >
                {sentQuick === c ? `${c}（送信しました）` : c}
              </button>
            ))}
          </div>
        </div>
      )}

      {showText && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft.trim()) return
            if (rt.sendText(draft)) setDraft('')
          }}
          className="mx-auto flex w-full max-w-3xl shrink-0 items-center gap-2 px-4 pb-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="文字でお話しする場合はこちらに入力"
            className="flex-1 rounded-full border border-[#dfe6f3] bg-white px-4 py-2.5 text-sm font-medium text-[#0a0f3c] outline-none focus:border-[#0066ff]"
          />
          <button
            type="submit"
            disabled={!draft.trim() || rt.state !== 'live'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0066ff] text-white disabled:bg-[#b9cdf5]"
            aria-label="送信"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </form>
      )}

      <footer className="flex shrink-0 items-start justify-center gap-3 border-t border-[#dfe6f3] bg-white px-3 py-3 lg:gap-4">
        {/* ⚠️ 担当の発話中もマイクは開けておく。先に答えても中断は起きない。 */}
        <RoundButton onClick={toggleMic} icon={micOn ? 'mic' : 'mic_off'} label={micOn ? 'ミュート' : '解除'} tone={micOn ? 'default' : 'danger'} />
        <RoundButton onClick={toggleText} icon="keyboard" label="テキスト" tone={showText ? 'active' : 'default'} />
        <RoundButton onClick={() => setSheet(sheet === 'log' ? null : 'log')} icon="forum" label="会話ログ" tone={sheet === 'log' ? 'active' : 'default'} />
        <RoundButton onClick={() => void rt.end()} icon="logout" label="終了" tone="danger" />
      </footer>

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={() => setSheet(null)}>
          <div
            className="max-h-[70dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl lg:mb-8 lg:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-[#0a0f3c]">{sheet === 'agenda' ? '本日の進み方' : '会話ログ'}</h2>
              <button onClick={() => setSheet(null)} aria-label="閉じる" className="text-[#8a94ad]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {sheet === 'agenda' ? (
              <ol className="space-y-2">
                {(room?.phaseNames || []).map((p, i) => {
                  const done = currentPhaseIndex >= 0 && i < currentPhaseIndex
                  const now = i === currentPhaseIndex
                  return (
                    <li key={p} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${now ? 'bg-[#f2f6ff]' : ''}`}>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                          done || now ? 'bg-[#0066ff] text-white' : 'bg-[#eef3ff] text-[#8a94ad]'
                        }`}
                      >
                        {done ? <span className="material-symbols-outlined text-[14px]">check</span> : i + 1}
                      </span>
                      <span className={`text-sm ${now ? 'font-black text-[#0a0f3c]' : 'font-medium text-[#425071]'}`}>{p}</span>
                    </li>
                  )
                })}
              </ol>
            ) : rt.lines.length === 0 ? (
              <p className="py-6 text-center text-sm font-medium text-[#8a94ad]">まだ会話がありません。</p>
            ) : (
              <div className="space-y-2.5">
                {rt.lines.map((l, i) => (
                  <p key={i} className="text-sm leading-relaxed">
                    <span className={l.speaker === 'ai' ? 'font-black text-[#0066ff]' : 'font-black text-[#0a0f3c]'}>
                      {l.speaker === 'ai' ? '担当' : 'あなた'}:{' '}
                    </span>
                    <span className="font-medium text-[#425071]">{l.text}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

function RoundButton({
  onClick, icon, label, tone = 'default', disabled = false,
}: {
  onClick: () => void
  icon: string
  label: string
  tone?: 'default' | 'active' | 'danger'
  disabled?: boolean
}) {
  const style =
    tone === 'danger'
      ? 'bg-[#ffe9f0] text-[#c2185b]'
      : tone === 'active'
        ? 'bg-[#e8f0ff] text-[#0066ff]'
        : 'bg-[#f4f6fa] text-[#425071]'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-16 flex-col items-center gap-1 disabled:cursor-not-allowed disabled:opacity-45">
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${style}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </span>
      <span className="text-[10px] font-black leading-tight text-[#5b6785]">{label}</span>
    </button>
  )
}
