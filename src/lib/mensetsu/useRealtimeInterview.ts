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
import { isLikelyHallucination } from '@/lib/realtime/hallucination'

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
  /** 映像も残すか（組織設定 recordVideo）。
   *  ⚠️ 既定は false。応募者の映像は保管・削除の負担と法的な重みが音声より大きい。
   *     有効なときだけカメラを取得し、同意画面にもその旨が出る。 */
  recordVideo?: boolean
}

/** 通信が切れたまま何分待つか。超えたら打ち切って部分評価へ回す（F1-8） */
const DISCONNECT_GRACE_MS = 3 * 60 * 1000

export function useRealtimeInterview({ token, onEnded, recordAudio = false, recordVideo = false }: UseRealtimeInterviewOptions) {
  const [state, setState] = useState<ConnState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const [level, setLevel] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [durationMin, setDurationMin] = useState(20)
  // 画面に大きく出すための「いま尋ねている質問」。
  // 初回は /token の firstQuestion、以降は /advance の戻り値で更新する。
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null)
  const [questionNumber, setQuestionNumber] = useState(1)
  const [questionTotal, setQuestionTotal] = useState(0)
  /** 通信が切れている間だけ true。応募者に「無反応の理由」を見せるために持つ（F1-8） */
  const [connectionLost, setConnectionLost] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const micRef = useRef<MediaStream | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)
  const pendingRef = useRef<TranscriptLine[]>([])
  const endedRef = useRef(false)
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 録音（組織設定が有効なときのみ）
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mixCtxRef = useRef<AudioContext | null>(null)
  /** 収録用のカメラ映像。⚠️ recordVideo が有効なときだけ取得する */
  const camRef = useRef<MediaStream | null>(null)

  /**
   * 逐語ログはまとめてサーバへ送る（1発話ごとに叩かない）。
   * ⚠️ 送信に失敗したらキューへ戻すこと。
   *    以前は fetch の前にキューを空にして失敗時に戻していなかったため、
   *    一瞬の通信断でその区間の発話が永久に消え、実際には答えているのに
   *    評価が「情報不足」に倒れる原因になっていた。
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
      const res = await fetch(`/api/mensetsu/live/${token}/turn`, {
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
      if (!res.ok) {
        // 4xx は投げ直しても通らない（評価済み等）ので捨てる。5xx・通信断は戻して再送。
        if (res.status >= 500) requeue()
        return
      }
      // ⚠️ サーバは1回あたり50件で切り詰める。保存件数を照合せずに成功扱いすると、
      //    再送で溜まった51件目以降（＝直近の回答）が黙って消える。
      const data = await res.json().catch(() => null)
      const saved = Number(data?.saved)
      if (Number.isFinite(saved) && saved < batch.length) {
        pendingRef.current = [...batch.slice(saved), ...pendingRef.current]
      }
    } catch {
      requeue()
    }
  }, [token])

  /** 直近に積んだ発話。transcript イベントと response.done の二重登録を防ぐ */
  const recentRef = useRef<{ key: string; at: number }[]>([])
  /**
   * 各話者の「話し始めた時刻」。
   * ⚠️ 発話は読み上げ／認識が終わって初めて確定するため、確定時刻で並べると
   *    長い発話が後ろにずれる。実際に本番の面接で、面接官の冒頭挨拶(長い)より
   *    応募者の相槌(短い)が先に採番され、逐語ログが会話の順序として
   *    読めなくなっていた。開始時刻を別に持ち、それを並び順の根拠にする。
   */
  const speechStartRef = useRef<{ interviewer: number; candidate: number }>({
    interviewer: 0,
    candidate: 0,
  })

  const pushLine = useCallback((speaker: TranscriptLine['speaker'], text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    // ⚠️ 無音・雑音に対する文字起こしの捏造を捨てる。
    //    残すと逐語ログが汚れるだけでなく、応募者が言っていないことを
    //    根拠に採点されうる。
    if (isLikelyHallucination(trimmed, speaker)) return
    // 同じ発話が別イベント経由で二度届くことがある（保険経路との重複）。
    // ⚠️ 直近20件で判定すると「はい」「そうですね」のような短い定型回答が
    //    2回目以降まるごと消え、無回答として不利に採点されてしまう。
    //    重複は必ず数百ms以内に届くので、5秒の時間窓に限定する。
    const key = `${speaker}:${trimmed}`
    const nowMs = Date.now()
    recentRef.current = recentRef.current.filter((r) => nowMs - r.at < 5000)
    if (recentRef.current.some((r) => r.key === key)) return
    recentRef.current.push({ key, at: nowMs })

    // 開始時刻が記録されていればそれを使う（無ければ確定時刻で代用）
    const startedAt = speechStartRef.current[speaker] || Date.now()
    speechStartRef.current[speaker] = 0
    const line: TranscriptLine = { speaker, text: trimmed, at: startedAt }
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
      // 収録した実体に合わせる（映像を含むと video/webm）
      const blobType = chunks[0]?.type || 'audio/webm'
      const blob = new Blob(chunks, { type: blobType })
      const res = await fetch(`/api/mensetsu/live/${token}/recording`, { method: 'POST' })
      if (!res.ok) return
      const { signedUrl } = await res.json()
      if (!signedUrl) return
      const put = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': blob.type || 'audio/webm' },
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
    // ⚠️ 収録用カメラは必ず止める。止め忘れると面接後もランプが点いたままになる
    camRef.current?.getTracks().forEach((t) => t.stop())
    camRef.current = null
    try {
      audioCtxRef.current?.close()
    } catch {}
    if (dropTimerRef.current) {
      clearTimeout(dropTimerRef.current)
      dropTimerRef.current = null
    }
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
      setConnectionLost(false)
      setState('ended')
      onEnded?.()
    },
    [cleanup, flushTurns, onEnded, recordAudio, token, uploadRecording]
  )

  /**
   * マイクのミュート切替。
   * トラックを stop せず enabled で切るのは、解除のたびに getUserMedia を
   * 呼び直すとブラウザが再度許可を求めたり、WebRTCの再ネゴが必要になるため。
   */
  const setMicEnabled = useCallback((enabled: boolean) => {
    micRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = enabled
    })
  }, [])

  /**
   * テキストで回答する（音声が使えない環境・騒がしい場所・聞き取り精度が不安なとき用）。
   * Realtime のセッションに応募者の発言として積み、その場で応答を促す。
   * 逐語ログにも同じ内容を残すので、評価は音声で答えた場合と同じ扱いになる。
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
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: trimmed }],
          },
        })
      )
      dc.send(JSON.stringify({ type: 'response.create' }))
      pushLine('candidate', trimmed)
      void flushTurns()
      return true
    },
    [flushTurns, pushLine]
  )

  /** Realtime からの function call を受けてサーバに進行を問い合わせ、結果を返す */
  const handleFunctionCall = useCallback(
    async (callId: string, argsJson: string) => {
      let intent: 'follow_up' | 'next' = 'next'
      let answerSummary = ''
      try {
        const parsed = JSON.parse(argsJson || '{}')
        if (parsed?.intent === 'follow_up') intent = 'follow_up'
        // 分岐の判定に使う（サーバはこれが無ければ直近の応募者発話で代用する）
        if (typeof parsed?.answer_summary === 'string') answerSummary = parsed.answer_summary
      } catch {}

      let result: any = { action: 'close', should_close: true }
      try {
        const res = await fetch(`/api/mensetsu/live/${token}/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent, answer_summary: answerSummary }),
        })
        result = await res.json()
      } catch {
        // 進行APIが落ちたら締めに倒す（無限に質問が続くより安全）
      }

      // 画面の質問パネルを進める（深掘り中は質問文を据え置く）
      if (result?.next_question) {
        setCurrentQuestion(result.next_question)
        if (Number.isFinite(Number(result.question_number))) {
          setQuestionNumber(Number(result.question_number))
        }
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

  // ⚠️ start の依存に end を足すと接続処理ごと作り直される。参照だけ最新に保つ
  const endRef = useRef(end)
  useEffect(() => {
    endRef.current = end
  }, [end])

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
      if (data.questionCount) setQuestionTotal(data.questionCount)
      if (data.firstQuestion) {
        setCurrentQuestion(data.firstQuestion)
        setQuestionNumber(1)
      }
    } catch (e: any) {
      cleanup()
      setState('error')
      setError(e?.message || '面接を開始できませんでした')
      return
    }

    // 3) WebRTC 接続
    try {
      const pc = new RTCPeerConnection()

      // ------------------------------------------------------------------
      // 通信断からの復帰 / 打ち切り（F1-8）
      // ------------------------------------------------------------------
      // ⚠️ WebRTCが切れても画面は何も言わないため、応募者は「AIが黙っている」
      //    としか分からず、待ち続けるか自分で閉じてしまう。切断を見つけて伝え、
      //    戻らないまま3分たったら打ち切る。
      // ⚠️ 打ち切りは aborted ではなく通常終了で送る。end ルートは発話が残って
      //    いれば completed に倒すので、そこまでの回答で部分評価に回せる。
      // ⚠️ 'disconnected' は一時的な揺れでも出る。即終了せず猶予を置く。
      pc.onconnectionstatechange = () => {
        if (endedRef.current) return
        const st = pc.connectionState
        if (st === 'connected') {
          setConnectionLost(false)
          if (dropTimerRef.current) {
            clearTimeout(dropTimerRef.current)
            dropTimerRef.current = null
          }
          return
        }
        if (st === 'disconnected' || st === 'failed') {
          setConnectionLost(true)
          if (!dropTimerRef.current) {
            dropTimerRef.current = setTimeout(() => {
              dropTimerRef.current = null
              void endRef.current(false)
            }, DISCONNECT_GRACE_MS)
          }
        }
      }
      pcRef.current = pc

      // AIの音声を再生
      const audioEl = new Audio()
      audioEl.autoplay = true
      audioElRef.current = audioEl
      // ⚠️ 収録でカメラを取りに行くため async。例外はこの中で握りつぶす
      pc.ontrack = async (e) => {
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

            // ⚠️ 映像は組織設定が有効なときだけ。取得できなくても面接は続行する
            //    （カメラ不許可で面接そのものが始まらない方が損失が大きい）。
            const tracks: MediaStreamTrack[] = [...dest.stream.getAudioTracks()]
            if (recordVideo) {
              try {
                const cam = await navigator.mediaDevices.getUserMedia({
                  video: { width: 640, height: 480, frameRate: 15 },
                })
                camRef.current = cam
                tracks.push(...cam.getVideoTracks())
              } catch {
                // 映像なしで音声だけ残す
              }
            }
            const recStream = new MediaStream(tracks)

            // opus が使えない環境では既定のコーデックに任せる
            // 映像を含むときは video/webm。含まないときは従来どおり音声のみ
            const wantVideo = recStream.getVideoTracks().length > 0
            const mime = wantVideo
              ? (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : undefined)
              : (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined)
            const rec = new MediaRecorder(recStream, {
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
        const t: string = ev.type || ''

        // ⚠️ イベント名は新旧2系統ある。
        //    旧: response.audio_transcript.done / response.audio.delta
        //    新: response.output_audio_transcript.done / response.output_audio.delta
        //    エンドポイントが /sessions → /client_secrets に移ったのと同じ流れで
        //    イベント名も変わっており、旧名だけを見ていたため
        //    「面接官の発話が逐語ログに1件も残らない」「アバターが喋る状態にならない」
        //    という不具合が本番で起きた。以後どちらでも拾えるよう後方一致で判定する。
        if (t.endsWith('audio_transcript.done')) {
          pushLine('interviewer', ev.transcript || '')
          return
        }
        if (t.endsWith('audio.delta')) {
          if (!speechStartRef.current.interviewer) {
            speechStartRef.current.interviewer = Date.now()
          }
          setSpeaking(true)
          return
        }

        switch (t) {
          // 応募者の発話が文字起こしされた
          case 'conversation.item.input_audio_transcription.completed':
            pushLine('candidate', ev.transcript || '')
            break
          case 'input_audio_buffer.speech_started':
            if (!speechStartRef.current.candidate) {
              speechStartRef.current.candidate = Date.now()
            }
            setListening(true)
            break
          case 'input_audio_buffer.speech_stopped':
            setListening(false)
            void flushTurns()
            break
          case 'response.done': {
            setSpeaking(false)
            // 保険: transcript イベントを取りこぼしていても、
            // response.done の中身から面接官の発話を拾えるようにする。
            const items = ev?.response?.output ?? []
            for (const item of items) {
              for (const c of item?.content ?? []) {
                if (typeof c?.transcript === 'string' && c.transcript.trim()) {
                  pushLine('interviewer', c.transcript)
                }
              }
            }
            void flushTurns()
            break
          }
          case 'response.function_call_arguments.done':
            void handleFunctionCall(ev.call_id, ev.arguments)
            break
          case 'error':
            console.error('[mensetsu] realtime error', ev)
            break
          default:
            // ⚠️ イベント名の世代交代で静かに壊れた実績がある
            //    （response.audio_transcript.done → response.output_audio_transcript.done）。
            //    面接官の発話が逐語ログに1件も残らないという形で本番に出たが、
            //    ログが無かったため実機テストするまで気づけなかった。
            //    処理していない response.* を記録しておき、次に名前が変わったときは
            //    コンソールから即座に追えるようにする。
            if (t.startsWith('response.') && !t.endsWith('.delta')) {
              console.debug('[mensetsu] unhandled realtime event', t)
            }
            break
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // 現行のWebRTC接続先。旧 `/v1/realtime?model=` も今のところ通るが、
      // ephemeral token の発行が `/sessions` → `/client_secrets` に移ったのと同じ流れで
      // 旧パスは廃止されうるため、GAの `/v1/realtime/calls` を使う。
      const sdpRes = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`, {
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
  }, [cleanup, flushTurns, handleFunctionCall, pushLine, recordAudio, recordVideo, token])

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

  // 離脱時のクリーンアップ。
  // ⚠️ アンマウントだけでは /end に到達しないため、タブを閉じた面接が
  //    status='live' のまま残り、そのテンプレートの質問編集を永久にブロックしていた。
  //    pagehide で sendBeacon を撃ち、ページ破棄後でも終了を届ける。
  useEffect(() => {
    const notifyEnd = (e: PageTransitionEvent) => {
      // ⚠️ bfcache へ入るだけの pagehide（persisted=true）では終了扱いにしない。
      //    スマホでホームに戻っただけのケースまで面接を終わらせてしまい、
      //    復帰後に「終了」を押しても no-op になる（endedRef が立っているため
      //    最後の flushTurns・録音アップロード・完了画面が全て走らない）状態だった。
      if (e.persisted) return
      if (endedRef.current) return
      // ⚠️ 面接を開始していないなら終了を送らない。
      //    このフックはページ表示時点でマウントされるため、
      //    「リンクを開いて眺めただけで閉じた」場合にも beacon が飛び、
      //    受験前の面接が終了扱いになって二度と受けられなくなっていた
      //    （実際にテスト用URLが1本これで死んだ）。
      if (startedAtRef.current === 0) return
      // ⚠️ endedRef は立てない。ここで立てると、復帰後の正規の end() が丸ごと無効化される。
      try {
        const body = new Blob([JSON.stringify({ aborted: true })], { type: 'application/json' })
        navigator.sendBeacon?.(`/api/mensetsu/live/${token}/end`, body)
      } catch {
        /* 送れなくても離脱は止められない */
      }
    }
    window.addEventListener('pagehide', notifyEnd)
    return () => {
      window.removeEventListener('pagehide', notifyEnd)
      cleanup()
    }
  }, [cleanup, token])

  return {
    state,
    error,
    lines,
    level,
    speaking,
    listening,
    elapsedSec,
    durationMin,
    start,
    end,
    sendText,
    setMicEnabled,
    currentQuestion,
    questionNumber,
    questionTotal,
    connectionLost,
  }
}
