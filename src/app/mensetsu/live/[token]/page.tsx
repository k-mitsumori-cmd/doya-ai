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

  const onEnded = useCallback(() => setStep('done'), [])
  const rt = useRealtimeInterview({ token, onEnded, recordAudio: !!session?.recordAudio })

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
        <p className="text-sm font-bold text-[#425071]">読み込んでいます…</p>
      </main>
    )
  }

  if (step === 'unavailable') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f6ff] px-5">
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

  // ---------------- ライブ面接（Zoom風） ----------------
  const remaining = Math.max(0, rt.durationMin * 60 - rt.elapsedSec)

  return (
    <main className="flex min-h-screen flex-col bg-[#0a0f1e]">
      {/* 上部バー */}
      <header className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-white">{session?.companyName}</span>
          <span className="text-xs font-medium text-white/60">{session?.jobTitle} 一次面接</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">
            残り {fmt(remaining)}
          </span>
        </div>
      </header>

      {/* 面接官 */}
      <section className="relative flex flex-1 items-center justify-center px-5">
        <div className="flex h-full w-full max-w-3xl items-center justify-center rounded-2xl bg-gradient-to-b from-[#182444] to-[#0f1730] p-6">
          {rt.state === 'connecting' || rt.state === 'requesting_mic' ? (
            <div className="text-center">
              <p className="text-sm font-bold text-white">
                {rt.state === 'requesting_mic' ? 'マイクの許可を確認しています…' : '面接官に接続しています…'}
              </p>
            </div>
          ) : rt.state === 'error' ? (
            <div className="max-w-sm text-center">
              <span className="material-symbols-outlined text-3xl text-white/70">error</span>
              <p className="mt-2 text-sm font-bold text-white">{rt.error}</p>
              <button
                onClick={beginInterview}
                className="mt-4 rounded-lg bg-white px-5 py-2.5 text-sm font-black text-[#0a0f3c]"
              >
                もう一度試す
              </button>
            </div>
          ) : (
            <Avatar level={rt.level} speaking={rt.speaking} listening={rt.listening} />
          )}
        </div>
      </section>

      {/* 字幕 */}
      {showCaptions && rt.lines.length > 0 && (
        <div
          ref={logRef}
          className="mx-auto max-h-40 w-full max-w-3xl overflow-y-auto px-5 py-3"
        >
          {rt.lines.slice(-8).map((l, i) => (
            <p key={i} className="mb-1.5 text-sm leading-relaxed">
              <span className={l.speaker === 'interviewer' ? 'font-black text-[#7fb0ff]' : 'font-black text-white'}>
                {l.speaker === 'interviewer' ? '面接官' : 'あなた'}:{' '}
              </span>
              <span className="font-medium text-white/85">{l.text}</span>
            </p>
          ))}
        </div>
      )}

      {/* 操作バー */}
      <footer className="flex items-center justify-center gap-3 px-5 py-5">
        <button
          onClick={() => setShowCaptions((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-xs font-bold text-white"
        >
          <span className="material-symbols-outlined text-[18px]">closed_caption</span>
          字幕{showCaptions ? 'オフ' : 'オン'}
        </button>
        <button
          onClick={() => void rt.end(true)}
          className="flex items-center gap-2 rounded-full bg-[#ff1e72] px-5 py-2.5 text-xs font-black text-white"
        >
          <span className="material-symbols-outlined text-[18px]">call_end</span>
          面接を終了
        </button>
      </footer>
    </main>
  )
}
