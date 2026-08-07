'use client'

// ============================================
// ドヤ面接官 面接本番（応募者向け・未ログイン）
// ============================================
// 同意（C1）→ 機器チェック → Zoom風ライブ面接 → 終了。
// ⚠️ この画面は第三者（応募者）が開く。評価結果・ルーブリックは絶対に表示しない。

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Avatar from '@/components/mensetsu/Avatar'
import Waveform from '@/components/mensetsu/Waveform'
import { useRealtimeInterview } from '@/lib/mensetsu/useRealtimeInterview'

interface PublicSession {
  token: string
  status: string
  candidateName: string | null
  companyName: string
  jobTitle: string
  durationMin: number
  intro: string | null
  questionCount: number
  consented: boolean
  recordVideo: boolean
  recordAudio: boolean
  retentionDays: number
  expired: boolean
}

type Step = 'loading' | 'consent' | 'check' | 'live' | 'done' | 'unavailable'

/**
 * 応募者の画面にマーケティング用のポップアップ（HubSpot CTA）を出さない。
 * 面接を受けに来た第三者に自社サービスの営業を出すのは不適切であり、
 * 面接中に前面に出ると操作を妨げる。トップページと同じ手当てをこの画面にも入れる。
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

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function MensetsuLivePage() {
  const params = useParams<{ token: string }>()
  const token = params?.token as string

  const [step, setStep] = useState<Step>('loading')
  const [session, setSession] = useState<PublicSession | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [name, setName] = useState('')
  const [showCaptions, setShowCaptions] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const logRef = useRef<HTMLDivElement | null>(null)

  // 会議UIの操作状態
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(false)
  const [showText, setShowText] = useState(false)
  const [draft, setDraft] = useState('')
  const [sheet, setSheet] = useState<null | 'agenda' | 'log'>(null)
  const selfVideoRef = useRef<HTMLVideoElement | null>(null)
  const camStreamRef = useRef<MediaStream | null>(null)

  // 冒頭の数秒は挨拶カット、残り時間わずかになったら締めのカットを出す。
  // 面接の「入り」と「締め」が固定の絵になることで、会話の区切りが体感しやすくなる。
  const [avatarCue, setAvatarCue] = useState<'greet' | 'closing' | null>(null)

  const onEnded = useCallback(() => setStep('done'), [])
  const rt = useRealtimeInterview({ token, onEnded, recordAudio: !!session?.recordAudio })

  /** マイクのミュート。トラックを止めず enabled で切るのは、再開時に再取得が要らないため */
  const toggleMic = useCallback(() => {
    setMicOn((prev) => {
      const next = !prev
      rt.setMicEnabled(next)
      return next
    })
  }, [rt])

  /**
   * 自分のカメラ。**この画面に表示するだけで、送信も録画もしない。**
   * 会議らしさのためだけの機能なので、既定はオフ（許可を求める回数を減らす）。
   */
  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      camStreamRef.current?.getTracks().forEach((t) => t.stop())
      camStreamRef.current = null
      if (selfVideoRef.current) selfVideoRef.current.srcObject = null
      setCameraOn(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      camStreamRef.current = stream
      if (selfVideoRef.current) selfVideoRef.current.srcObject = stream
      setCameraOn(true)
    } catch {
      // カメラが使えなくても面接は成立する。黙ってオフのままにする。
    }
  }, [cameraOn])

  // 離脱時にカメラを確実に止める（ランプが点いたままにならないように）
  useEffect(
    () => () => {
      camStreamRef.current?.getTracks().forEach((t) => t.stop())
      camStreamRef.current = null
    },
    []
  )

  // 面接情報の取得。
  // ⚠️ Cookie認証ではないので、セッション状態でfetchをゲートしない（空画面固定の事故を避ける）
  useEffect(() => {
    if (!token) return
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/mensetsu/live/${token}`)
        const data = await res.json()
        if (!alive) return
        if (!res.ok) {
          setMessage(data?.error || '面接が見つかりません')
          setStep('unavailable')
          return
        }
        const s: PublicSession = data.session
        setSession(s)
        setName(s.candidateName || '')
        if (s.expired) {
          setMessage('この面接URLの有効期限が切れています。採用ご担当者にお問い合わせください。')
          setStep('unavailable')
        } else if (s.status === 'completed' || s.status === 'evaluated') {
          setStep('done')
        } else if (s.consented) {
          setStep('check')
        } else {
          setStep('consent')
        }
      } catch {
        if (!alive) return
        setMessage('通信に失敗しました。電波状況をご確認のうえ再読み込みしてください。')
        setStep('unavailable')
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  // 経過時間からアバターの特別カットを出し分ける
  useEffect(() => {
    if (rt.state !== 'live') {
      setAvatarCue(null)
      return
    }
    const remain = rt.durationMin * 60 - rt.elapsedSec
    if (rt.elapsedSec > 0 && rt.elapsedSec <= 6) setAvatarCue('greet')
    else if (remain <= 20) setAvatarCue('closing')
    else setAvatarCue(null)
  }, [rt.state, rt.elapsedSec, rt.durationMin])

  // 字幕は常に最新を表示
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [rt.lines])

  const submitConsent = async () => {
    if (!agreed) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/mensetsu/live/${token}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreed: true, candidateName: name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data?.error || '同意の記録に失敗しました')
        return
      }
      setStep('check')
    } finally {
      setSubmitting(false)
    }
  }

  const beginInterview = async () => {
    setStep('live')
    await rt.start()
  }

  // ---------------- 画面 ----------------

  if (step === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f6ff]">
      <style dangerouslySetInnerHTML={{ __html: SUPPRESS_MARKETING_CSS }} />
        <p className="text-sm font-bold text-[#425071]">読み込んでいます…</p>
      </main>
    )
  }

  if (step === 'unavailable') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f6ff] px-5">
      <style dangerouslySetInnerHTML={{ __html: SUPPRESS_MARKETING_CSS }} />
        <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
          <span className="material-symbols-outlined text-4xl text-[#425071]">error</span>
          <h1 className="mt-3 text-lg font-black text-[#0a0f3c]">面接を開始できません</h1>
          <p className="mt-3 text-sm font-medium leading-relaxed text-[#425071]">{message}</p>
        </div>
      </main>
    )
  }

  if (step === 'done') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f6ff] px-5">
      <style dangerouslySetInnerHTML={{ __html: SUPPRESS_MARKETING_CSS }} />
        <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
          <span className="material-symbols-outlined text-4xl text-[#0066ff]">task_alt</span>
          <h1 className="mt-3 text-lg font-black text-[#0a0f3c]">面接は以上です</h1>
          <p className="mt-3 text-sm font-medium leading-relaxed text-[#425071]">
            お時間をいただきありがとうございました。
            <br />
            結果は追って採用ご担当者よりご連絡いたします。
          </p>
          <p className="mt-4 text-xs font-medium text-[#8a94ad]">このページは閉じていただいて構いません。</p>
        </div>
      </main>
    )
  }

  if (step === 'consent' && session) {
    return (
      <main className="min-h-screen bg-[#f2f6ff] px-5 py-12">
      <style dangerouslySetInnerHTML={{ __html: SUPPRESS_MARKETING_CSS }} />
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-black text-[#0066ff]">{session.companyName}</p>
          <h1 className="mt-2 text-2xl font-black leading-snug text-[#0a0f3c]">
            {session.jobTitle} の一次面接
          </h1>
          <p className="mt-2 text-sm font-medium text-[#425071]">
            所要時間 約{session.durationMin}分 / 質問 {session.questionCount}問
          </p>

          <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-base font-black text-[#0a0f3c]">はじめにご確認ください</h2>
            <ul className="mt-4 space-y-3 text-sm font-medium leading-relaxed text-[#425071]">
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#0066ff]">smart_toy</span>
                <span>
                  この面接は<strong className="font-black text-[#0a0f3c]">AIが面接官として実施</strong>します。人が同席することはありません。
                </span>
              </li>
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#0066ff]">mic</span>
                <span>
                  面接中の音声は<strong className="font-black text-[#0a0f3c]">文字に起こして記録</strong>されます。
                  {session.recordAudio && (
                    <>
                      あわせて<strong className="font-black text-[#0a0f3c]">音声そのものを録音して保存</strong>します。
                    </>
                  )}
                  {session.recordVideo ? '映像も録画されます。' : '映像は録画しません。'}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#0066ff]">fact_check</span>
                <span>
                  記録は評価の参考として利用され、
                  <strong className="font-black text-[#0a0f3c]">最終的な選考の判断は採用担当者（人）が行います。</strong>
                  AIの評価だけで合否が決まることはありません。
                </span>
              </li>
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#0066ff]">schedule</span>
                <span>
                  記録は<strong className="font-black text-[#0a0f3c]">{session.retentionDays}日間</strong>保管され、その後削除されます。
                  開示・削除をご希望の場合は採用ご担当者にお申し出ください。
                </span>
              </li>
            </ul>

            <div className="mt-6">
              <label className="block text-xs font-black text-[#0a0f3c]">お名前</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="山田 太郎"
                className="mt-2 w-full rounded-lg border border-[#d8e7ff] px-4 py-3 text-sm font-medium text-[#0a0f3c] outline-none focus:border-[#0066ff]"
              />
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#0066ff]"
              />
              <span className="text-sm font-bold text-[#0a0f3c]">
                上記の内容に同意して面接を受けます
              </span>
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

  if (step === 'check' && session) {
    return (
      <main className="min-h-screen bg-[#f2f6ff] px-5 py-12">
      <style dangerouslySetInnerHTML={{ __html: SUPPRESS_MARKETING_CSS }} />
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-black text-[#0a0f3c]">準備はよろしいですか</h1>
          <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
            <ul className="space-y-3 text-sm font-medium leading-relaxed text-[#425071]">
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#0066ff]">headphones</span>
                <span>静かな場所で、イヤホンのご利用をおすすめします（音の回り込みを防げます）。</span>
              </li>
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#0066ff]">mic</span>
                <span>開始するとマイクの使用許可を求められます。「許可」を選んでください。</span>
              </li>
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#0066ff]">forum</span>
                <span>面接官が話し終えてから、普段どおりの速さでお話しください。途中で話し始めても構いません。</span>
              </li>
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#0066ff]">timer</span>
                <span>所要時間は約{session.durationMin}分です。</span>
              </li>
            </ul>
            <button
              onClick={beginInterview}
              className="mt-6 w-full rounded-lg bg-[#0066ff] px-6 py-3.5 text-sm font-black text-white"
            >
              面接を開始する
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ---------------- ライブ面接 ----------------
  // スマホ: 丸アバター → 波形 → 発言カード → 操作バー（縦積み）
  // PC:     左に質問パネル / 右にアバター（プレゼンター型）
  const remaining = Math.max(0, rt.durationMin * 60 - rt.elapsedSec)
  const connecting = rt.state === 'connecting' || rt.state === 'requesting_mic'
  const lastLine = rt.lines[rt.lines.length - 1]
  const statusLabel = rt.speaking ? '面接官が話しています' : rt.listening ? 'お話しください' : 'お待ちください'

  return (
    <main className="flex h-[100dvh] flex-col bg-gradient-to-b from-[#f7faff] to-[#e9f0fb]">
      <style dangerouslySetInnerHTML={{ __html: SUPPRESS_MARKETING_CSS }} />

      {/* 上部バー */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#dfe6f3] bg-white/85 px-3 py-2.5 backdrop-blur lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0066ff]">
            <span className="material-symbols-outlined text-[18px] text-white">support_agent</span>
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black leading-tight text-[#0a0f3c] lg:text-sm">
              {session?.jobTitle} 一次面接
            </p>
            <p className="truncate text-[10px] font-bold text-[#8a94ad] lg:text-[11px]">{session?.companyName}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* アジェンダ（目次） */}
          <button
            onClick={() => setSheet(sheet === 'agenda' ? null : 'agenda')}
            className="flex items-center gap-1 rounded-full border border-[#dfe6f3] bg-white px-3 py-1.5 text-[11px] font-black text-[#425071]"
          >
            アジェンダ
            <span className="material-symbols-outlined text-[16px]">expand_more</span>
          </button>
          <span className="rounded-full bg-[#0a0f3c] px-2.5 py-1 text-[11px] font-black tabular-nums text-white">
            {fmt(remaining)}
          </span>
        </div>
      </header>

      {/* 本体 */}
      <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 lg:flex-row lg:items-center lg:gap-8 lg:overflow-hidden lg:p-8">
        {connecting ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#0066ff] border-t-transparent" />
            <p className="text-sm font-bold text-[#425071]">
              {rt.state === 'requesting_mic' ? 'マイクの許可を確認しています…' : '面接官に接続しています…'}
            </p>
          </div>
        ) : rt.state === 'error' ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="material-symbols-outlined text-3xl text-[#8a94ad]">error</span>
            <p className="mt-2 max-w-sm text-sm font-bold text-[#0a0f3c]">{rt.error}</p>
            <button onClick={beginInterview} className="mt-4 rounded-lg bg-[#0066ff] px-5 py-2.5 text-sm font-black text-white">
              もう一度試す
            </button>
          </div>
        ) : (
          <>
            {/* アバター（スマホは丸・上／PCは右） */}
            <div className="order-1 flex shrink-0 flex-col items-center lg:order-2 lg:w-[38%] lg:max-w-[420px]">
              <div className="h-40 w-40 lg:h-auto lg:w-full">
                <Avatar
                  level={rt.level}
                  speaking={rt.speaking}
                  listening={rt.listening}
                  cue={avatarCue}
                  circle
                />
              </div>
              <p className="mt-2 text-sm font-black text-[#0a0f3c]">AI面接官</p>
              <p className="text-[11px] font-bold text-[#8a94ad]">{statusLabel}</p>
              <Waveform level={rt.level} speaking={rt.speaking} listening={rt.listening} />
            </div>

            {/* 質問・発言 */}
            <div className="order-2 flex min-h-0 flex-1 flex-col justify-center lg:order-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#0066ff] px-3 py-1 text-[11px] font-black text-white">
                  質問 {rt.questionNumber}
                  {rt.questionTotal > 0 && ` / ${rt.questionTotal}`}
                </span>
                {rt.questionTotal > 0 && (
                  <span className="hidden items-center gap-1 lg:flex">
                    {Array.from({ length: rt.questionTotal }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${
                          i + 1 < rt.questionNumber ? 'w-4 bg-[#0066ff]' : i + 1 === rt.questionNumber ? 'w-8 bg-[#0066ff]' : 'w-4 bg-[#cfe3ff]'
                        }`}
                      />
                    ))}
                  </span>
                )}
              </div>

              <div className="rounded-2xl border border-[#dfe6f3] border-l-[6px] border-l-[#0066ff] bg-white p-5 shadow-sm lg:p-8">
                <p className="text-base font-black leading-[1.75] tracking-tight text-[#0a0f3c] lg:text-[26px]">
                  {rt.currentQuestion || 'まもなく面接を始めます。'}
                </p>
              </div>

              {showCaptions && lastLine && (
                <p className="mt-3 line-clamp-3 text-[13px] font-medium leading-relaxed text-[#5b6785] lg:text-sm">
                  <span className={lastLine.speaker === 'interviewer' ? 'font-black text-[#0066ff]' : 'font-black text-[#0a0f3c]'}>
                    {lastLine.speaker === 'interviewer' ? '面接官' : 'あなた'}:{' '}
                  </span>
                  {lastLine.text}
                </p>
              )}
            </div>
          </>
        )}
      </section>

      {/* テキストで回答 */}
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
            placeholder="文字で回答する場合はこちらに入力"
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

      {/* 操作バー（スマホでも押しやすい丸ボタン） */}
      <footer className="flex shrink-0 items-start justify-center gap-3 border-t border-[#dfe6f3] bg-white px-3 py-3 lg:gap-4">
        <RoundButton onClick={toggleMic} icon={micOn ? 'mic' : 'mic_off'} label={micOn ? 'ミュート' : '解除'} tone={micOn ? 'default' : 'danger'} />
        <RoundButton onClick={toggleCamera} icon={cameraOn ? 'videocam' : 'videocam_off'} label="カメラ" tone={cameraOn ? 'active' : 'default'} />
        <RoundButton onClick={() => setShowText((v) => !v)} icon="keyboard" label="テキスト" tone={showText ? 'active' : 'default'} />
        <RoundButton onClick={() => setSheet(sheet === 'log' ? null : 'log')} icon="forum" label="会話ログ" tone={sheet === 'log' ? 'active' : 'default'} />
        <RoundButton onClick={() => void rt.end(true)} icon="logout" label="退出" tone="danger" />
      </footer>

      {/* シート: アジェンダ / 会話ログ */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={() => setSheet(null)}>
          <div
            className="max-h-[70dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl lg:mb-8 lg:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-[#0a0f3c]">
                {sheet === 'agenda' ? '面接の進み方' : '会話ログ'}
              </h2>
              <button onClick={() => setSheet(null)} aria-label="閉じる" className="text-[#8a94ad]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {sheet === 'agenda' ? (
              <ol className="space-y-2">
                {Array.from({ length: rt.questionTotal || 1 }).map((_, i) => {
                  const n = i + 1
                  const done = n < rt.questionNumber
                  const now = n === rt.questionNumber
                  return (
                    <li
                      key={n}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${now ? 'bg-[#f2f6ff]' : ''}`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                          done ? 'bg-[#0066ff] text-white' : now ? 'bg-[#0066ff] text-white' : 'bg-[#eef3ff] text-[#8a94ad]'
                        }`}
                      >
                        {done ? <span className="material-symbols-outlined text-[14px]">check</span> : n}
                      </span>
                      <span className={`text-sm ${now ? 'font-black text-[#0a0f3c]' : 'font-medium text-[#425071]'}`}>
                        {now ? rt.currentQuestion || `質問 ${n}` : `質問 ${n}`}
                      </span>
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
                    <span className={l.speaker === 'interviewer' ? 'font-black text-[#0066ff]' : 'font-black text-[#0a0f3c]'}>
                      {l.speaker === 'interviewer' ? '面接官' : 'あなた'}:{' '}
                    </span>
                    <span className="font-medium text-[#425071]">{l.text}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* カメラ映像（オン時のみ小さく重ねる） */}
      <video
        ref={selfVideoRef}
        autoPlay
        muted
        playsInline
        className={`fixed bottom-24 right-3 z-40 h-24 w-32 rounded-xl object-cover shadow-lg ring-2 ring-white ${cameraOn ? '' : 'hidden'}`}
        style={{ transform: 'scaleX(-1)' }}
      />
    </main>
  )
}

function RoundButton({
  onClick,
  icon,
  label,
  tone = 'default',
}: {
  onClick: () => void
  icon: string
  label: string
  tone?: 'default' | 'active' | 'danger'
}) {
  const style =
    tone === 'danger'
      ? 'bg-[#ffe9f0] text-[#c2185b]'
      : tone === 'active'
        ? 'bg-[#e8f0ff] text-[#0066ff]'
        : 'bg-[#f4f6fa] text-[#425071]'
  return (
    <button onClick={onClick} className="flex w-16 flex-col items-center gap-1">
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${style}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </span>
      <span className="text-[10px] font-black leading-tight text-[#5b6785]">{label}</span>
    </button>
  )
}
