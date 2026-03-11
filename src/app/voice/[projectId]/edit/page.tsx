'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft, Mic, Loader2, Save, Play, Pause, Download,
  ChevronDown, AlertCircle, CheckCircle2, LogIn,
} from 'lucide-react'
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
  mp3: 'MP3（標準）',
  wav: 'WAV（高品質）',
  ogg: 'OGG（Web用）',
  m4a: 'M4A（Apple）',
}

export default function EditProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const user = session?.user as any
  const isLoggedIn = !!session?.user
  const isPro = isVoiceProFromUser(user)

  const allSpeakers = getAllSpeakers()
  const freeSpeakers = getFreeSpeakers()
  const availableSpeakers = isPro ? allSpeakers : freeSpeakers

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [speakerId, setSpeakerId] = useState('akira')
  const [speed, setSpeed] = useState(1.0)
  const [pitch, setPitch] = useState(0)
  const [volume, setVolume] = useState(100)
  const [emotionTone, setEmotionTone] = useState<EmotionTone>('neutral')
  const [pauseLength, setPauseLength] = useState<PauseLength>('standard')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('mp3')
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // 再生成結果
  const [result, setResult] = useState<{ blobUrl: string; durationMs: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)

  const charLimit = isPro ? 5000 : 1000
  const charCount = text.length
  const isOverLimit = charCount > charLimit

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!isLoggedIn) {
      setLoading(false)
      return
    }
    fetch(`/api/voice/projects/${projectId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (data.success && data.project) {
          const p = data.project
          setName(p.name || '')
          setText(p.inputText || '')
          setSpeakerId(p.speakerId || 'akira')
          setSpeed(p.speed ?? 1.0)
          setPitch(p.pitch ?? 0)
          setVolume(p.volume ?? 100)
          setEmotionTone((p.emotionTone || 'neutral') as EmotionTone)
          setPauseLength((p.pauseLength || 'standard') as PauseLength)
          setOutputFormat((p.outputFormat || 'mp3') as OutputFormat)
        } else {
          setFetchError(data.error || 'プロジェクトの取得に失敗しました')
        }
      })
      .catch(() => {
        setFetchError('プロジェクトの読み込みに失敗しました。通信環境を確認してください。')
      })
      .finally(() => setLoading(false))
  }, [projectId, isLoggedIn, sessionStatus])

  // アンマウント時に音声を停止 & BlobURL解放
  useEffect(() => {
    return () => {
      audioEl?.pause()
      if (result?.blobUrl) URL.revokeObjectURL(result.blobUrl)
    }
  }, [audioEl, result])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaveSuccess(false)
    try {
      const res = await fetch(`/api/voice/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          inputText: text,
          speakerId,
          speed,
          pitch,
          volume,
          emotionTone,
          pauseLength,
          outputFormat,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || '保存に失敗しました')
      } else {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch {
      setError('通信エラーが発生しました。再度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const regenerate = async () => {
    if (!text.trim() || isOverLimit) return
    setRegenerating(true)
    setError(null)
    // 前の再生を停止
    audioEl?.pause()
    setPlaying(false)
    if (result?.blobUrl) URL.revokeObjectURL(result.blobUrl)
    setResult(null)

    try {
      // まず保存してから再生成
      await fetch(`/api/voice/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          inputText: text,
          speakerId,
          speed,
          pitch,
          volume,
          emotionTone,
          pauseLength,
          outputFormat,
        }),
      })

      const res = await fetch('/api/voice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          text,
          speakerId,
          speed,
          pitch,
          volume,
          emotionTone,
          pauseLength,
          outputFormat,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || '再生成に失敗しました')
      } else {
        // audioBase64 を Blob URL に変換してプレビュー
        const audioMime = outputFormat === 'wav' ? 'audio/wav' : outputFormat === 'ogg' ? 'audio/ogg' : 'audio/mpeg'
        const byteChars = atob(data.audioBase64)
        const byteArr = new Uint8Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
        const blob = new Blob([byteArr], { type: audioMime })
        const blobUrl = URL.createObjectURL(blob)
        setResult({ blobUrl, durationMs: data.durationMs })
      }
    } catch {
      setError('通信エラーが発生しました。再度お試しください。')
    } finally {
      setRegenerating(false)
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

  if (!isLoggedIn && !loading) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20 space-y-4">
        <LogIn className="w-10 h-10 text-slate-300 mx-auto" />
        <h3 className="text-lg font-bold text-slate-700">ログインが必要です</h3>
        <p className="text-slate-500 text-sm">プロジェクトを編集するにはログインしてください</p>
        <button
          onClick={() => signIn('google', { callbackUrl: `/voice/${projectId}/edit` })}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition-colors"
        >
          <LogIn className="w-4 h-4" />
          Googleでログイン
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20 space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-2">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-slate-700 font-bold">{fetchError}</p>
        <Link href="/voice" className="inline-block text-violet-600 font-bold hover:underline">
          ダッシュボードへ戻る
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-32">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href={`/voice/${projectId}`}
          className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-violet-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>戻る</span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">プロジェクトを編集</h2>
      </div>

      <div className="space-y-6">
      {/* テキスト入力カード */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        {/* プロジェクト名 */}
        <label className="block mb-6">
          <span className="text-sm font-bold text-slate-700 mb-2 block">プロジェクト名</span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例: 商品紹介動画ナレーション"
            className="w-full rounded-xl border-slate-200 bg-slate-50 focus:border-violet-600 focus:ring-violet-600 h-12 px-4 text-base border outline-none"
          />
        </label>

        {/* ナレーションテキスト */}
        <label className="block">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-bold text-slate-700">ナレーションテキスト</span>
            <span className={`text-xs ${isOverLimit ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
              {charCount.toLocaleString()} / {charLimit.toLocaleString()} 文字
            </span>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="ここに読み上げたいテキストを入力してください..."
            className={`w-full rounded-xl border bg-slate-50 focus:border-violet-600 focus:ring-violet-600 min-h-[160px] p-4 text-base leading-relaxed outline-none resize-none ${
              isOverLimit ? 'border-red-300 bg-red-50' : 'border-slate-200'
            }`}
          />
        </label>
        {isOverLimit && (
          <p className="text-xs text-red-500 mt-2 font-bold">
            文字数が上限を超えています。テキストを短くしてください。
          </p>
        )}
      </div>

      {/* ボイスキャラクター選択カード */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-sm font-bold text-slate-700 mb-4">ボイスキャラクター</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {availableSpeakers.map(speaker => {
            const isSelected = speakerId === speaker.id
            const colorClass = speaker.gender === 'male' ? 'bg-blue-500' : speaker.gender === 'female' ? 'bg-pink-500' : 'bg-purple-500'
            return (
              <button
                key={speaker.id}
                onClick={() => setSpeakerId(speaker.id)}
                className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all group ${
                  isSelected
                    ? 'border-violet-600 bg-violet-600/5'
                    : 'border-slate-100 hover:border-violet-600/50'
                }`}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 text-lg font-bold text-white ${
                  isSelected ? colorClass + ' ring-2 ring-violet-600 ring-offset-2' : colorClass
                }`}>
                  {speaker.name[0]}
                </div>
                <span className={`text-xs font-bold ${isSelected ? 'text-violet-600' : 'text-slate-900'}`}>
                  {speaker.name}
                </span>
                <span className={`text-[10px] line-clamp-1 ${isSelected ? 'text-violet-600/70' : 'text-slate-400'}`}>
                  {speaker.description}
                </span>
              </button>
            )
          })}
        </div>
        {!isPro && allSpeakers.length > freeSpeakers.length && (
          <p className="text-xs text-slate-400 mt-3">
            +{allSpeakers.length - freeSpeakers.length}種のキャラクターは
            <a href="/voice/pricing" className="text-violet-600 font-bold hover:underline ml-0.5">Proプラン</a>
            で利用可能
          </p>
        )}

        {/* 感情トーン */}
        <div className="mt-6">
          <span className="text-sm font-bold text-slate-700 mb-2 block">感情トーン</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(EMOTION_LABELS) as EmotionTone[]).map(tone => (
              <button
                key={tone}
                onClick={() => setEmotionTone(tone)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  emotionTone === tone
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {EMOTION_LABELS[tone]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 詳細設定アコーディオン */}
      <details
        className="group bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
        open={showAdvanced}
        onToggle={e => setShowAdvanced((e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex items-center justify-between p-6 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span className="text-sm font-bold text-slate-700">詳細設定（話速・ピッチ・音量）</span>
          <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>

        <div className="p-6 pt-0 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 話速 */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs font-medium text-slate-500">話速</label>
                <span className="text-xs font-bold text-violet-600">{speed.toFixed(1)}x</span>
              </div>
              <input
                type="range" min={0.5} max={2.0} step={0.1}
                value={speed}
                onChange={e => setSpeed(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-violet-600"
              />
            </div>

            {/* ピッチ */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs font-medium text-slate-500">ピッチ</label>
                <span className="text-xs font-bold text-violet-600">{pitch > 0 ? `+${pitch}` : pitch}st</span>
              </div>
              <input
                type="range" min={-10} max={10} step={1}
                value={pitch}
                onChange={e => setPitch(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-violet-600"
              />
            </div>

            {/* 音量 */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs font-medium text-slate-500">音量</label>
                <span className="text-xs font-bold text-violet-600">{volume}%</span>
              </div>
              <input
                type="range" min={0} max={100} step={5}
                value={volume}
                onChange={e => setVolume(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-violet-600"
              />
            </div>

            {/* 出力形式 */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">出力形式</label>
              <select
                value={outputFormat}
                onChange={e => setOutputFormat(e.target.value as OutputFormat)}
                className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm focus:border-violet-600 focus:ring-violet-600 h-10 px-3"
              >
                {(Object.keys(FORMAT_LABELS) as OutputFormat[]).map(fmt => (
                  <option key={fmt} value={fmt} disabled={!isPro && fmt !== 'mp3'}>
                    {FORMAT_LABELS[fmt]}{!isPro && fmt !== 'mp3' ? ' (PRO)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 間（ポーズ） */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">句読点での間</label>
            <div className="flex gap-2">
              {(['short', 'standard', 'long'] as PauseLength[]).map(pl => (
                <button
                  key={pl}
                  onClick={() => setPauseLength(pl)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    pauseLength === pl ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {pl === 'short' ? '短い' : pl === 'standard' ? '標準' : '長い'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>

      {/* エラー */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-700 font-bold">{error}</p>
            <p className="text-xs text-red-500 mt-1">設定を確認してもう一度お試しください。</p>
          </div>
        </div>
      )}

      {/* 保存成功 */}
      {saveSuccess && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700 font-bold">設定を保存しました</p>
        </div>
      )}

      {/* 再生成結果プレビュー */}
      {result && (() => {
        const selectedSpeaker = availableSpeakers.find(s => s.id === speakerId)
        return (
          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-900">音声を再生成しました</p>
                  <p className="text-xs text-emerald-700/70">
                    {selectedSpeaker?.name || speakerId} ({EMOTION_LABELS[emotionTone]}) / {Math.round((result.durationMs || 0) / 1000)}秒
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={togglePlay}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1 h-10 px-4 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-colors"
                >
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {playing ? '停止' : '再生'}
                </button>
                <a
                  href={result.blobUrl}
                  download={`${name || 'narration'}.${outputFormat}`}
                  className="w-10 h-10 flex items-center justify-center bg-white text-emerald-600 rounded-xl border border-emerald-200 hover:bg-emerald-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => router.push(`/voice/${projectId}`)}
                  className="h-10 px-3 text-emerald-700 text-xs font-bold hover:underline"
                >
                  詳細へ
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      </div>

      {/* 固定ボトムバー */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 p-4 z-50">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-6 h-14 bg-slate-100 text-slate-700 rounded-2xl font-bold disabled:opacity-50 transition-colors hover:bg-slate-200"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            保存
          </button>
          <button
            onClick={regenerate}
            disabled={regenerating || !text.trim() || isOverLimit}
            className="flex-1 flex items-center justify-center gap-2 h-14 bg-violet-600 text-white rounded-2xl font-bold shadow-lg shadow-violet-600/20 transition-all hover:bg-violet-700 active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            {regenerating ? '再生成中...' : '音声を再生成'}
          </button>
        </div>
      </div>
    </div>
  )
}
