'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Mic, Play, Pause, Download, Settings2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { getAllSpeakers, getFreeSpeakers } from '@/lib/voice/speakers'

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
  mp3: 'MP3（標準）',
  wav: 'WAV（高品質）',
  ogg: 'OGG（Web用）',
  m4a: 'M4A（Apple）',
}

export default function NewVoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const user = session?.user as any
  const isPro = ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(String(user?.voicePlan || user?.plan || '').toUpperCase())

  const allSpeakers = getAllSpeakers()
  const freeSpeakers = getFreeSpeakers()
  const availableSpeakers = isPro ? allSpeakers : freeSpeakers

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
    audio.play()
    audio.onended = () => setPlaying(false)
    setAudioEl(audio)
    setPlaying(true)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">新規ナレーション生成</h1>
        <p className="text-sm text-slate-500 mt-1">テキストを入力してボイスキャラクターを選択し、音声を生成します</p>
      </div>

      {/* プロジェクト名 */}
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">プロジェクト名（任意）</label>
        <input
          type="text"
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          placeholder="例: 商品紹介動画ナレーション"
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
        />
      </div>

      {/* テキスト入力 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-bold text-slate-700">ナレーションテキスト <span className="text-red-500">*</span></label>
          <span className={`text-xs font-mono ${isOverLimit ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
            {charCount.toLocaleString()} / {charLimit.toLocaleString()}文字
          </span>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="読み上げたいテキストを入力してください。**太字**は強調、...は間として自動認識されます。"
          rows={8}
          className={`w-full px-3 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none resize-none ${
            isOverLimit ? 'border-red-300 bg-red-50' : 'border-slate-200'
          }`}
        />
        {!isPro && (
          <p className="text-xs text-slate-400 mt-1">
            無料プランは1,000文字まで。
            <a href="/voice/pricing" className="text-violet-600 font-bold hover:underline">Proにアップグレード</a>
            で5,000文字まで対応。
          </p>
        )}
      </div>

      {/* ボイスキャラクター選択 */}
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">ボイスキャラクター</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {availableSpeakers.map(speaker => (
            <button
              key={speaker.id}
              onClick={() => setSpeakerId(speaker.id)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                speakerId === speaker.id
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-slate-200 hover:border-violet-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                  speaker.gender === 'male' ? 'bg-blue-500' : speaker.gender === 'female' ? 'bg-pink-500' : 'bg-purple-500'
                }`}>
                  {speaker.name[0]}
                </div>
                <span className="text-sm font-bold text-slate-900">{speaker.name}</span>
              </div>
              <p className="text-[10px] text-slate-500 line-clamp-1">{speaker.description}</p>
            </button>
          ))}
        </div>
        {!isPro && allSpeakers.length > freeSpeakers.length && (
          <p className="text-xs text-slate-400 mt-2">
            ＋{allSpeakers.length - freeSpeakers.length}種のキャラクターは
            <a href="/voice/pricing" className="text-violet-600 font-bold hover:underline">Proプラン</a>
            で利用可能
          </p>
        )}
      </div>

      {/* 感情トーン */}
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">感情トーン</label>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(EMOTION_LABELS) as EmotionTone[]).map(tone => (
            <button
              key={tone}
              onClick={() => setEmotionTone(tone)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                emotionTone === tone
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700'
              }`}
            >
              {EMOTION_LABELS[tone]}
            </button>
          ))}
        </div>
      </div>

      {/* 詳細設定 */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Settings2 className="w-4 h-4" />
            詳細設定（話速・ピッチ・音量・出力形式）
          </div>
          {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showAdvanced && (
          <div className="p-4 pt-0 space-y-4 border-t border-slate-100">
            {/* 話速 */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-bold text-slate-700">話速</label>
                <span className="text-sm font-mono text-violet-600">{speed.toFixed(1)}x</span>
              </div>
              <input
                type="range" min={0.5} max={2.0} step={0.1}
                value={speed}
                onChange={e => setSpeed(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>遅い (0.5x)</span><span>標準 (1.0x)</span><span>速い (2.0x)</span>
              </div>
            </div>

            {/* ピッチ */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-bold text-slate-700">ピッチ</label>
                <span className="text-sm font-mono text-violet-600">{pitch > 0 ? `+${pitch}` : pitch}st</span>
              </div>
              <input
                type="range" min={-10} max={10} step={1}
                value={pitch}
                onChange={e => setPitch(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>低い (-10)</span><span>標準 (0)</span><span>高い (+10)</span>
              </div>
            </div>

            {/* 音量 */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-bold text-slate-700">音量</label>
                <span className="text-sm font-mono text-violet-600">{volume}%</span>
              </div>
              <input
                type="range" min={0} max={100} step={5}
                value={volume}
                onChange={e => setVolume(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
            </div>

            {/* 間（ポーズ） */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">句読点での間</label>
              <div className="flex gap-2">
                {(['short', 'standard', 'long'] as PauseLength[]).map(pl => (
                  <button
                    key={pl}
                    onClick={() => setPauseLength(pl)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                      pauseLength === pl ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-violet-100'
                    }`}
                  >
                    {pl === 'short' ? '短い' : pl === 'standard' ? '標準' : '長い'}
                  </button>
                ))}
              </div>
            </div>

            {/* 出力形式 */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">出力形式</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(FORMAT_LABELS) as OutputFormat[]).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setOutputFormat(fmt)}
                    disabled={!isPro && fmt !== 'mp3'}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors text-left ${
                      outputFormat === fmt
                        ? 'bg-violet-600 text-white'
                        : !isPro && fmt !== 'mp3'
                        ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                        : 'bg-slate-100 text-slate-600 hover:bg-violet-100'
                    }`}
                  >
                    {FORMAT_LABELS[fmt]}
                    {!isPro && fmt !== 'mp3' && <span className="ml-1 text-[9px] font-bold bg-amber-100 text-amber-600 px-1 py-0.5 rounded">PRO</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* エラー */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-bold">
          {error}
        </div>
      )}

      {/* 生成結果 */}
      {result && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <Mic className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-green-800">音声生成完了！</p>
                <p className="text-xs text-green-600">再生時間: {Math.round((result.durationMs || 0) / 1000)}秒</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={togglePlay}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
              >
                {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {playing ? '停止' : '再生'}
              </button>
              <a
                href={result.blobUrl}
                download={`narration.${outputFormat}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-300 text-green-700 rounded-lg text-sm font-bold hover:bg-green-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                DL
              </a>
              <button
                onClick={() => router.push(`/voice/${result.projectId}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                詳細 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 生成ボタン */}
      <button
        onClick={generate}
        disabled={!text.trim() || isOverLimit || generating}
        className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-base rounded-xl transition-colors flex items-center justify-center gap-2"
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
    </div>
  )
}
