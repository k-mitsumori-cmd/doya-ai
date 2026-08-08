'use client'

// ============================================
// ドヤAI商談 Realtime接続フック（クライアント）
// ============================================
// ブラウザ ──WebRTC──▶ OpenAI Realtime API（音声は直結）
//      ▲
//      └ サーバは ephemeral token の発行と進行判断のみ
//
// なぜ直結か: Vercel Serverless は WebSocket を長時間保持できない。
// 音声をサーバ中継する構成は成立しないため、ブラウザから直接つなぐ。
//
// ⚠️ このファイルは mensetsu/useRealtimeInterview.ts で本番の実機テストを通して
//    洗い出した挙動（イベント名の世代交代・ログの取りこぼし・離脱時の誤終了・
//    発話順序の反転）をそのまま引き継いでいる。コメントの警告は消さないこと。
import { useCallback, useEffect, useRef, useState } from 'react'

export interface TranscriptLine {
  speaker: 'ai' | 'guest'
  text: string
  at: number
}

export type ConnState = 'idle' | 'requesting_mic' | 'connecting' | 'live' | 'ended' | 'error'

interface UseRealtimeMeetingOptions {
  roomToken: string
  sessionId: string
  onEnded?: () => void
  /** マイクを使わずテキストだけで進める（マイク不許可時の自動フォールバック用） */
  textOnly?: boolean
}

export function useRealtimeMeeting({ roomToken, sessionId, onEnded, textOnly = false }: UseRealtimeMeetingOptions) {
  const [state, setState] = useState<ConnState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const [level, setLevel] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [durationMin, setDurationMin] = useState(15)
  // 画面に出す進行状況。/advance の戻り値で更新する
  const [phaseName, setPhaseName] = useState<string | null>(null)
  const [remainingRequired, setRemainingRequired] = useState<string[]>([])

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const micRef = useRef<MediaStream | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)
  const pendingRef = useRef<TranscriptLine[]>([])
  const endedRef = useRef(false)

  const api = useCallback((path: string) => `/api/aishodan/room/${roomToken}/${path}`, [roomToken])

  /**
   * 逐語ログはまとめてサーバへ送る（1発話ごとに叩かない）。
   * ⚠️ 送信に失敗したらキューへ戻すこと。失敗時に戻さない実装だと、
   *    一瞬の通信断でその区間の発話が永久に消え、商談ログに穴があく。
   */
  const flushTurns = useCallback(async () => {
    const batch = pendingRef.current
    if (batch.length === 0) return
    pendingRef.current = []
    const requeue = () => {
      // 後から届いた発話より前に並ぶよう、先頭へ戻す
      pendingRef.current = [...batch, ...pendingRef.current]
    }
    try {
      const res = await fetch(api('turn'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          turns: batch.map((l) => ({
            speaker: l.speaker,
            text: l.text,
            startMs: l.at - startedAtRef.current,
          })),
        }),
      })
      if (!res.ok) {
        // 4xx は投げ直しても通らないので捨てる。5xx・通信断は戻して再送。
        if (res.status >= 500) requeue()
        return
      }
      // ⚠️ サーバは1回あたり50件で切り詰める。保存件数を照合せずに成功扱いにすると、
      //    再送で溜まった51件目以降（＝直近の発言）が黙って消える。
      const data = await res.json().catch(() => null)
      const saved = Number(data?.saved)
      if (Number.isFinite(saved) && saved < batch.length) {
        pendingRef.current = [...batch.slice(saved), ...pendingRef.current]
      }
    } catch {
      requeue()
    }
  }, [api, sessionId])

  /** 直近に積んだ発話。transcript イベントと response.done の二重登録を防ぐ */
  const recentRef = useRef<{ key: string; at: number }[]>([])
  /**
   * 各話者の「話し始めた時刻」。
   * ⚠️ 発話は読み上げ／認識が終わって初めて確定するため、確定時刻で並べると
   *    長い発話が後ろにずれる。実際に本番で、AIの長い説明より相手の短い相槌が
   *    先に採番され、ログが会話の順序として読めなくなっていた。
   */
  const speechStartRef = useRef<{ ai: number; guest: number }>({ ai: 0, guest: 0 })

  const pushLine = useCallback((speaker: TranscriptLine['speaker'], text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    // 同じ発話が別イベント経由で二度届くことがある（保険経路との重複）。
    // ⚠️ 件数で判定すると「はい」「なるほど」のような短い相槌が2回目以降まるごと
    //    消える。重複は必ず数百ms以内に届くので、5秒の時間窓に限定する。
    const key = `${speaker}:${trimmed}`
    const nowMs = Date.now()
    recentRef.current = recentRef.current.filter((r) => nowMs - r.at < 5000)
    if (recentRef.current.some((r) => r.key === key)) return
    recentRef.current.push({ key, at: nowMs })

    const startedAt = speechStartRef.current[speaker] || Date.now()
    speechStartRef.current[speaker] = 0
    const line: TranscriptLine = { speaker, text: trimmed, at: startedAt }
    setLines((prev) => [...prev, line])
    pendingRef.current.push(line)
  }, [])

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
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

  const end = useCallback(async () => {
    if (endedRef.current) return
    endedRef.current = true
    cleanup()
    await flushTurns()
    try {
      // ⚠️ 中断扱いにするかはサーバが実際の発話数で判断する。
      //    クライアントから aborted を申告する作りにすると、離脱ビーコンと
      //    明示終了の両方が中断を送り、成立した商談まで評価不能になる。
      await fetch(api('end'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
    } catch {}
    setState('ended')
    onEnded?.()
  }, [api, cleanup, flushTurns, onEnded, sessionId])

  /**
   * マイクのミュート切替。
   * トラックを stop せず enabled で切るのは、解除のたびに getUserMedia を
   * 呼び直すとブラウザが再度許可を求め、WebRTCの再ネゴも要るため。
   */
  const setMicEnabled = useCallback((enabled: boolean) => {
    micRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = enabled
    })
  }, [])

  /** データチャネルに function の実行結果を返し、続きを話させる */
  const replyToTool = useCallback((callId: string, output: unknown) => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') return
    dc.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(output) },
      })
    )
    dc.send(JSON.stringify({ type: 'response.create' }))
  }, [])

  /**
   * テキストで発言する（音声が使えない環境・騒がしい場所・聞き取り精度が不安なとき用）。
   * Realtime のセッションに相手の発言として積み、その場で応答を促す。
   */
  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return false
      const dc = dcRef.current
      if (!dc || dc.readyState !== 'open') return false
      dc.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: trimmed }] },
        })
      )
      dc.send(JSON.stringify({ type: 'response.create' }))
      pushLine('guest', trimmed)
      void flushTurns()
      return true
    },
    [flushTurns, pushLine]
  )

  /** Realtime からの function call を処理する */
  const handleFunctionCall = useCallback(
    async (name: string, callId: string, argsJson: string) => {
      let args: any = {}
      try {
        args = JSON.parse(argsJson || '{}')
      } catch {}

      if (name === 'lookup_knowledge') {
        let result: any = { found: false, evidence: [], instruction: '根拠を確認できませんでした。答えを作らず、確認して折り返す旨をお伝えください。' }
        try {
          const res = await fetch(api('lookup'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, question: String(args?.question || '') }),
          })
          if (res.ok) result = await res.json()
        } catch {
          // 検索が落ちたら「根拠なし」に倒す。ここで一般論を返させると、
          // 資料に無いことを断定する挙動になる。
        }
        replyToTool(callId, result)
        return
      }

      if (name === 'record_answer') {
        let result: any = { ok: false }
        try {
          const res = await fetch(api('record'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, key: String(args?.key || ''), value: String(args?.value || '') }),
          })
          if (res.ok) result = await res.json()
        } catch {}
        if (Array.isArray(result?.remaining_required)) setRemainingRequired(result.remaining_required)
        replyToTool(callId, result)
        return
      }

      // advance_meeting
      const intent: 'stay' | 'next' | 'end' =
        args?.intent === 'next' ? 'next' : args?.intent === 'end' ? 'end' : 'stay'

      let result: any = { action: 'close', should_close: true }
      try {
        const res = await fetch(api('advance'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, intent, summary: String(args?.summary || '') }),
        })
        result = await res.json()
      } catch {
        // 進行APIが落ちたら締めに倒す（無限に商談が続くより安全）
      }

      if (typeof result?.phase === 'string') setPhaseName(result.phase)
      if (Array.isArray(result?.remaining_required)) setRemainingRequired(result.remaining_required)

      replyToTool(callId, result)

      if (result?.should_close) {
        // 締めの発話を終える時間を見てから終了する
        setTimeout(() => void end(), 14000)
      }
    },
    [api, end, replyToTool, sessionId]
  )

  const start = useCallback(async () => {
    setError(null)
    endedRef.current = false

    // 1) マイク取得（テキスト専用モードでは飛ばす）
    let mic: MediaStream | null = null
    if (!textOnly) {
      setState('requesting_mic')
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
      } catch {
        // ⚠️ マイクが使えないことを理由に商談を始められないのが最悪の結果。
        //    ここでは失敗させず、テキストのみで続行する。
        mic = null
      }
      micRef.current = mic
    }

    // 2) 短命トークンを取得
    setState('connecting')
    let clientSecret: string
    let model: string
    try {
      const res = await fetch(api('token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json()
      if (!res.ok || !data?.clientSecret) throw new Error(data?.error || '商談を開始できませんでした')
      clientSecret = data.clientSecret
      model = data.model
      if (data.durationMin) setDurationMin(data.durationMin)
    } catch (e: any) {
      cleanup()
      setState('error')
      setError(e?.message || '商談を開始できませんでした')
      return
    }

    // 3) WebRTC 接続
    try {
      const pc = new RTCPeerConnection()
      pcRef.current = pc

      const audioEl = new Audio()
      audioEl.autoplay = true
      audioElRef.current = audioEl
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0]
        // 音量エンベロープを取り、アバターの口に反映する
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
          // 音量解析ができなくても商談は続行できる（口が動かないだけ）
        }
      }

      if (mic) {
        mic.getTracks().forEach((track) => pc.addTrack(track, mic!))
      } else {
        // 送信トラックが無いと OpenAI 側が音声を返さないため、無音の送信路を用意する。
        // これが無いとテキストモードでAIの声が出ない。
        try {
          const silent = new AudioContext()
          const dest = silent.createMediaStreamDestination()
          const osc = silent.createOscillator()
          const gain = silent.createGain()
          gain.gain.value = 0
          osc.connect(gain).connect(dest)
          osc.start()
          dest.stream.getAudioTracks().forEach((t) => pc.addTrack(t, dest.stream))
        } catch {
          /* 送信路を作れなくてもテキストは往復する */
        }
      }

      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc

      dc.onmessage = (e) => {
        let ev: any
        try {
          ev = JSON.parse(e.data)
        } catch {
          return
        }
        const t: string = ev.type || ''

        // ⚠️ イベント名は新旧2系統ある。
        //    旧: response.audio_transcript.done / response.audio.delta
        //    新: response.output_audio_transcript.done / response.output_audio.delta
        //    旧名だけを見ていたため「AIの発話が逐語ログに1件も残らない」
        //    「アバターが喋る状態にならない」が本番で静かに同時発生した。
        //    以後どちらでも拾えるよう後方一致で判定する。
        if (t.endsWith('audio_transcript.done')) {
          pushLine('ai', ev.transcript || '')
          return
        }
        if (t.endsWith('audio.delta')) {
          if (!speechStartRef.current.ai) speechStartRef.current.ai = Date.now()
          setSpeaking(true)
          return
        }

        switch (t) {
          case 'conversation.item.input_audio_transcription.completed':
            pushLine('guest', ev.transcript || '')
            break
          case 'input_audio_buffer.speech_started':
            if (!speechStartRef.current.guest) speechStartRef.current.guest = Date.now()
            setListening(true)
            break
          case 'input_audio_buffer.speech_stopped':
            setListening(false)
            void flushTurns()
            break
          case 'response.done': {
            setSpeaking(false)
            // 保険: transcript イベントを取りこぼしていても、
            // response.done の中身からAIの発話を拾えるようにする。
            const items = ev?.response?.output ?? []
            for (const item of items) {
              for (const c of item?.content ?? []) {
                if (typeof c?.transcript === 'string' && c.transcript.trim()) pushLine('ai', c.transcript)
              }
            }
            void flushTurns()
            break
          }
          case 'response.function_call_arguments.done':
            void handleFunctionCall(ev.name, ev.call_id, ev.arguments)
            break
          case 'error':
            console.error('[aishodan] realtime error', ev)
            break
          default:
            // ⚠️ イベント名の世代交代で静かに壊れた実績がある。
            //    処理していない response.* を記録し、次に名前が変わったときに
            //    コンソールから即座に追えるようにする。
            if (t.startsWith('response.') && !t.endsWith('.delta')) {
              console.debug('[aishodan] unhandled realtime event', t)
            }
            break
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // 現行のWebRTC接続先。ephemeral token の発行が /sessions → /client_secrets に
      // 移ったのと同じ流れで旧パスは廃止されうるため、GAの /v1/realtime/calls を使う。
      const sdpRes = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        body: offer.sdp,
        headers: { Authorization: `Bearer ${clientSecret}`, 'Content-Type': 'application/sdp' },
      })
      if (!sdpRes.ok) throw new Error('音声接続を確立できませんでした')
      const answer = await sdpRes.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answer })

      startedAtRef.current = Date.now()
      setState('live')

      // AIから話し始めてもらう
      setTimeout(() => {
        if (dc.readyState === 'open') dc.send(JSON.stringify({ type: 'response.create' }))
      }, 400)
    } catch (e: any) {
      cleanup()
      setState('error')
      setError(e?.message || '接続に失敗しました')
    }
  }, [api, cleanup, flushTurns, handleFunctionCall, pushLine, sessionId, textOnly])

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
    if (elapsedSec > durationMin * 60 + 180) void end()
  }, [elapsedSec, durationMin, state, end])

  // 離脱時のクリーンアップ。
  // ⚠️ アンマウントだけでは /end に到達せず、タブを閉じた商談が live のまま残る。
  //    pagehide で sendBeacon を撃ち、ページ破棄後でも終了を届ける。
  useEffect(() => {
    const notifyEnd = (e: PageTransitionEvent) => {
      // ⚠️ bfcache へ入るだけの pagehide（persisted=true）では終了扱いにしない。
      //    スマホでホームに戻っただけで商談が終わり、復帰後に何も操作できなくなる。
      if (e.persisted) return
      if (endedRef.current) return
      // ⚠️ 開始していないなら終了を送らない。
      //    このフックはページ表示時点でマウントされるため、「リンクを開いて
      //    眺めただけ」でもビーコンが飛び、未実施の商談が終了扱いになる。
      if (startedAtRef.current === 0) return
      // ⚠️ endedRef は立てない。ここで立てると復帰後の正規の end() が無効化される。
      try {
        const body = new Blob([JSON.stringify({ sessionId })], { type: 'application/json' })
        navigator.sendBeacon?.(api('end'), body)
      } catch {
        /* 送れなくても離脱は止められない */
      }
    }
    window.addEventListener('pagehide', notifyEnd)
    return () => {
      window.removeEventListener('pagehide', notifyEnd)
      cleanup()
    }
  }, [api, cleanup, sessionId])

  return {
    state, error, lines, level, speaking, listening,
    elapsedSec, durationMin, phaseName, remainingRequired,
    start, end, sendText, setMicEnabled,
    micAvailable: Boolean(micRef.current),
  }
}
