'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { looksLikeQuestion } from '@/lib/cunning/classify'
import { getMode } from '@/lib/cunning/modes'
import type { CunningMode } from '@/lib/cunning/types'

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
  speaker: 'remote' | 'self'
}
interface CunningReport {
  title: string
  summary: string
  decisions: string[]
  todos: string[]
  score: number
  scoreLabel: string
  feedback: string
  good: string[]
  improve: string[]
}

// 1チャンクの録音窓（ミリ秒）。短いほど反応が速く、無音ポーズ(=発話の区切れ目)も早く検出できる。
const WINDOW_MS = 3500
// 発話の確定（区切れ目）判定：文末/疑問の終端 or バッファ上限
function looksComplete(text: string): boolean {
  return /[。．！？!?…]\s*$/.test(text)
}

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
  const [mode, setMode] = useState<CunningMode>('sales')
  const modeDef = getMode(mode)
  const entertainment = modeDef.category === 'entertainment'
  // 音声ソース: tab=タブ音声(getDisplayMedia) / device=入力デバイス(getUserMedia: 仮想デバイス等)
  const [audioSource, setAudioSource] = useState<'tab' | 'device'>('tab')
  const [devices, setDevices] = useState<{ deviceId: string; label: string }[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [captureKind, setCaptureKind] = useState<'tab' | 'device' | null>(null)
  const [captureSelf, setCaptureSelf] = useState(true) // 自分の声(マイク)も取り込む
  const [report, setReport] = useState<CunningReport | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [focusMode, setFocusMode] = useState(false) // カンペ集中モード（画面を広げて次々表示）

  // 自分の声(マイク)取り込み用
  const selfStreamRef = useRef<MediaStream | null>(null)
  const selfAudioCtxRef = useRef<AudioContext | null>(null)
  const selfPeakRef = useRef(0)
  const selfLevelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const runningRef = useRef(false)
  const mimeRef = useRef('audio/webm')
  const recentRef = useRef<string[]>([]) // 直近の発話（文脈）
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const focusVideoRef = useRef<HTMLVideoElement | null>(null) // 集中モードの相手映像
  const lastLineRef = useRef('') // 直近の文字起こし（重複除去）
  const lastQRef = useRef<{ q: string; t: number }>({ q: '', t: 0 }) // 直近に投げた質問（二重発火ガード）
  const audioCtxRef = useRef<AudioContext | null>(null)
  const peakRef = useRef(0) // 現在の録音窓の音量ピーク（無音チャンク除外用）
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pipWindowRef = useRef<Window | null>(null) // 最新のPiPウィンドウ（アンマウント時に確実に閉じる）
  const remainingSecRef = useRef<number | null>(null) // 当月の残り利用秒（-1/未取得は null=無制限扱い）
  const modeRef = useRef<CunningMode>('sales') // 最新モード（録音ループのクロージャから参照）
  const pendingRef = useRef('') // 集計中の発話（区切れ目で確定して回答）
  const endedRef = useRef(false) // 終了処理の二重起動ガード
  const hasContentRef = useRef(false) // 字幕or回答が1つでもあるか（議事録を出すか判定）
  const elapsedRef = useRef(0) // 最新の経過秒（クロージャから参照）

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
    pendingRef.current = ''
    streamRef.current = null
    audioStreamRef.current = null
    // 自分の声(マイク)側も停止
    selfStreamRef.current?.getTracks().forEach((t) => t.stop())
    if (selfLevelTimerRef.current) clearInterval(selfLevelTimerRef.current)
    selfLevelTimerRef.current = null
    selfAudioCtxRef.current?.close().catch(() => {})
    selfAudioCtxRef.current = null
    selfPeakRef.current = 0
    selfStreamRef.current = null
    setCaptureKind(null)
  }, [])

  // 終了処理の一本化：停止ボタン・画面共有停止・上限オートストップのどれでも
  // 「終了→議事録＋評価」を必ず実行する（共有を先に止めても議事録が出る）。
  const finishSession = useCallback(async () => {
    if (endedRef.current) return
    endedRef.current = true
    stopAll()
    // 集中モード/全画面を閉じてから議事録を出す（モーダルの二重表示を防ぐ）
    setFocusMode(false)
    try {
      if (document.fullscreenElement) document.exitFullscreen?.()
    } catch {
      /* noop */
    }
    setStatusMsg('停止しました')
    await fetch(`/api/cunning/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ end: true, addSeconds: elapsedRef.current % 30 }),
    }).catch(() => {})
    if (!hasContentRef.current) return // 中身が無ければ議事録は出さない
    setReport(null)
    setReportOpen(true)
    setReportLoading(true)
    try {
      const res = await fetch(`/api/cunning/sessions/${sessionId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      })
      const d = await res.json()
      if (res.ok) setReport(d.report)
    } catch {
      /* 失敗時はモーダル内で案内 */
    } finally {
      setReportLoading(false)
    }
  }, [stopAll, sessionId])

  // 字幕/回答の有無・経過秒を ref に同期（クロージャから最新値を参照）
  useEffect(() => {
    hasContentRef.current = lines.length > 0 || answers.length > 0
  }, [lines, answers])
  useEffect(() => {
    elapsedRef.current = elapsed
  }, [elapsed])

  // pipWindow / mode を ref に同期（録音ループ・クリーンアップが最新値を参照できるように）
  useEffect(() => {
    pipWindowRef.current = pipWindow
  }, [pipWindow])
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  // 集中モードの映像に共有ストリームを接続（同じMediaStreamを複数videoで共有可）
  useEffect(() => {
    if (focusMode && focusVideoRef.current && streamRef.current) {
      focusVideoRef.current.srcObject = streamRef.current
      focusVideoRef.current.play().catch(() => {})
    }
  }, [focusMode, running, captureKind])

  // セッションのモードを取得（トリガー挙動・表示の切替）
  useEffect(() => {
    fetch(`/api/cunning/sessions/${sessionId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.session?.mode) {
          setMode(d.session.mode)
          modeRef.current = d.session.mode
        }
      })
      .catch(() => {})
  }, [sessionId])

  // 当月の残り利用時間を取得（セッション中のオートストップ判定用）
  useEffect(() => {
    fetch('/api/cunning/usage', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.remainingMinutes === 'number' && d.remainingMinutes !== -1) {
          remainingSecRef.current = d.remainingMinutes * 60
        }
      })
      .catch(() => {})
  }, [])

  // アンマウント時に停止＋セッション終了＋PiPを閉じる
  useEffect(() => {
    return () => {
      stopAll()
      pipWindowRef.current?.close()
      fetch(`/api/cunning/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ end: true }),
        keepalive: true,
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 経過秒カウント + 30秒ごとに利用時間を加算保存（副作用はupdater外で実行）
  useEffect(() => {
    if (!running) return
    let n = elapsedRef.current
    const t = setInterval(() => {
      n += 1
      setElapsed(n) // 純粋なstate更新のみ
      if (n % 30 === 0) {
        fetch(`/api/cunning/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addSeconds: 30 }),
        }).catch(() => {})
      }
      // 当月の残り利用時間に達したらオートストップ（上限超過の青天井防止）→ 議事録まで出す
      if (remainingSecRef.current != null && n >= remainingSecRef.current) {
        toast.error('今月の利用時間の上限に達しました。プロにアップグレードしてください')
        void finishSession()
      }
    }, 1000)
    return () => clearInterval(t)
  }, [running, sessionId, finishSession])

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

  // 集計中の発話を「ひとまとまりの質問/発話」として確定し、トリガー該当なら回答
  const flushUtterance = useCallback(() => {
    const u = pendingRef.current.trim()
    pendingRef.current = ''
    if (u.length < 4) return
    const anyTrigger = getMode(modeRef.current).trigger === 'any'
    const shouldReply = anyTrigger ? u.length >= 5 : looksLikeQuestion(u)
    if (shouldReply) requestAnswer(u)
  }, [requestAnswer])

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
        if (text === lastLineRef.current) return // 直前と同一の窓は重複除去
        lastLineRef.current = text
        setLines((prev) => [...prev.slice(-80), { id: `l-${Date.now()}-${prev.length}`, text, speaker: 'remote' }])
        recentRef.current.push(text)
        // 窓をまたいだ断片を集計バッファに連結（区切れ目で確定）
        pendingRef.current = (pendingRef.current + ' ' + text).trim()
        // 文末/疑問が完成 or ビジネスで質問成立 or 長すぎ → ポーズを待たず即確定（スピード優先）
        const businessQ = getMode(modeRef.current).trigger !== 'any' && looksLikeQuestion(text)
        if (looksComplete(text) || businessQ || pendingRef.current.length > 200) {
          flushUtterance()
        }
      } catch {
        /* 1チャンクの失敗は無視して継続 */
      }
    },
    [sessionId, flushUtterance]
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
      // 無音窓は送らない（幻聴・無駄なAPI回避）。ただし溜まった発話があれば「区切れ目」とみなし確定。
      if (audioCtxRef.current && peak < SILENCE_PEAK) {
        if (pendingRef.current.trim()) flushUtterance()
        return
      }
      void sendChunk(blob)
    }
    if (!runningRef.current || stream.getTracks().every((t) => t.readyState === 'ended')) return
    rec.start()
    setTimeout(() => {
      if (rec.state !== 'inactive') rec.stop()
    }, WINDOW_MS)
  }, [sendChunk, flushUtterance])

  // 自分(マイク)のチャンク → 文字起こしして字幕に表示（回答トリガーはしない）
  const sendSelfChunk = useCallback(
    async (blob: Blob) => {
      if (blob.size < 1200) return
      try {
        const fd = new FormData()
        fd.append('audio', blob, 'self.webm')
        fd.append('sessionId', sessionId)
        fd.append('speaker', 'self')
        const res = await fetch('/api/cunning/transcribe', { method: 'POST', body: fd })
        const d = await res.json()
        if (!res.ok) return
        const text = (d.text || '').trim()
        if (!text) return
        setLines((prev) => [...prev.slice(-80), { id: `s-${Date.now()}-${prev.length}`, text, speaker: 'self' }])
      } catch {
        /* 失敗は無視 */
      }
    },
    [sessionId]
  )

  // 自分の声の録音ループ（独立した無音ゲート）
  const startSelfCycle = useCallback(() => {
    const stream = selfStreamRef.current
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
      const peak = selfPeakRef.current
      selfPeakRef.current = 0
      if (runningRef.current) startSelfCycle()
      const blob = new Blob(parts, { type: mimeRef.current })
      if (selfAudioCtxRef.current && peak < SILENCE_PEAK) return // 自分が話していない窓は送らない
      void sendSelfChunk(blob)
    }
    if (!runningRef.current || stream.getTracks().every((t) => t.readyState === 'ended')) return
    rec.start()
    setTimeout(() => {
      if (rec.state !== 'inactive') rec.stop()
    }, WINDOW_MS)
  }, [sendSelfChunk])

  // 入力デバイス一覧を取得（ラベル取得のため一度マイク許可が要る）
  const loadDevices = async () => {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true })
      const list = await navigator.mediaDevices.enumerateDevices()
      setDevices(
        list
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || 'マイク' }))
      )
      tmp.getTracks().forEach((t) => t.stop())
    } catch {
      toast.error('入力デバイスを取得できませんでした（マイク許可が必要です）')
    }
  }

  const start = async () => {
    try {
      endedRef.current = false // 新しいセッション開始：終了ガードをリセット
      mimeRef.current = pickMime()
      let endTracks: MediaStreamTrack[] = []

      if (audioSource === 'device') {
        // 入力デバイス取り込み（BlackHole/VB-CABLE等の仮想デバイスを選べばPC全体/アプリ音声も可）
        const s = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        })
        streamRef.current = s
        audioStreamRef.current = s
        if (videoRef.current) videoRef.current.srcObject = null
        endTracks = s.getAudioTracks()
        setCaptureKind('device')
      } else {
        // タブ音声取り込み（getDisplayMedia）。映像も取得してプレビュー表示。
        // Conditional Focus: 共有開始後にフォーカスを共有先タブへ移さず、この画面に留める（Chrome 109+）。
        const controller = (window as any).CaptureController ? new (window as any).CaptureController() : undefined
        const display = await navigator.mediaDevices.getDisplayMedia(
          controller ? ({ video: true, audio: true, controller } as any) : { video: true, audio: true }
        )
        try {
          controller?.setFocusBehavior?.('no-focus-change')
        } catch {
          /* 未対応ブラウザは無視 */
        }
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
        endTracks = [...audioTracks, ...display.getVideoTracks()]
        setCaptureKind('tab')
      }

      // 音量モニタ（無音チャンクを送らず、Whisperの無音幻聴を防ぐ）
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
        const ctx: AudioContext = new Ctx()
        // suspendedのままだとアナライザが無音(128)を返し、無音ゲートで全チャンクが破棄される。
        // 開始はユーザー操作起点なので resume() で確実に running にする。
        if (ctx.state === 'suspended') ctx.resume().catch(() => {})
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

      // 画面共有/デバイスを先に止めても「終了→議事録」を実行する
      const onEnded = () => {
        void finishSession()
      }
      endTracks.forEach((t) => t.addEventListener('ended', onEnded))

      runningRef.current = true
      setRunning(true)
      setStatusMsg(
        entertainment
          ? '解析中…🎧 相手のコメント・発話にどんどん反応するよ！'
          : '解析中…🎧 相手の質問を検出したらカンペをポンッと出すよ！'
      )
      startCycle()

      // 自分の声(マイク)も取り込む（タブ音声モード時のみ。相手=タブ / 自分=マイク で分離）
      if (captureSelf && audioSource === 'tab') {
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
          selfStreamRef.current = mic
          try {
            const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
            const sctx: AudioContext = new Ctx()
            if (sctx.state === 'suspended') sctx.resume().catch(() => {})
            selfAudioCtxRef.current = sctx
            const ssrc = sctx.createMediaStreamSource(mic)
            const sAnalyser = sctx.createAnalyser()
            sAnalyser.fftSize = 2048
            ssrc.connect(sAnalyser)
            const sdata = new Uint8Array(sAnalyser.fftSize)
            selfLevelTimerRef.current = setInterval(() => {
              sAnalyser.getByteTimeDomainData(sdata)
              let dev = 0
              for (let i = 0; i < sdata.length; i++) {
                const d = Math.abs(sdata[i] - 128)
                if (d > dev) dev = d
              }
              if (dev > selfPeakRef.current) selfPeakRef.current = dev
            }, 120)
          } catch {
            /* 自分側の無音ゲート無しでも継続 */
          }
          mic.getAudioTracks()[0]?.addEventListener('ended', () => {
            selfStreamRef.current?.getTracks().forEach((t) => t.stop())
            selfStreamRef.current = null
          })
          startSelfCycle()
        } catch {
          toast('自分の声の取り込みはスキップしました（マイク未許可）', { icon: '🎙' })
        }
      }
    } catch (e: any) {
      const name = e?.name || ''
      if (name === 'OverconstrainedError' || name === 'NotFoundError') {
        toast.error('選択した入力デバイスが見つかりません。「更新」で選び直してください')
      } else if (name === 'NotAllowedError') {
        toast.error('マイク/画面共有の許可が必要です')
      } else {
        toast.error('音声の取り込みを開始できませんでした')
      }
      stopAll()
    }
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

  // 集中モード：サイドバー等を覆い、ブラウザの全画面APIで画面いっぱいに広げる
  const enterFocus = () => {
    setFocusMode(true)
    try {
      ;(document.documentElement.requestFullscreen?.() as Promise<void> | undefined)?.catch(() => {})
    } catch {
      /* 全画面不可でもオーバーレイで広がる */
    }
  }
  const exitFocus = () => {
    setFocusMode(false)
    try {
      if (document.fullscreenElement) document.exitFullscreen?.()
    } catch {
      /* noop */
    }
  }
  // ブラウザの全画面が解除（Esc等）されたら集中モードも閉じる
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setFocusMode(false)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

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
            <span className="ml-1 inline-flex items-center gap-1 text-xs font-black text-[#0B5CFF] bg-blue-50 rounded-full px-2.5 py-1">
              {modeDef.icon} {modeDef.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={enterFocus}
            title="集中モード（画面いっぱいにカンペを大きく表示）"
            className="px-3 py-2.5 rounded-full font-black text-sm bg-white text-[#0B5CFF] shadow-sm hover:shadow transition-all"
          >
            <span className="material-symbols-outlined align-middle text-lg">open_in_full</span>
          </button>
          <button
            onClick={pipWindow ? () => pipWindow.close() : openPip}
            title="カンペを別ウィンドウで前面表示"
            className={`px-3 py-2.5 rounded-full font-black text-sm transition-all ${
              pipWindow ? 'bg-[#0B5CFF] text-white' : 'bg-white text-[#0B5CFF] shadow-sm hover:shadow'
            }`}
          >
            <span className="material-symbols-outlined align-middle text-lg">picture_in_picture_alt</span>
          </button>
          {running && (
            <button
              onClick={finishSession}
              className="px-5 py-2.5 rounded-full bg-red-500 text-white font-black text-sm shadow-md shadow-red-500/30 hover:bg-red-600 transition-all flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-lg">stop_circle</span>
              終了して議事録
            </button>
          )}
        </div>
      </div>

      <p className="text-xs font-bold text-slate-400 mb-3">{statusMsg}</p>

      {/* このモードで「何にどう答えるか」を明示（薄い青＝ボタンと色で区別） */}
      <div className="mb-4 flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <span className="text-3xl leading-none">{modeDef.icon}</span>
        <div className="min-w-0">
          <p className="font-black text-sm text-[#0B5CFF]">
            {modeDef.label}｜<span className="text-slate-600">何にどう答える？</span>
          </p>
          <p className="text-xs font-bold text-slate-600 mt-1 leading-relaxed">{modeDef.guide}</p>
          <p className="text-[11px] font-bold text-slate-400 mt-1">
            → 「{modeDef.inputLabel}」を検出すると、下に<strong className="text-[#0B5CFF]">そのまま言えるカンペ</strong>が出ます
          </p>
        </div>
      </div>

      {/* 音声ソース選択 */}
      {!running && (
        <div className="mb-4 bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-black text-slate-500 mb-2">音声ソース</p>
          <div className="flex gap-2">
            <button
              onClick={() => setAudioSource('tab')}
              className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-black border-2 transition-all ${
                audioSource === 'tab' ? 'border-[#0B5CFF] bg-blue-50 text-[#0B5CFF]' : 'border-slate-200 text-slate-500'
              }`}
            >
              🌐 タブ音声（推奨）
            </button>
            <button
              onClick={() => {
                setAudioSource('device')
                if (devices.length === 0) loadDevices()
              }}
              className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-black border-2 transition-all ${
                audioSource === 'device' ? 'border-[#0B5CFF] bg-blue-50 text-[#0B5CFF]' : 'border-slate-200 text-slate-500'
              }`}
            >
              🎙 入力デバイス
            </button>
          </div>
          {audioSource === 'tab' && (
            <label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={captureSelf}
                onChange={(e) => setCaptureSelf(e.target.checked)}
                className="w-4 h-4 accent-[#0B5CFF]"
              />
              🎙 自分の声（マイク）も取り込んで字幕・議事録に反映する
            </label>
          )}
          {audioSource === 'device' && (
            <div className="mt-3">
              <div className="flex gap-2">
                <select
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 font-bold text-sm text-slate-700"
                >
                  <option value="">既定の入力デバイス</option>
                  {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                  ))}
                </select>
                <button onClick={loadDevices} className="px-3 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-black text-sm">
                  更新
                </button>
              </div>
              <p className="text-[11px] text-slate-400 font-bold mt-2 leading-relaxed">
                Zoom等の<strong>アプリ音声やPC全体</strong>を取り込むには、仮想オーディオデバイス（Mac: BlackHole / Win: VB-CABLE）を導入し、
                PCの出力をそれに流して、ここでそのデバイスを選んでください。
              </p>
            </div>
          )}
        </div>
      )}

      {/* 初回オンボーディング（音声共有の躓き対策） */}
      {!running && audioSource === 'tab' && (
        <div className="mb-4 bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="font-black text-[#0B5CFF] text-sm mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-base">tips_and_updates</span>使い方（重要）
          </p>
          <ol className="text-xs font-bold text-slate-600 space-y-1 list-decimal list-inside leading-relaxed">
            <li>
              {entertainment ? '配信/動画（YouTube等）' : '会議（Meet / Zoom）'}を
              <strong>ブラウザのタブ</strong>で開く（Chrome / Edge 推奨）
            </li>
            <li>「🎤 ライブ開始」→ 共有ダイアログで<strong>そのタブ</strong>を選択</li>
            <li>
              ダイアログ左下の「<strong>タブの音声も共有</strong>」に必ず<strong>チェック</strong>（これが無いと相手の声を解析できません）
            </li>
            <li>
              {entertainment
                ? '相手のコメント・発話に即レスのカンペが、映像の下とPiPに出ます'
                : '相手の質問を検出すると、映像の下とPiPにカンペが出ます'}
              。自分のマイクは不要です。コメントは手入力でもOK
            </li>
          </ol>
        </div>
      )}

      {/* 手動で質問（音声が拾えない時/任意の質問） */}
      <div className="flex gap-2 mb-4">
        <input
          value={manualQ}
          onChange={(e) => setManualQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && manualAsk()}
          placeholder={modeDef.manualPlaceholder}
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-sm"
        />
        <button
          onClick={manualAsk}
          className="px-4 py-2.5 rounded-xl bg-[#0B5CFF] text-white font-black text-sm whitespace-nowrap"
        >
          質問する
        </button>
      </div>

      {/* 想定問答の事前準備 */}
      <div className="mb-4">
        <button
          onClick={prep.length === 0 && !showPrep ? loadPrep : () => setShowPrep((v) => !v)}
          className="flex items-center gap-2 text-sm font-black text-[#0B5CFF]"
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
                  <button onClick={loadPrep} className="text-xs font-black text-slate-400 hover:text-[#0B5CFF]">
                    再生成
                  </button>
                </div>
                {prep.map((p, i) => (
                  <div key={i} className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                    <p className="text-xs font-black text-[#0B5CFF] mb-1">Q. {p.question}</p>
                    <p className="text-sm font-black text-slate-800">{p.summary}</p>
                    {p.script && <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">{p.script}</p>}
                    <div className="mt-2 flex gap-3">
                      <button
                        onClick={() => copyText(p.script || p.summary)}
                        className="text-[11px] font-black text-slate-500 hover:text-[#0B5CFF]"
                      >
                        コピー
                      </button>
                      <button
                        onClick={() => requestAnswer(p.question, { force: true })}
                        className="text-[11px] font-black text-slate-500 hover:text-[#0B5CFF]"
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-4">
        {/* 映像 + カンペオーバーレイ */}
        <div className="order-1 space-y-3">
          <div className="relative bg-slate-900 rounded-2xl overflow-hidden aspect-video shadow-lg">
            <video ref={videoRef} muted playsInline autoPlay className="w-full h-full object-contain" />
            {!running && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 gap-3 px-4">
                <img src={`/character/${modeDef.character}.png`} alt="" className="w-20 h-20 object-contain drop-shadow-lg" />
                <p className="font-bold text-xs text-center text-white/70 max-w-sm">
                  {modeDef.icon} {modeDef.label}・準備OK！下のボタンで
                  {audioSource === 'device' ? '入力デバイスから取り込み開始' : '会議/配信タブを共有して開始'}
                </p>
                {/* 開始ボタンを中央に・緑で目立たせる（青のガイド/モードチップと色で区別） */}
                <button
                  onClick={start}
                  className="mt-1 px-8 py-4 rounded-full bg-gradient-to-r from-emerald-400 to-green-500 text-white font-black text-xl shadow-xl shadow-green-500/30 hover:scale-[1.03] transition-transform flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-3xl">play_circle</span>
                  🎤 ライブ開始
                </button>
              </div>
            )}
            {running && captureKind === 'device' && !latest && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/85 gap-2">
                <img src={`/character/${modeDef.character}.png`} alt="" className="w-24 h-24 object-contain drop-shadow-lg" />
                <div className="flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-4 py-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <p className="font-black text-sm">🎙 入力デバイスから音声取り込み中…</p>
                </div>
              </div>
            )}
            {latest && (
              <div className="absolute left-0 right-0 bottom-0 p-3 sm:p-5 bg-gradient-to-t from-black/95 via-black/85 to-transparent max-h-[70%] overflow-y-auto">
                <p className="text-[11px] font-black text-sky-300 mb-1">💬 {latest.question}</p>
                {latest.loading ? (
                  <p className="text-white/85 font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                    カンペ生成中…
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] font-black text-sky-300 mb-0.5">👇 これを言おう</p>
                    <p className="text-white font-black text-lg sm:text-2xl leading-snug">{latest.summary}</p>
                    {latest.script && (
                      <p className="text-white/90 text-sm sm:text-lg font-medium mt-1.5 leading-relaxed whitespace-pre-wrap">
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
              <span>会話の字幕（🟦自分 / ⬜相手）</span>
              <span className="material-symbols-outlined text-base">{showSubs ? 'expand_less' : 'expand_more'}</span>
            </button>
            {showSubs && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {lines.length === 0 ? (
                  <p className="text-slate-500 text-sm font-bold">音声待機中…</p>
                ) : (
                  lines.map((l) => (
                    <div key={l.id} className={`flex ${l.speaker === 'self' ? 'justify-end' : 'justify-start'}`}>
                      <p
                        className={`text-sm leading-relaxed rounded-lg px-2.5 py-1 max-w-[85%] ${
                          l.speaker === 'self' ? 'bg-[#0B5CFF] text-white' : 'bg-white/10 text-white/90'
                        }`}
                      >
                        {l.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* 回答履歴 */}
        <div className="order-2 space-y-3 lg:max-h-[82vh] lg:overflow-y-auto lg:pr-1">
          <div className="flex items-center justify-between sticky top-0 bg-slate-50/90 backdrop-blur py-1 z-10">
            <p className="text-sm font-black text-slate-700">カンペ履歴</p>
            {answers.length > 0 && <span className="text-xs font-bold text-slate-400">{answers.length}件</span>}
          </div>
          {answers.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-slate-400">
              <img src="/character/thinking.png" alt="" className="w-16 h-16 object-contain mx-auto mb-2" />
              <p className="font-bold text-sm">
                {entertainment ? '相手のコメント待ち…！何か来たら全力で返すよ🔥' : '相手が話したらカンペをポンッと出すよ！スタンバイOK👀'}
              </p>
            </div>
          ) : (
            answers.map((a) => {
              const isLatest = a.id === latest?.id
              return (
                <div
                  key={a.id}
                  className={`bg-white rounded-2xl p-4 border-l-4 transition-all ${
                    isLatest ? 'border-[#0B5CFF] ring-2 ring-blue-200 shadow-md' : 'border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    {isLatest && (
                      <span className="text-[10px] font-black text-white bg-red-500 rounded px-1.5 py-0.5">最新</span>
                    )}
                    <p className="text-[11px] font-bold text-slate-400 flex-1 min-w-0">
                      {modeDef.inputLabel}: {a.question}
                    </p>
                  </div>
                  {a.loading ? (
                    <div className="flex items-center gap-2 text-slate-500 font-bold py-2">
                      <img src="/character/working.png" alt="" className="w-7 h-7 object-contain animate-bounce" />
                      カンペ生成中…
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <span className="mt-1 text-[10px] font-black text-white bg-[#0B5CFF] rounded px-1.5 py-0.5 flex-shrink-0">
                          要点
                        </span>
                        <p className="text-lg font-black text-slate-900 leading-snug flex-1">{a.summary}</p>
                      </div>
                      {a.script && (
                        <div className="mt-3 bg-blue-50 rounded-xl p-2.5">
                          <p className="text-[10px] font-black text-[#0B5CFF] mb-1">👉 そのまま言えばOK</p>
                          <p className="text-sm text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                            {a.script}
                          </p>
                        </div>
                      )}
                      {a.sources.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {a.sources.map((s, i) => (
                            <span key={i} className="text-[11px] font-bold text-[#0B5CFF] bg-blue-50 rounded-full px-2.5 py-1">
                              {s.label}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-2.5">
                        <button
                          onClick={() => copyAnswer(a)}
                          className="text-xs font-black text-slate-500 hover:text-[#0B5CFF] flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">content_copy</span>コピー
                        </button>
                        <button
                          onClick={() => requestAnswer(a.question, { force: true })}
                          className="text-xs font-black text-slate-500 hover:text-[#0B5CFF] flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">refresh</span>もう一度
                        </button>
                        {a.model && <span className="ml-auto text-[10px] text-slate-300 font-bold">{a.model}</span>}
                      </div>
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* PiP（別ウィンドウ）カンペ — インラインstyleで確実に描画 */}
      {pipWindow &&
        createPortal(
          <div style={{ padding: 16, color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
            {latest ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#7CC4FF', marginBottom: 6 }}>
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

      {/* コンプライアンス注記（録音同意・法令順守はユーザー責任 / 回答案であり発話判断はユーザー） */}
      <p className="mt-6 text-[11px] text-slate-400 font-medium leading-relaxed">
        ※ 相手の音声取得・録音に関する同意取得、各Web会議サービスの規約・適用法令の順守はご利用者の責任で行ってください。
        本ツールは回答<strong>案</strong>を提示する支援機能であり、実際に発話するかの判断はご自身で行ってください。
        音声データは文字起こし後に保存しません。
      </p>

      {/* カンペ集中モード（画面いっぱいに想定問答を次々特大表示） */}
      {focusMode && (
        <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col">
          {/* バー */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-white">
              {running && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
              <span className="font-black">{modeDef.icon} {modeDef.label}</span>
              <span className="text-sm font-mono font-bold text-white/60">{mm}:{ss}</span>
              <span className="ml-2 text-xs font-bold text-white/50 hidden sm:inline">相手の発言にカンペが次々出ます</span>
            </div>
            <div className="flex items-center gap-2">
              {running ? (
                <button
                  onClick={finishSession}
                  className="px-4 py-2 rounded-full bg-red-500 text-white font-black text-sm flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-lg">stop_circle</span>終了
                </button>
              ) : (
                <button
                  onClick={start}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-[#2D8CFF] to-[#0B5CFF] text-white font-black text-sm"
                >
                  🎤 ライブ開始
                </button>
              )}
              <button
                onClick={exitFocus}
                title="集中モードを終了"
                className="px-3 py-2 rounded-full bg-white/10 text-white font-black text-sm"
              >
                <span className="material-symbols-outlined align-middle text-lg">close_fullscreen</span>
              </button>
            </div>
          </div>

          {/* Zoom風: 左=相手の映像（＋下にデカカンペ） / 右=カンペ履歴 */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* 左: 相手の映像 */}
            <div className="relative flex-1 bg-black flex items-center justify-center min-h-0">
              <video ref={focusVideoRef} muted playsInline autoPlay className="w-full h-full object-contain" />
              {(!running || captureKind === 'device') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-2">
                  <img src={`/character/${modeDef.character}.png`} alt="" className="w-24 h-24 object-contain" />
                  <p className="font-bold text-sm">
                    {!running ? 'ライブ開始で相手の画面が映ります' : '音声のみ取り込み中（映像なし）'}
                  </p>
                </div>
              )}
              {/* 最新カンペを映像下にデカ表示（顔を見ながら読める） */}
              {latest && (
                <div className="absolute left-0 right-0 bottom-0 p-4 sm:p-6 bg-gradient-to-t from-black/95 via-black/85 to-transparent max-h-[60%] overflow-y-auto">
                  <p className="text-xs font-black text-sky-300 mb-1">💬 {latest.question}</p>
                  {latest.loading ? (
                    <p className="text-white/85 font-black text-xl flex items-center gap-2">
                      <span className="material-symbols-outlined animate-spin">progress_activity</span>カンペ生成中…
                    </p>
                  ) : (
                    <>
                      <p className="text-white font-black text-3xl sm:text-5xl leading-tight">{latest.summary}</p>
                      {latest.script && (
                        <p className="text-white/90 font-bold text-lg sm:text-2xl leading-relaxed whitespace-pre-wrap mt-2">
                          👉 {latest.script}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 右: カンペ履歴＋手動入力 */}
            <div className="w-full lg:w-[400px] flex flex-col bg-slate-800 border-t lg:border-t-0 lg:border-l border-white/10 min-h-0">
              <p className="px-4 pt-3 pb-1 text-xs font-black text-white/50 flex-shrink-0">カンペ履歴</p>
              <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-2 min-h-0">
                {answers.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/50 gap-2 py-8">
                    <img src="/character/thinking.png" alt="" className="w-14 h-14 object-contain" />
                    <p className="font-bold text-sm text-center px-4">相手が話すとカンペが出るよ</p>
                  </div>
                ) : (
                  answers.map((a) => {
                    const isLatest = a.id === latest?.id
                    return (
                      <div key={a.id} className={`rounded-xl p-3 ${isLatest ? 'bg-white ring-2 ring-[#2D8CFF]' : 'bg-white/85'}`}>
                        <p className="text-[11px] font-bold text-slate-500 mb-1">
                          {isLatest && <span className="text-[10px] font-black text-white bg-red-500 rounded px-1.5 py-0.5 mr-1">最新</span>}
                          {a.question}
                        </p>
                        {a.loading ? (
                          <p className="text-slate-500 font-black text-sm py-1">カンペ生成中…</p>
                        ) : (
                          <>
                            <p className="font-black text-slate-900 leading-snug">{a.summary}</p>
                            {a.script && <p className="text-sm text-slate-700 font-medium mt-1 whitespace-pre-wrap">👉 {a.script}</p>}
                          </>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
              <div className="border-t border-white/10 p-3 flex gap-2 flex-shrink-0">
                <input
                  value={manualQ}
                  onChange={(e) => setManualQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && manualAsk()}
                  placeholder={modeDef.manualPlaceholder}
                  className="flex-1 min-w-0 rounded-xl px-3 py-2.5 font-bold text-sm bg-white/10 text-white placeholder:text-white/40 border border-white/10"
                />
                <button onClick={manualAsk} className="px-3 py-2.5 rounded-xl bg-[#0B5CFF] text-white font-black text-sm whitespace-nowrap">
                  質問
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 終了時の議事録＋評価モーダル（派手な演出） */}
      {reportOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          {/* キラキラ */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {['🎉', '✨', '🎊', '⭐', '🎉', '✨'].map((e, i) => (
              <span
                key={i}
                className="absolute text-3xl animate-bounce"
                style={{ left: `${10 + i * 15}%`, top: `${8 + (i % 3) * 10}%`, animationDelay: `${i * 0.15}s` }}
              >
                {e}
              </span>
            ))}
          </div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto animate-[fadeIn_.3s_ease]">
            <div className="p-6">
              <div className="flex flex-col items-center text-center">
                <img
                  src={`/character/${reportLoading ? 'working' : 'success'}.png`}
                  alt=""
                  className="w-20 h-20 object-contain animate-bounce"
                />
                <h2 className="text-xl font-black text-slate-900 mt-2">
                  {reportLoading ? '議事録を作成中…' : 'おつかれさま！議事録ができたよ'}
                </h2>
              </div>

              {reportLoading ? (
                <p className="text-center text-slate-400 font-bold text-sm mt-4">
                  会話を振り返って要約・評価しています…
                </p>
              ) : report ? (
                <div className="mt-5 space-y-4">
                  {/* スコア（でかく） */}
                  <div className="rounded-2xl bg-gradient-to-br from-[#2D8CFF] to-[#0B5CFF] text-white p-5 text-center shadow-lg shadow-blue-500/30">
                    <p className="text-xs font-black opacity-90">{report.scoreLabel}</p>
                    <p className="text-5xl font-black leading-none mt-1 animate-[fadeIn_.5s_ease]">
                      {report.score}
                      <span className="text-2xl">点</span>
                    </p>
                    {report.feedback && <p className="text-sm font-bold mt-2 opacity-95">{report.feedback}</p>}
                  </div>

                  {report.summary && (
                    <div>
                      <p className="text-xs font-black text-slate-400 mb-1">議事録（要約）</p>
                      <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                        {report.summary}
                      </p>
                    </div>
                  )}

                  {report.decisions.length > 0 && (
                    <div>
                      <p className="text-xs font-black text-slate-400 mb-1">決定事項</p>
                      <ul className="text-sm text-slate-700 font-medium list-disc list-inside space-y-0.5">
                        {report.decisions.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    </div>
                  )}
                  {report.todos.length > 0 && (
                    <div>
                      <p className="text-xs font-black text-slate-400 mb-1">ネクストアクション</p>
                      <ul className="text-sm text-slate-700 font-medium space-y-0.5">
                        {report.todos.map((d, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-[#0B5CFF]">✓</span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {report.good.length > 0 && (
                      <div className="bg-green-50 rounded-xl p-3">
                        <p className="text-xs font-black text-green-600 mb-1">👍 良かった点</p>
                        <ul className="text-xs text-slate-600 font-bold space-y-0.5 list-disc list-inside">
                          {report.good.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    )}
                    {report.improve.length > 0 && (
                      <div className="bg-amber-50 rounded-xl p-3">
                        <p className="text-xs font-black text-amber-600 mb-1">💡 改善点</p>
                        <ul className="text-xs text-slate-600 font-bold space-y-0.5 list-disc list-inside">
                          {report.improve.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-center text-slate-400 font-bold text-sm mt-4">議事録の生成に失敗しました</p>
              )}

              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setReportOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-black"
                >
                  閉じる
                </button>
                <Link
                  href="/cunning/history"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#2D8CFF] to-[#0B5CFF] text-white font-black text-center"
                >
                  履歴で見る
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
