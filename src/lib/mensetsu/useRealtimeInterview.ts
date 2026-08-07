'use client'

// ============================================
// ドヤ面接官 Realtime接続フック（クライアント）
// ============================================
// ブラウザ ──WebRTC──▶ OpenAI Realtime API（音声は直結）
//      ▲
//      └ サーバは ephemeral token の発行と進行判断のみ
//
// なぜ直結か: Vercel Serverless は WebSocket を長時間保持できない。
// 音声をサーバ中継する構成は成立しないため、ブラウザから直接つなぐ。
import { useCallback, useEffect, useRef, useState } from 'react'

export interface TranscriptLine {
  speaker: 'interviewer' | 'candidate'
  text: string
  at: number
}

export type ConnState = 'idle' | 'requesting_mic' | 'connecting' | 'live' | 'ended' | 'error'

interface UseRealtimeInterviewOptions {
  token: string
  onEnded?: () => void
  /** 組織設定で音声保存が有効なときだけ true。同意していない録音は作らない。 */
  recordAudio?: boolean
}

export function useRealtimeInterview({ token, onEnded, recordAudio = false }: UseRealtimeInterviewOptions) {
  const [state, setState] = useState<ConnState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const [level, setLevel] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [durationMin, setDurationMin] = useState(20)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const micRef = useRef<MediaStream | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)
  const pendingRef = useRef<TranscriptLine[]>([])
  const endedRef = useRef(false)
  // 録音（組織設定が有効なときのみ）
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mixCtxRef = useRef<AudioContext | null>(null)

  /** 逐語ログはまとめてサーバへ送る（1発話ごとに叩かない） */
  const flushTurns = useCallback(async () => {
    const batch = pendingRef.current
    if (batch.length === 0) return
    pendingRef.current = []
    try {
      await fetch(`/api/mensetsu/live/${token}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turns: batch.map((l) => ({
            speaker: l.speaker,
            text: l.text,
            startMs: l.at - startedAtRef.current,
          })),
        }),
      })
    } catch {
      // 送信失敗は面接を止めない。次のflushでまとめて再送されないため取りこぼすが、
      // 面接継続を優先する（ログ欠落 < 面接中断）。
    }
  }, [token])

  const pushLine = useCallback((speaker: TranscriptLine['speaker'], text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const line: TranscriptLine = { speaker, text: trimmed, at: Date.now() }
    setLines((prev) => [...prev, line])
    pendingRef.current.push(line)
  }, [])

  /**
   * 録音をアップロードする。
   * ブラウザ → Supabase へ直接送る（サーバ経由だと Vercel の本文上限4.5MBに当たり、
   * 長い面接ほど失敗する）。失敗しても面接の完了自体は妨げない。
   */
  const uploadRecording = useCallback(async () => {
    const chunks = chunksRef.current
    chunksRef.current = []
    if (chunks.length === 0) return
    try {
      const blob = new Blob(chunks, { type: 'audio/webm' })
      const res = await fetch(`/api/mensetsu/live/${token}/recording`, { method: 'POST' })
      if (!res.ok) return
      const { signedUrl } = await res.json()
      if (!signedUrl) return
      const put = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/webm' },
        body: blob,
      })
      if (!put.ok) return
      await fetch(`/api/mensetsu/live/${token}/recording`, { method: 'PATCH' })
    } catch {
      // 録音の保存に失敗しても、逐語ログと評価は成立する。面接を止めない。
    }
  }, [token])

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    try {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    } catch {}
    recorderRef.current = null
    try {
      mixCtxRef.current?.close()
    } catch {}
    mixCtxRef.current = null
    try {
      dcRef.current?.close()
    } catch {}
    try {
      pcRef.current?.close()
    } catch {}
    micRef.current?.getTracks().forEach((t) => t.stop())
    try {
      audioCtxRef.current?.close()
    } catch {}
    dcRef.current = null
    pcRef.current = null
    micRef.current = null
    audioCtxRef.current = null
  }, [])

  const end = useCallback(
    async (aborted = false) => {
      if (endedRef.current) return
      endedRef.current = true
      // stop() は非同期に最後の dataavailable を発火させるため、cleanup 前に少し待つ
      const rec = recorderRef.current
      if (rec && rec.state === 'recording') {
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve()
          try {
            rec.stop()
          } catch {
            resolve()
          }
          setTimeout(resolve, 2000)
        })
      }
      cleanup()
      await flushTurns()
      if (recordAudio) await uploadRecording()
      try {
        await fetch(`/api/mensetsu/live/${token}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aborted }),
        })
      } catch {}
      setState('ended')
      onEnded?.()
    },
    [cleanup, flushTurns, onEnded, recordAudio, token, uploadRecording]
  )

  /** Realtime からの function call を受けてサーバに進行を問い合わせ、結果を返す */
  const handleFunctionCall = useCallback(
    async (callId: string, argsJson: string) => {
      let intent: 'follow_up' | 'next' = 'next'
      try {
        const parsed = JSON.parse(argsJson || '{}')
        if (parsed?.intent === 'follow_up') intent = 'follow_up'
      } catch {}

      let result: any = { action: 'close', should_close: true }
      try {
        const res = await fetch(`/api/mensetsu/live/${token}/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent }),
        })
        result = await res.json()
      } catch {
        // 進行APIが落ちたら締めに倒す（無限に質問が続くより安全）
      }

      const dc = dcRef.current
      if (!dc || dc.readyState !== 'open') return

      dc.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify(result),
          },
        })
      )
      dc.send(JSON.stringify({ type: 'response.create' }))

      if (result?.should_close) {
        // 締めの発話を終える時間を見てから終了する
        setTimeout(() => void end(false), 12000)
      }
    },
    [end, token]
  )

  const start = useCallback(async () => {
    setError(null)
    endedRef.current = false

    // 1) マイク取得
    setState('requesting_mic')
    let mic: MediaStream
    try {
      mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch {
      setState('error')
      setError('マイクを使用できません。ブラウザのマイク許可をご確認ください。')
      return
    }
    micRef.current = mic

    // 2) 短命トークンを取得
    setState('connecting')
    let clientSecret: string
    let model: string
    try {
      const res = await fetch(`/api/mensetsu/live/${token}/token`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data?.clientSecret) {
        throw new Error(data?.error || '面接を開始できませんでした')
      }
      clientSecret = data.clientSecret
      model = data.model
      if (data.durationMin) setDurationMin(data.durationMin)
    } catch (e: any) {
      cleanup()
      setState('error')
      setError(e?.message || '面接を開始できませんでした')
      return
    }

    // 3) WebRTC 接続
    try {
      const pc = new RTCPeerConnection()
      pcRef.current = pc

      // AIの音声を再生
      const audioEl = new Audio()
      audioEl.autoplay = true
      audioElRef.current = audioEl
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0]
        // 音量エンベロープを取り、アバターの口に反映
        try {
          const ctx = new AudioContext()
          audioCtxRef.current = ctx
          const src = ctx.createMediaStreamSource(e.streams[0])
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 512
          src.connect(analyser)
          const buf = new Uint8Array(analyser.frequencyBinCount)
          const tick = () => {
            analyser.getByteTimeDomainData(buf)
            let sum = 0
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128
              sum += v * v
            }
            setLevel(Math.sqrt(sum / buf.length))
            rafRef.current = requestAnimationFrame(tick)
          }
          tick()
        } catch {
          // 音量解析ができなくても面接は続行できる（口が動かないだけ）
        }

        // --- 録音（組織設定が有効なときだけ）---
        // 応募者のマイクとAIの音声を1本にミックスして録る。片方だけだと後で聞き直せない。
        if (recordAudio && !recorderRef.current && typeof MediaRecorder !== 'undefined') {
          try {
            const mixCtx = new AudioContext()
            mixCtxRef.current = mixCtx
            const dest = mixCtx.createMediaStreamDestination()
            mixCtx.createMediaStreamSource(e.streams[0]).connect(dest) // AI
            if (micRef.current) mixCtx.createMediaStreamSource(micRef.current).connect(dest) // 応募者

            // opus が使えない環境では既定のコーデックに任せる
            const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
              ? 'audio/webm;codecs=opus'
              : undefined
            const rec = new MediaRecorder(dest.stream, {
              ...(mime ? { mimeType: mime } : {}),
              audioBitsPerSecond: 32000, // 20分で約5MB。会話の聞き取りには十分
            })
            rec.ondataavailable = (ev) => {
              if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data)
            }
            rec.start(5000) // 5秒ごとに切り出し、タブが落ちても直前まで残す
            recorderRef.current = rec
          } catch {
            // 録音できなくても面接は成立する（逐語ログと評価は別経路）
          }
        }
      }

      mic.getTracks().forEach((t) => pc.addTrack(t, mic))

      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc

      dc.onmessage = (e) => {
        let ev: any
        try {
          ev = JSON.parse(e.data)
        } catch {
          return
        }
        switch (ev.type) {
          // 応募者の発話が文字起こしされた
          case 'conversation.item.input_audio_transcription.completed':
            pushLine('candidate', ev.transcript || '')
            break
          // AIの発話（テキスト版）が確定
          case 'response.audio_transcript.done':
            pushLine('interviewer', ev.transcript || '')
            break
          case 'input_audio_buffer.speech_started':
            setListening(true)
            break
          case 'input_audio_buffer.speech_stopped':
            setListening(false)
            void flushTurns()
            break
          case 'response.audio.delta':
            setSpeaking(true)
            break
          case 'response.done':
            setSpeaking(false)
            void flushTurns()
            break
          case 'response.function_call_arguments.done':
            void handleFunctionCall(ev.call_id, ev.arguments)
            break
          case 'error':
            console.error('[mensetsu] realtime error', ev)
            break
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpRes = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
        },
      })
      if (!sdpRes.ok) throw new Error('音声接続を確立できませんでした')
      const answer = await sdpRes.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answer })

      startedAtRef.current = Date.now()
      setState('live')

      // 面接官から話し始めてもらう
      setTimeout(() => {
        if (dc.readyState === 'open') {
          dc.send(JSON.stringify({ type: 'response.create' }))
        }
      }, 400)
    } catch (e: any) {
      cleanup()
      setState('error')
      setError(e?.message || '接続に失敗しました')
    }
  }, [cleanup, flushTurns, handleFunctionCall, pushLine, recordAudio, token])

  // 経過時間
  useEffect(() => {
    if (state !== 'live') return
    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [state])

  // 想定時間を大きく超えたら強制終了（費用と体験の保険）
  useEffect(() => {
    if (state !== 'live') return
    if (elapsedSec > durationMin * 60 + 180) void end(false)
  }, [elapsedSec, durationMin, state, end])

  // 離脱時のクリーンアップ
  useEffect(() => () => cleanup(), [cleanup])

  return { state, error, lines, level, speaking, listening, elapsedSec, durationMin, start, end }
}
