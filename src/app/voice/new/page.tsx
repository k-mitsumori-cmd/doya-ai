'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import { Mic, Play, Pause, Download, Settings2, ChevronDown, Loader2, AlertCircle, LogIn, Lock, ArrowRight } from 'lucide-react'
import { getAllSpeakers, getFreeSpeakers } from '@/lib/voice/speakers'
import { isVoiceProFromUser } from '@/lib/voice/plans'

type OutputFormat = 'mp3' | 'wav' | 'ogg' | 'm4a'
type EmotionTone = 'neutral' | 'bright' | 'calm' | 'serious' | 'gentle'
type PauseLength = 'short' | 'standard' | 'long'

const EMOTION_LABELS: Record<EmotionTone, string> = {
  neutral: 'ニュートラル',
  bright:  '明るい',
  calm:    '落ち着き',
  serious: '真剣',
  gentle:  'やさしい',
}

const FORMAT_LABELS: Record<OutputFormat, string> = {
  mp3: 'MP3',
  wav: 'WAV',
  ogg: 'OGG',
  m4a: 'M4A',
}

function NewVoicePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status: sessionStatus } = useSession()
  const user = session?.user as any
  const isLoggedIn = !!user
  const isPro = isVoiceProFromUser(user)

  const allSpeakers = getAllSpeakers()
  const freeSpeakers = getFreeSpeakers()

  const [text, setText] = useState('')
  const [projectName, setProjectName] = useState('')
  const [speakerId, setSpeakerId] = useState('akira')
  const [speed, setSpeed] = useState(1.0)
  const [pitch, setPitch] = useState(0)
  const [volume, setVolume] = useState(100)
  const [pauseLength, setPauseLength] = useState<PauseLength>('standard')
  const [emotionTone, setEmotionTone] = useState<EmotionTone>('neutral')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('mp3')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ blobUrl: string; durationMs: number; projectId: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('doya_voice_settings')
      if (!stored) return
      const s = JSON.parse(stored)
      if (s.defaultSpeakerId) setSpeakerId(s.defaultSpeakerId)
      if (s.defaultSpeed != null) setSpeed(s.defaultSpeed)
      if (s.defaultPitch != null) setPitch(s.defaultPitch)
      if (s.defaultVolume != null) setVolume(s.defaultVolume)
      if (s.defaultPauseLength) setPauseLength(s.defaultPauseLength as PauseLength)
      if (s.defaultEmotionTone) setEmotionTone(s.defaultEmotionTone as EmotionTone)
      if (s.defaultOutputFormat) setOutputFormat(s.defaultOutputFormat as OutputFormat)
    } catch {}
  }, [])

  // URLパラメータ（?speaker=xxx）はlocalStorage設定より優先
  useEffect(() => {
    const speakerParam = searchParams?.get('speaker')
    if (speakerParam && allSpeakers.find(s => s.id === speakerParam)) {
      setSpeakerId(speakerParam)
    }
  }, [searchParams])

  // アンマウント時に音声を停止
  useEffect(() => {
    return () => { audioEl?.pause() }
  }, [audioEl])

  const charLimit = isPro ? 5000 : 1000
  const charCount = text.length
  const isOverLimit = charCount > charLimit

  const generate = async () => {
    if (!text.trim() || isOverLimit) return
    // 再生中の音声を停止し、前のBlobURLを解放
    audioEl?.pause()
    setPlaying(false)
    if (result?.blobUrl) URL.revokeObjectURL(result.blobUrl)
    setGenerating(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/voice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          projectName: projectName || `ナレーション ${new Date().toLocaleString('ja-JP')}`,
          speakerId,
          speed,
          pitch,
          volume,
          pauseLength,
          emotionTone,
          outputFormat,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || '生成に失敗しました')
        return
      }
      // audioBase64 → Blob URL 変換
      const audioMime = outputFormat === 'wav' ? 'audio/wav' : outputFormat === 'ogg' ? 'audio/ogg' : 'audio/mpeg'
      const byteChars = atob(data.audioBase64)
      const byteArr = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
      const blob = new Blob([byteArr], { type: audioMime })
      const blobUrl = URL.createObjectURL(blob)
      setResult({ blobUrl, durationMs: data.durationMs, projectId: data.projectId })
    } catch {
      setError('通信エラーが発生しました。再度お試しください。')
    } finally {
      setGenerating(false)
    }
  }

  const togglePlay = () => {
    if (!result?.blobUrl) return
    if (playing) {
      audioEl?.pause()
      setPlaying(false)
      return
    }
    const audio = new Audio(result.blobUrl)
    audio.play().catch(() => setPlaying(false))
    audio.onended = () => setPlaying(false)
    setAudioEl(audio)
    setPlaying(true)
  }

  // 未ログイン時はログイン誘導
  if (sessionStatus !== 'loading' && !isLoggedIn) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Page Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-900">新規ナレーション</h1>
          <p className="text-slate-500 text-base">テキストを入力して、AIナレーション音声を生成しましょう</p>
        </div>
        {/* Login Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-violet-600" />
            </div>
            <h3 className="text-lg font-black text-slate-700 mb-1">ログインが必要です</h3>
            <p className="text-slate-500 text-sm mb-6">音声を生成するにはGoogleアカウントでログインしてください</p>
            <button
              onClick={() => signIn('google', { callbackUrl: '/voice/new' })}
              className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl font-black text-sm hover:bg-violet-700 transition-all shadow-lg shadow-violet-600/20"
            >
              <LogIn className="w-4 h-4" />
              Googleでログイン
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Page Title Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-900">新規ナレーション</h1>
        <p className="text-slate-500 text-base">テキストを入力して、AIナレーション音声を生成しましょう</p>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
        {/* プロジェクト名 */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">プロジェクト名</label>
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="例: 商品紹介動画ナレーション"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:ring-violet-600 focus:border-violet-600 p-4 outline-none"
          />
        </div>

        {/* テキスト入力 */}
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <label className="text-sm font-bold text-slate-700">ナレーションテキスト</label>
            <span className={`text-xs ${isOverLimit ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
              {charCount.toLocaleString()} / {charLimit.toLocaleString()}文字
            </span>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="読み上げたいテキストを入力してください。**太字**は強調、...は間として自動認識されます。"
            rows={10}
            className={`w-full rounded-xl bg-slate-50 focus:ring-violet-600 focus:border-violet-600 p-4 text-base leading-relaxed outline-none border resize-none ${
              isOverLimit ? 'border-red-300 bg-red-50' : 'border-slate-200'
            }`}
          />
          {!isPro && (
            <p className="text-xs text-slate-400">
              無料プランは1,000文字まで。
              <a href="/voice/pricing" className="text-violet-600 font-bold hover:underline">Proにアップグレード</a>
              で5,000文字まで対応。
            </p>
          )}
        </div>

        {/* ボイスキャラクター選択 */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-700">ボイスキャラクター選択</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {allSpeakers.map(speaker => {
              const isSelected = speakerId === speaker.id
              const isLocked = !isPro && speaker.isPro
              return (
                <button
                  key={speaker.id}
                  onClick={() => { if (!isLocked) setSpeakerId(speaker.id) }}
                  disabled={isLocked}
                  className={`relative flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                    isLocked
                      ? 'opacity-60 border-transparent bg-slate-100 cursor-not-allowed'
                      : isSelected
                      ? 'border-violet-600 bg-violet-50'
                      : 'border-transparent bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  {isLocked && (
                    <Lock className="w-3 h-3 text-slate-400 absolute top-1.5 right-1.5" />
                  )}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 text-lg font-bold ${
                    isLocked
                      ? 'bg-slate-300 text-slate-500 grayscale'
                      : isSelected
                      ? 'bg-violet-200 text-violet-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {speaker.name[0]}
                  </div>
                  <span className="text-sm font-bold">{speaker.name}</span>
                  <span className="text-[10px] text-slate-500">
                    {isLocked ? 'Pro限定' : speaker.description}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 感情トーン */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-700">感情トーン</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(EMOTION_LABELS) as EmotionTone[]).map(tone => (
              <button
                key={tone}
                onClick={() => setEmotionTone(tone)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  emotionTone === tone
                    ? 'bg-violet-600 text-white'
                    : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                {EMOTION_LABELS[tone]}
              </button>
            ))}
          </div>
        </div>

        {/* 詳細設定アコーディオン */}
        <details
          className="group bg-slate-50 rounded-xl overflow-hidden border border-slate-100"
          open={showAdvanced}
          onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
        >
          <summary className="flex items-center justify-between p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2 font-bold text-slate-700">
              <Settings2 className="w-5 h-5" />
              詳細設定（話速・ピッチ・音量・出力形式）
            </div>
            <ChevronDown className="w-5 h-5 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>

          <div className="p-6 pt-0 space-y-6">
            {/* スライダー 3カラム */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-medium">
                  <span>話速</span>
                  <span>{speed.toFixed(1)}x</span>
                </div>
                <input
                  type="range" min={0.5} max={2.0} step={0.1}
                  value={speed}
                  onChange={e => setSpeed(Number(e.target.value))}
                  className="w-full accent-violet-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-medium">
                  <span>ピッチ</span>
                  <span>{pitch > 0 ? `+${pitch}` : pitch}</span>
                </div>
                <input
                  type="range" min={-10} max={10} step={1}
                  value={pitch}
                  onChange={e => setPitch(Number(e.target.value))}
                  className="w-full accent-violet-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-medium">
                  <span>音量</span>
                  <span>{volume}%</span>
                </div>
                <input
                  type="range" min={0} max={100} step={5}
                  value={volume}
                  onChange={e => setVolume(Number(e.target.value))}
                  className="w-full accent-violet-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* 句読点での間 */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">句読点での間</label>
              <div className="flex gap-2">
                {(['short', 'standard', 'long'] as PauseLength[]).map(pl => (
                  <button
                    key={pl}
                    onClick={() => setPauseLength(pl)}
                    className={`flex-1 py-2 text-sm rounded-lg font-bold transition-colors ${
                      pauseLength === pl
                        ? 'border-2 border-violet-600 bg-violet-50 text-violet-700'
                        : 'border-2 border-transparent bg-white text-slate-600'
                    }`}
                  >
                    {pl === 'short' ? '短め' : pl === 'standard' ? '普通' : '長め'}
                  </button>
                ))}
              </div>
            </div>

            {/* 出力形式 */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">出力形式</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(FORMAT_LABELS) as OutputFormat[]).map(fmt => {
                  const isProOnly = !isPro && fmt !== 'mp3' && fmt !== 'wav'
                  return (
                    <div key={fmt} className="relative">
                      <button
                        onClick={() => !isProOnly && setOutputFormat(fmt)}
                        disabled={isProOnly}
                        className={`px-4 py-2 text-sm rounded-lg font-bold transition-colors ${
                          outputFormat === fmt
                            ? 'border-2 border-violet-600 bg-violet-50 text-violet-700'
                            : isProOnly
                            ? 'border-2 border-transparent bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'border-2 border-transparent bg-white text-slate-600'
                        }`}
                      >
                        {FORMAT_LABELS[fmt]}
                      </button>
                      {isProOnly && (
                        <span className="absolute -top-2 -right-1 bg-amber-400 text-[8px] px-1 rounded-full text-white font-black">PRO</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </details>

        {/* エラー */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-bold">{error}</p>
          </div>
        )}

        {/* 生成ボタン */}
        <button
          onClick={generate}
          disabled={!text.trim() || isOverLimit || generating}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-600/20"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              音声を生成中...
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              音声を生成する
            </>
          )}
        </button>

        {/* 生成結果プレビュー */}
        {result && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700 font-bold">
                <Mic className="w-5 h-5" />
                音声を生成しました
                <span className="text-sm font-normal ml-2 opacity-70">
                  {Math.floor((result.durationMs || 0) / 60000)}:{String(Math.round(((result.durationMs || 0) % 60000) / 1000)).padStart(2, '0')}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={togglePlay}
                  className="p-2 rounded-full bg-white border border-emerald-200 text-emerald-600 shadow-sm hover:bg-emerald-50 transition-colors"
                  title={playing ? '停止' : '再生'}
                >
                  {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <a
                  href={result.blobUrl}
                  download={`narration.${outputFormat}`}
                  className="p-2 rounded-full bg-white border border-emerald-200 text-emerald-600 shadow-sm hover:bg-emerald-50 transition-colors"
                  title="ダウンロード"
                >
                  <Download className="w-5 h-5" />
                </a>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => router.push(`/voice/${result.projectId}`)}
                className="text-sm font-bold text-emerald-700 hover:underline flex items-center gap-1"
              >
                プロジェクト詳細
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NewVoicePage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <NewVoicePageInner />
    </Suspense>
  )
}
