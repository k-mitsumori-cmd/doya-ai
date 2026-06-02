'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { looksLikeQuestion } from '@/lib/cunning/classify'

interface AnswerCard {
  id: string
  question: string
  summary: string
  script: string
  sources: { label: string; url?: string }[]
  model?: string
  loading: boolean
}
interface TranscriptLine {
  id: string
  text: string
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

// 質問の正規化（二重発火・重複検出用）
function normQ(s: string): string {
  return s.toLowerCase().replace(/[\s、。．，！？!?.\-―ー…]/g, '')
}

export default function CunningLivePage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const [answers, setAnswers] = useState<AnswerCard[]>([])
  const [statusMsg, setStatusMsg] = useState('「ライブ開始」で会議タブの音声共有を許可してください')
  const [showSubs, setShowSubs] = useState(true)
  const [manualQ, setManualQ] = useState('')
  const [pipWindow, setPipWindow] = useState<Window | null>(null)
  const [prep, setPrep] = useState<{ question: string; summary: string; script: string }[]>([])
  const [prepLoading, setPrepLoading] = useState(false)
  const [showPrep, setShowPrep] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const runningRef = useRef(false)
  const mimeRef = useRef('audio/webm')
  const recentRef = useRef<string[]>([]) // 直近の発話（文脈）
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lastLineRef = useRef('') // 直近の文字起こし（重複除去）
  const lastQRef = useRef<{ q: string; t: number }>({ q: '', t: 0 }) // 直近に投げた質問（二重発火ガード）
  const audioCtxRef = useRef<AudioContext | null>(null)
  const peakRef = useRef(0) // 現在の録音窓の音量ピーク（無音チャンク除外用）
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

// 無音判定の閾値（getByteTimeDomainData の 128 からの最大偏差）。これ未満の窓は送らない。
const SILENCE_PEAK = 8

  const stopAll = useCallback(() => {
    runningRef.current = false
    setRunning(false)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioStreamRef.current?.getTracks().forEach((t) => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    if (levelTimerRef.current) clearInterval(levelTimerRef.current)
    levelTimerRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    peakRef.current = 0
    streamRef.current = null
    audioStreamRef.current = null
  }, [])

  // アンマウント時に停止＋セッション終了＋PiPを閉じる
  useEffect(() => {
    return () => {
      stopAll()
      pipWindow?.close()
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
    async (question: string, opts: { force?: boolean } = {}) => {
      const q = question.trim()
      if (!q) return
      // 二重発火ガード（自動検出時のみ。手動/再生成は force で常に実行）
      if (!opts.force) {
        const n = normQ(q)
        if (n === normQ(lastQRef.current.q) && Date.now() - lastQRef.current.t < 15000) return
      }
      lastQRef.current = { q, t: Date.now() }

      const cardId = `a-${Date.now()}-${Math.round(Math.random() * 1e6)}`
      setAnswers((prev) => [
        { id: cardId, question: q, summary: '', script: '', sources: [], loading: true },
        ...prev,
      ])
      try {
        const res = await fetch('/api/cunning/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            question: q,
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
          prev.map((c) => (c.id === cardId ? { ...c, summary: '⚠️ ' + e.message, script: '', loading: false } : c))
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
        // 直前と同一/内包の文字起こしは重複として除去
        if (text === lastLineRef.current || (lastLineRef.current && lastLineRef.current.includes(text))) return
        lastLineRef.current = text
        setLines((prev) => [...prev.slice(-80), { id: `l-${Date.now()}-${prev.length}`, text }])
        recentRef.current.push(text)
        if (looksLikeQuestion(text)) requestAnswer(text)
      } catch {
        /* 1チャンクの失敗は無視して継続 */
      }
    },
    [sessionId, requestAnswer]
  )

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
      // 窓のピーク音量を確定してからリセット（startCycleより前に読む）
      const peak = peakRef.current
      peakRef.current = 0
      if (runningRef.current) startCycle() // 次の窓をすぐ開始（取りこぼし最小化）
      const blob = new Blob(parts, { type: mimeRef.current })
      // 音量モニタが有効で無音だった窓は送らない（幻聴・無駄なAPI回避）
      if (audioCtxRef.current && peak < SILENCE_PEAK) return
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
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      streamRef.current = display
      const audioTracks = display.getAudioTracks()
      if (audioTracks.length === 0) {
        stopAll()
        toast.error('音声が共有されていません。共有ダイアログで「タブの音声を共有」にチェックしてください')
        return
      }
      if (videoRef.current) {
        videoRef.current.srcObject = display
        videoRef.current.play().catch(() => {})
      }
      audioStreamRef.current = new MediaStream(audioTracks)

      // 音量モニタ（無音チャンクを送らず、Whisperの無音幻聴を防ぐ）
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
        const ctx: AudioContext = new Ctx()
        audioCtxRef.current = ctx
        const src = ctx.createMediaStreamSource(audioStreamRef.current)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        src.connect(analyser)
        const data = new Uint8Array(analyser.fftSize)
        levelTimerRef.current = setInterval(() => {
          analyser.getByteTimeDomainData(data)
          let dev = 0
          for (let i = 0; i < data.length; i++) {
            const d = Math.abs(data[i] - 128)
            if (d > dev) dev = d
          }
          if (dev > peakRef.current) peakRef.current = dev
        }, 120)
      } catch {
        /* AudioContext不可でもチャンク送信は継続（ゲートなし） */
      }

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
    } catch {
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

  // ピクチャーインピクチャ（別ウィンドウのカンペ）。会議の脇に常に手前で置ける。
  const openPip = async () => {
    const dpip = (window as any).documentPictureInPicture
    if (!dpip?.requestWindow) {
      toast.error('このブラウザはPiPに未対応です（Chrome/Edge 116+で利用可）')
      return
    }
    try {
      const w: Window = await dpip.requestWindow({ width: 440, height: 260 })
      w.document.body.style.margin = '0'
      w.document.body.style.background = '#0f172a'
      w.document.body.style.fontFamily = 'system-ui, sans-serif'
      w.addEventListener('pagehide', () => setPipWindow(null))
      setPipWindow(w)
    } catch {
      toast.error('PiPウィンドウを開けませんでした')
    }
  }

  const manualAsk = () => {
    const q = manualQ.trim()
    if (!q) return
    setManualQ('')
    requestAnswer(q, { force: true })
  }

  const copyText = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t)
      toast.success('コピーしました')
    } catch {
      toast.error('コピーできませんでした')
    }
  }
  const copyAnswer = (a: AnswerCard) => copyText(a.script || a.summary)

  const loadPrep = async () => {
    setShowPrep(true)
    setPrepLoading(true)
    try {
      const res = await fetch('/api/cunning/prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '生成に失敗しました')
      setPrep(d.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setPrepLoading(false)
    }
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  const latest = answers[0]

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
            <span className="text-sm font-mono font-bold text-slate-500">
              {mm}:{ss}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={pipWindow ? () => pipWindow.close() : openPip}
            title="カンペを別ウィンドウで前面表示"
            className={`px-3 py-2.5 rounded-full font-black text-sm transition-all ${
              pipWindow ? 'bg-[#7f19e6] text-white' : 'bg-white text-[#7f19e6] shadow-sm hover:shadow'
            }`}
          >
            <span className="material-symbols-outlined align-middle text-lg">picture_in_picture_alt</span>
          </button>
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
      </div>

      <p className="text-xs font-bold text-slate-400 mb-3">{statusMsg}</p>

      {/* 手動で質問（音声が拾えない時/任意の質問） */}
      <div className="flex gap-2 mb-4">
        <input
          value={manualQ}
          onChange={(e) => setManualQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && manualAsk()}
          placeholder="質問を手入力してカンペを出す（例: 料金プランは？）"
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-sm"
        />
        <button
          onClick={manualAsk}
          className="px-4 py-2.5 rounded-xl bg-[#7f19e6] text-white font-black text-sm whitespace-nowrap"
        >
          質問する
        </button>
      </div>

      {/* 想定問答の事前準備 */}
      <div className="mb-4">
        <button
          onClick={prep.length === 0 && !showPrep ? loadPrep : () => setShowPrep((v) => !v)}
          className="flex items-center gap-2 text-sm font-black text-[#7f19e6]"
        >
          <span className="material-symbols-outlined text-lg">lightbulb</span>
          想定問答を準備
          {prep.length > 0 && (
            <span className="material-symbols-outlined text-base">{showPrep ? 'expand_less' : 'expand_more'}</span>
          )}
        </button>
        {showPrep && (
          <div className="mt-2 space-y-2">
            {prepLoading ? (
              <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                相手が聞いてきそうな質問を準備中…
              </div>
            ) : prep.length === 0 ? (
              <p className="text-slate-400 font-bold text-sm">想定問答がありません</p>
            ) : (
              <>
                <div className="flex justify-end">
                  <button onClick={loadPrep} className="text-xs font-black text-slate-400 hover:text-[#7f19e6]">
                    再生成
                  </button>
                </div>
                {prep.map((p, i) => (
                  <div key={i} className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                    <p className="text-xs font-black text-[#7f19e6] mb-1">Q. {p.question}</p>
                    <p className="text-sm font-black text-slate-800">{p.summary}</p>
                    {p.script && <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">{p.script}</p>}
                    <div className="mt-2 flex gap-3">
                      <button
                        onClick={() => copyText(p.script || p.summary)}
                        className="text-[11px] font-black text-slate-500 hover:text-[#7f19e6]"
                      >
                        コピー
                      </button>
                      <button
                        onClick={() => requestAnswer(p.question, { force: true })}
                        className="text-[11px] font-black text-slate-500 hover:text-[#7f19e6]"
                      >
                        この質問で回答
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* 映像 + カンペオーバーレイ */}
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
            {latest && (
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

        {/* 回答履歴 */}
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
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => copyAnswer(a)}
                        className="text-xs font-black text-slate-500 hover:text-[#7f19e6] flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">content_copy</span>コピー
                      </button>
                      <button
                        onClick={() => requestAnswer(a.question, { force: true })}
                        className="text-xs font-black text-slate-500 hover:text-[#7f19e6] flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span>もう一度
                      </button>
                      {a.model && <span className="ml-auto text-[10px] text-slate-300 font-bold">{a.model}</span>}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* PiP（別ウィンドウ）カンペ — インラインstyleで確実に描画 */}
      {pipWindow &&
        createPortal(
          <div style={{ padding: 16, color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
            {latest ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#e879f9', marginBottom: 6 }}>
                  💬 {latest.question}
                </div>
                {latest.loading ? (
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>カンペ生成中…</div>
                ) : (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.3 }}>{latest.summary}</div>
                    {latest.script && (
                      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 8, lineHeight: 1.6 }}>
                        {latest.script}
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                質問を検出するとここにカンペが出ます
              </div>
            )}
          </div>,
          pipWindow.document.body
        )}
    </div>
  )
}
