'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { looksLikeQuestion } from '@/lib/cunning/classify'

interface TranscriptLine {
  id: string
  text: string
}
interface AnswerCard {
  id: string
  question: string
  summary: string
  script: string
  sources: { label: string; url?: string }[]
  model?: string
  loading: boolean
}

// 1チャンクの録音窓（秒）。短いほど反応が速いが文字起こし回数が増える。
const WINDOW_MS = 5000

function pickMime(): string {
  const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  for (const c of cands) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  }
  return 'audio/webm'
}

export default function CunningLivePage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const [answers, setAnswers] = useState<AnswerCard[]>([])
  const [statusMsg, setStatusMsg] = useState('「ライブ開始」で会議タブの音声共有を許可してください')

  const streamRef = useRef<MediaStream | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const runningRef = useRef(false)
  const mimeRef = useRef('audio/webm')
  const recentRef = useRef<string[]>([]) // 直近の発話（文脈）
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [showSubs, setShowSubs] = useState(true)

  const stopAll = useCallback(() => {
    runningRef.current = false
    setRunning(false)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioStreamRef.current?.getTracks().forEach((t) => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    streamRef.current = null
    audioStreamRef.current = null
  }, [])

  // アンマウント時に停止＋セッション終了
  useEffect(() => {
    return () => {
      stopAll()
      fetch(`/api/cunning/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ end: true }),
        keepalive: true,
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 経過秒カウント + 30秒ごとに利用時間を加算保存
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1
        if (next % 30 === 0) {
          fetch(`/api/cunning/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addSeconds: 30 }),
          }).catch(() => {})
        }
        return next
      })
    }, 1000)
    return () => clearInterval(t)
  }, [running, sessionId])

  const requestAnswer = useCallback(
    async (question: string) => {
      const cardId = `a-${Date.now()}-${Math.round(Math.random() * 1e6)}`
      setAnswers((prev) => [
        { id: cardId, question, summary: '', script: '', sources: [], loading: true },
        ...prev,
      ])
      try {
        const res = await fetch('/api/cunning/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            question,
            recentTranscript: recentRef.current.slice(-4).join(' / '),
          }),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error || '回答生成に失敗しました')
        setAnswers((prev) =>
          prev.map((c) =>
            c.id === cardId
              ? { ...c, summary: d.summary, script: d.script, sources: d.sources || [], model: d.model, loading: false }
              : c
          )
        )
      } catch (e: any) {
        setAnswers((prev) =>
          prev.map((c) =>
            c.id === cardId ? { ...c, summary: '⚠️ ' + e.message, script: '', loading: false } : c
          )
        )
      }
    },
    [sessionId]
  )

  const sendChunk = useCallback(
    async (blob: Blob) => {
      if (blob.size < 1200) return // ほぼ無音
      try {
        const fd = new FormData()
        fd.append('audio', blob, 'chunk.webm')
        fd.append('sessionId', sessionId)
        const res = await fetch('/api/cunning/transcribe', { method: 'POST', body: fd })
        const d = await res.json()
        if (!res.ok) return
        const text = (d.text || '').trim()
        if (!text) return
        setLines((prev) => [...prev.slice(-80), { id: `l-${Date.now()}-${prev.length}`, text }])
        recentRef.current.push(text)
        if (looksLikeQuestion(text)) requestAnswer(text)
      } catch {
        /* 1チャンクの失敗は無視して継続 */
      }
    },
    [sessionId, requestAnswer]
  )

  // 録音→チャンク送信のループ（窓ごとに独立したwebmを生成）
  const startCycle = useCallback(() => {
    const stream = audioStreamRef.current
    if (!stream || !runningRef.current) return
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(stream, { mimeType: mimeRef.current })
    } catch {
      rec = new MediaRecorder(stream)
    }
    const parts: BlobPart[] = []
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) parts.push(e.data)
    }
    rec.onstop = () => {
      if (runningRef.current) startCycle() // 次の窓をすぐ開始（取りこぼし最小化）
      const blob = new Blob(parts, { type: mimeRef.current })
      void sendChunk(blob)
    }
    rec.start()
    setTimeout(() => {
      if (rec.state !== 'inactive') rec.stop()
    }, WINDOW_MS)
  }, [sendChunk])

  const start = async () => {
    try {
      mimeRef.current = pickMime()
      // タブ音声取得には video も要求する必要がある（Chrome仕様）。取得後 video は破棄。
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })
      streamRef.current = display
      const audioTracks = display.getAudioTracks()
      if (audioTracks.length === 0) {
        stopAll()
        toast.error('音声が共有されていません。共有ダイアログで「タブの音声を共有」にチェックしてください')
        return
      }
      // 共有タブの映像をプレビュー表示（音声はミュートしてエコー防止＝相手の声は会議タブから聞く）
      if (videoRef.current) {
        videoRef.current.srcObject = display
        videoRef.current.play().catch(() => {})
      }
      // 文字起こし用には音声のみのストリームを使う
      audioStreamRef.current = new MediaStream(audioTracks)

      // 共有停止（ブラウザの停止ボタン）でセッションも止める（音声/映像どちらの終了でも）
      const onEnded = () => {
        stopAll()
        setStatusMsg('画面共有が停止されました')
      }
      audioTracks[0].addEventListener('ended', onEnded)
      display.getVideoTracks().forEach((t) => t.addEventListener('ended', onEnded))

      runningRef.current = true
      setRunning(true)
      setStatusMsg('解析中… 相手の質問を検出すると回答が表示されます')
      startCycle()
    } catch (e: any) {
      toast.error('音声共有を開始できませんでした')
      stopAll()
    }
  }

  const stop = () => {
    stopAll()
    setStatusMsg('停止しました')
    fetch(`/api/cunning/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ end: true, addSeconds: elapsed % 30 }),
    }).catch(() => {})
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  const latest = answers[0] // 最新回答（カンペ表示用）

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/cunning" className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="flex items-center gap-2">
            {running && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
            <span className="font-black text-slate-800">{running ? '解析中' : '待機中'}</span>
            <span className="text-sm font-mono font-bold text-slate-500">{mm}:{ss}</span>
          </div>
        </div>
        {running ? (
          <button
            onClick={stop}
            className="px-5 py-2.5 rounded-full bg-slate-800 text-white font-black hover:bg-slate-900 transition-all"
          >
            停止
          </button>
        ) : (
          <button
            onClick={start}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#7f19e6] to-fuchsia-600 text-white font-black shadow-lg hover:shadow-xl transition-all"
          >
            🎤 ライブ開始
          </button>
        )}
      </div>

      <p className="text-xs font-bold text-slate-400 mb-4">{statusMsg}</p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* 映像 + カンペオーバーレイ（メイン） */}
        <div className="order-1 space-y-3">
          <div className="relative bg-slate-900 rounded-2xl overflow-hidden aspect-video shadow-lg">
            <video ref={videoRef} muted playsInline autoPlay className="w-full h-full object-contain" />
            {!running && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-2">
                <div className="text-5xl">🎧</div>
                <p className="font-bold text-sm px-6 text-center">
                  ライブ開始で会議タブを共有すると、ここに映像が表示されます
                </p>
              </div>
            )}
            {/* カンペ: 最新回答を映像下にテレプロンプター表示 */}
            {running && latest && (
              <div className="absolute left-0 right-0 bottom-0 p-3 sm:p-5 bg-gradient-to-t from-black/95 via-black/75 to-transparent">
                <p className="text-[10px] font-black text-fuchsia-300 mb-1 truncate">💬 {latest.question}</p>
                {latest.loading ? (
                  <p className="text-white/85 font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                    カンペ生成中…
                  </p>
                ) : (
                  <>
                    <p className="text-white font-black text-base sm:text-2xl leading-snug">{latest.summary}</p>
                    {latest.script && (
                      <p className="text-white/85 text-xs sm:text-base font-medium mt-1 leading-relaxed line-clamp-3">
                        {latest.script}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* 字幕（折りたたみ可） */}
          <div className="bg-slate-900 rounded-2xl p-4">
            <button
              onClick={() => setShowSubs((v) => !v)}
              className="w-full flex items-center justify-between text-[11px] font-black text-slate-400 mb-2"
            >
              <span>相手の発話（字幕）</span>
              <span className="material-symbols-outlined text-base">{showSubs ? 'expand_less' : 'expand_more'}</span>
            </button>
            {showSubs && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {lines.length === 0 ? (
                  <p className="text-slate-500 text-sm font-bold">音声待機中…</p>
                ) : (
                  lines.map((l) => (
                    <p key={l.id} className="text-sm text-white/90 leading-relaxed">
                      {l.text}
                    </p>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* 回答履歴（サイド） */}
        <div className="order-2 space-y-3 lg:max-h-[80vh] lg:overflow-y-auto">
          <p className="text-xs font-black text-slate-400">回答履歴</p>
          {answers.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-slate-400">
              <div className="text-3xl mb-2">🎧</div>
              <p className="font-bold text-sm">相手の質問を検出すると回答案が表示されます</p>
            </div>
          ) : (
            answers.map((a) => (
              <div key={a.id} className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-[#7f19e6]">
                <p className="text-xs font-bold text-slate-400 mb-1">質問: {a.question}</p>
                {a.loading ? (
                  <div className="flex items-center gap-2 text-slate-500 font-bold py-2">
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    回答を生成中…
                  </div>
                ) : (
                  <>
                    <p className="text-base font-black text-slate-900 leading-snug">{a.summary}</p>
                    {a.script && (
                      <p className="mt-2 text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                        {a.script}
                      </p>
                    )}
                    {a.sources.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {a.sources.map((s, i) => (
                          <span
                            key={i}
                            className="text-[11px] font-bold text-[#7f19e6] bg-purple-50 rounded-full px-2.5 py-1"
                          >
                            {s.label}
                          </span>
                        ))}
                      </div>
                    )}
                    {a.model && <p className="mt-2 text-[10px] text-slate-300 font-bold">生成: {a.model}</p>}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
