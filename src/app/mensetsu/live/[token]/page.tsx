'use client'

// ============================================
// ドヤ面接官 面接本番（応募者向け・未ログイン）
// ============================================
// 同意（C1）→ 機器チェック → Zoom風ライブ面接 → 終了。
// ⚠️ この画面は第三者（応募者）が開く。評価結果・ルーブリックは絶対に表示しない。

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Avatar from '@/components/mensetsu/Avatar'
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
  const selfVideoRef = useRef<HTMLVideoElement | null>(null)
  const camStreamRef = useRef<MediaStream | null>(null)

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

  // ---------------- ライブ面接（Web会議風） ----------------
  const remaining = Math.max(0, rt.durationMin * 60 - rt.elapsedSec)
  const connecting = rt.state === 'connecting' || rt.state === 'requesting_mic'

  return (
    <main className="flex h-[100dvh] flex-col bg-[#eef2f9]">
      <style dangerouslySetInnerHTML={{ __html: SUPPRESS_MARKETING_CSS }} />

      {/* 上部バー：会議名・経過・残り時間 */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#dfe6f3] bg-white px-4 py-2.5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0066ff]">
            <span className="material-symbols-outlined text-[18px] text-white">support_agent</span>
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-tight text-[#0a0f3c]">
              {session?.jobTitle} 一次面接
            </p>
            <p className="truncate text-[11px] font-bold text-[#8a94ad]">{session?.companyName}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-full bg-[#f2f6ff] px-3 py-1 text-[11px] font-black text-[#0066ff] sm:inline">
            {rt.state === 'live' ? '接続中' : connecting ? '接続しています' : '待機'}
          </span>
          <span className="rounded-full bg-[#0a0f3c] px-3 py-1 text-[11px] font-black tabular-nums text-white">
            残り {fmt(remaining)}
          </span>
        </div>
      </header>

      {/* 参加者タイル */}
      <section className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row lg:p-4">
        {/* 面接官（メインタイル） */}
        <div
          className={`relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-white shadow-sm ring-2 transition-colors ${
            rt.speaking ? 'ring-[#0066ff]' : 'ring-transparent'
          }`}
        >
          {connecting ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#0066ff] border-t-transparent" />
              <p className="text-sm font-bold text-[#425071]">
                {rt.state === 'requesting_mic' ? 'マイクの許可を確認しています…' : '面接官に接続しています…'}
              </p>
            </div>
          ) : rt.state === 'error' ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <span className="material-symbols-outlined text-3xl text-[#8a94ad]">error</span>
              <p className="mt-2 max-w-sm text-sm font-bold text-[#0a0f3c]">{rt.error}</p>
              <button
                onClick={beginInterview}
                className="mt-4 rounded-lg bg-[#0066ff] px-5 py-2.5 text-sm font-black text-white"
              >
                もう一度試す
              </button>
            </div>
          ) : (
            <Avatar level={rt.level} speaking={rt.speaking} listening={rt.listening} />
          )}

          {/* 名前バッジ（会議アプリと同じく左下） */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur">
            <span
              className={`material-symbols-outlined text-[16px] ${rt.speaking ? 'text-[#0066ff]' : 'text-[#8a94ad]'}`}
            >
              {rt.speaking ? 'graphic_eq' : 'mic'}
            </span>
            <span className="text-xs font-black text-[#0a0f3c]">AI面接官</span>
          </div>
        </div>

        {/* 自分（サブタイル） */}
        <div
          className={`relative h-32 shrink-0 overflow-hidden rounded-2xl bg-[#0a0f3c] shadow-sm ring-2 transition-colors lg:h-auto lg:w-72 ${
            rt.listening ? 'ring-emerald-400' : 'ring-transparent'
          }`}
        >
          <video
            ref={selfVideoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover ${cameraOn ? '' : 'hidden'}`}
            style={{ transform: 'scaleX(-1)' }}
          />
          {!cameraOn && (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-lg font-black text-white">
                {(session?.candidateName || name || 'あ').slice(0, 1)}
              </span>
              <p className="text-[11px] font-bold text-white/60">カメラはオフです</p>
            </div>
          )}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/45 px-2.5 py-1 backdrop-blur">
            <span
              className={`material-symbols-outlined text-[15px] ${
                micOn ? (rt.listening ? 'text-emerald-300' : 'text-white') : 'text-[#ff6b9a]'
              }`}
            >
              {micOn ? 'mic' : 'mic_off'}
            </span>
            <span className="text-[11px] font-black text-white">
              {session?.candidateName || name || 'あなた'}
            </span>
          </div>
        </div>
      </section>

      {/* 字幕 */}
      {showCaptions && rt.lines.length > 0 && (
        <div
          ref={logRef}
          className="mx-auto max-h-32 w-full max-w-4xl shrink-0 overflow-y-auto px-4 pb-1"
        >
          {rt.lines.slice(-8).map((l, i) => (
            <p key={i} className="mb-1.5 text-sm leading-relaxed">
              <span
                className={
                  l.speaker === 'interviewer' ? 'font-black text-[#0066ff]' : 'font-black text-[#0a0f3c]'
                }
              >
                {l.speaker === 'interviewer' ? '面接官' : 'あなた'}:{' '}
              </span>
              <span className="font-medium text-[#425071]">{l.text}</span>
            </p>
          ))}
        </div>
      )}

      {/* テキストで回答（音声が使えない・騒がしいとき用） */}
      {showText && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft.trim()) return
            if (rt.sendText(draft)) setDraft('')
          }}
          className="mx-auto flex w-full max-w-4xl shrink-0 items-center gap-2 px-4 pb-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="文字で回答する場合はこちらに入力してください"
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

      {/* 操作バー */}
      <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-[#dfe6f3] bg-white px-4 py-3">
        <ControlButton
          active={micOn}
          onClick={toggleMic}
          icon={micOn ? 'mic' : 'mic_off'}
          label={micOn ? 'ミュート' : '解除'}
          danger={!micOn}
        />
        <ControlButton
          active={cameraOn}
          onClick={toggleCamera}
          icon={cameraOn ? 'videocam' : 'videocam_off'}
          label={cameraOn ? 'カメラ' : 'カメラ'}
        />
        <ControlButton
          active={showText}
          onClick={() => setShowText((v) => !v)}
          icon="keyboard"
          label="テキスト"
        />
        <ControlButton
          active={showCaptions}
          onClick={() => setShowCaptions((v) => !v)}
          icon="closed_caption"
          label="字幕"
        />
        <button
          onClick={() => void rt.end(true)}
          className="ml-2 flex items-center gap-1.5 rounded-full bg-[#ff1e72] px-5 py-2.5 text-xs font-black text-white"
        >
          <span className="material-symbols-outlined text-[18px]">call_end</span>
          退出
        </button>
      </footer>

      <p className="shrink-0 pb-2 text-center text-[10px] font-medium text-[#8a94ad]">
        カメラ映像はこの画面に表示されるだけで、送信も録画もされません。
      </p>
    </main>
  )
}

function ControlButton({
  active,
  onClick,
  icon,
  label,
  danger,
}: {
  active: boolean
  onClick: () => void
  icon: string
  label: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-w-[62px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-colors ${
        danger
          ? 'bg-[#ffe9f0] text-[#c2185b]'
          : active
            ? 'bg-[#f2f6ff] text-[#0066ff]'
            : 'bg-[#f4f6fa] text-[#8a94ad]'
      }`}
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
      <span className="text-[10px] font-black">{label}</span>
    </button>
  )
}
