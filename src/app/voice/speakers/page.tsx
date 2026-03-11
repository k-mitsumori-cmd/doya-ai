'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Play, Pause, Star, AlertCircle, Loader2, Lock, Crown } from 'lucide-react'
import { getAllSpeakers, type VoiceSpeaker } from '@/lib/voice/speakers'
import { isVoiceProFromUser } from '@/lib/voice/plans'
import Link from 'next/link'

const GENDER_LABEL = { male: '男性', female: '女性', neutral: '中性' }
const GENDER_COLOR_BG = {
  male: 'bg-blue-100',
  female: 'bg-pink-100',
  neutral: 'bg-purple-100',
}
const GENDER_COLOR_TEXT = {
  male: 'text-blue-600',
  female: 'text-pink-600',
  neutral: 'text-purple-600',
}
const GENDER_TAG_STYLE = {
  male: 'bg-blue-50 text-blue-600',
  female: 'bg-pink-50 text-pink-600',
  neutral: 'bg-purple-50 text-purple-600',
}
// アバターの頭文字を取得
function getInitial(name: string): string {
  return name.charAt(0)
}

export default function SpeakersPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const isPro = isVoiceProFromUser(user)

  const speakers = getAllSpeakers()
  const [filter, setFilter] = useState<'all' | 'male' | 'female' | 'neutral' | 'free'>('all')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)
  const [currentBlobUrl, setCurrentBlobUrl] = useState<string | null>(null)
  const [sampleError, setSampleError] = useState<string | null>(null)

  const filtered = filter === 'all'
    ? speakers
    : filter === 'free'
    ? speakers.filter(s => !s.isPro)
    : speakers.filter(s => s.gender === filter)

  const freeSpeakers = filtered.filter(s => !s.isPro)
  const proSpeakers = filtered.filter(s => s.isPro)

  // アンマウント時に音声停止 & BlobURL解放
  useEffect(() => {
    return () => {
      audioEl?.pause()
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
    }
  }, [audioEl, currentBlobUrl])

  const togglePlay = async (speaker: VoiceSpeaker) => {
    if (playingId === speaker.id) {
      audioEl?.pause()
      setPlayingId(null)
      if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); setCurrentBlobUrl(null) }
      return
    }
    audioEl?.pause()
    if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); setCurrentBlobUrl(null) }
    setSampleError(null)
    setLoadingId(speaker.id)

    try {
      // サンプル音声取得 (audioBase64 → Blob URL)
      const res = await fetch(`/api/voice/speakers/${speaker.id}/sample`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'サンプル音声の取得に失敗しました')
      }
      const data = await res.json()
      if (!data.audioBase64) throw new Error('サンプル音声データが取得できませんでした')

      const byteChars = atob(data.audioBase64)
      const byteArr = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
      const blob = new Blob([byteArr], { type: 'audio/mpeg' })
      const blobUrl = URL.createObjectURL(blob)

      const audio = new Audio(blobUrl)
      audio.play().catch(() => {
        setPlayingId(null)
        URL.revokeObjectURL(blobUrl)
        setCurrentBlobUrl(null)
      })
      audio.onended = () => { setPlayingId(null); URL.revokeObjectURL(blobUrl); setCurrentBlobUrl(null) }
      audio.onerror = () => { setPlayingId(null); URL.revokeObjectURL(blobUrl); setCurrentBlobUrl(null) }
      setAudioEl(audio)
      setCurrentBlobUrl(blobUrl)
      setPlayingId(speaker.id)
    } catch (err: any) {
      setSampleError(err.message || 'サンプル音声の再生に失敗しました')
      setPlayingId(null)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div>
      {/* ページヘッダー */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight text-slate-900">ボイス一覧</h1>
          <p className="text-lg text-slate-500">12種類の魅力的なAIキャラクターから用途に合わせて選べます</p>
        </div>
        {!isPro && (
          <Link
            href="/voice/pricing"
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-bold text-white shadow-lg shadow-violet-600/20 hover:scale-[1.02] transition-transform whitespace-nowrap"
          >
            <Crown className="w-4 h-4" />
            Proプランにアップグレード
          </Link>
        )}
      </div>

      {/* サンプル再生エラー */}
      {sampleError && (
        <div className="mb-8 flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-bold">{sampleError}</p>
          <button onClick={() => setSampleError(null)} className="text-xs text-red-500 hover:text-red-700 font-bold ml-auto">
            閉じる
          </button>
        </div>
      )}

      {/* フィルター */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        {(['all', 'male', 'female', 'neutral', 'free'] as const).map(g => (
          <button
            key={g}
            onClick={() => setFilter(g)}
            className={`rounded-full px-6 py-2 text-sm font-bold transition-colors ${
              filter === g
                ? 'bg-violet-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-violet-600'
            }`}
          >
            {g === 'all' ? 'すべて' : g === 'free' ? '無料のみ' : GENDER_LABEL[g]}
          </button>
        ))}
      </div>

      {/* 無料キャラクターセクション */}
      {freeSpeakers.length > 0 && (
        <div className="mb-12">
          <div className="mb-6 flex items-center gap-2">
            <span className="h-6 w-1.5 rounded-full bg-violet-600"></span>
            <h2 className="text-xl font-bold text-slate-900">無料キャラクター</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {freeSpeakers.map(speaker => (
              <div
                key={speaker.id}
                className="group relative flex flex-col rounded-2xl bg-white p-6 shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-violet-600/5 transition-all"
              >
                {/* トップ行: アバター + FREE バッジ */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-16 w-16 rounded-full ${GENDER_COLOR_BG[speaker.gender]} ${GENDER_COLOR_TEXT[speaker.gender]} text-2xl font-black flex items-center justify-center`}>
                    {getInitial(speaker.name)}
                  </div>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    FREE
                  </span>
                </div>

                {/* 名前 */}
                <h3 className="text-xl font-black text-slate-900 mb-1">{speaker.name}</h3>

                {/* 説明 */}
                <p className="text-sm text-slate-500 line-clamp-2 mb-4">{speaker.description}</p>

                {/* タグ */}
                <div className="flex gap-2 flex-wrap mb-6">
                  <span className={`rounded-lg px-2 py-1 text-xs font-medium ${GENDER_TAG_STYLE[speaker.gender]}`}>
                    {GENDER_LABEL[speaker.gender]}
                  </span>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {speaker.characteristics}
                  </span>
                </div>

                {/* ボタン */}
                <div className="mt-auto flex gap-3">
                  <button
                    onClick={() => togglePlay(speaker)}
                    disabled={loadingId === speaker.id}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-sm font-bold transition-colors ${
                      playingId === speaker.id
                        ? 'bg-violet-600 text-white hover:bg-violet-700'
                        : 'bg-violet-600/10 text-violet-600 hover:bg-violet-600/20'
                    }`}
                  >
                    {loadingId === speaker.id ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> 読込中</>
                    ) : playingId === speaker.id ? (
                      <><Pause className="w-4 h-4" /> 停止</>
                    ) : (
                      <><Play className="w-4 h-4" /> 試聴</>
                    )}
                  </button>
                  <Link
                    href={`/voice/new?speaker=${speaker.id}`}
                    className="flex flex-[2] items-center justify-center gap-1 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white hover:bg-violet-600/90 transition-colors"
                  >
                    この声で生成
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pro限定キャラクターセクション */}
      {proSpeakers.length > 0 && (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-6 w-1.5 rounded-full bg-amber-400"></span>
              <h2 className="text-xl font-bold text-slate-900">Pro限定キャラクター</h2>
            </div>
            {!isPro && (
              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
                <Lock className="w-4 h-4" />
                Proプラン限定
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {proSpeakers.map(speaker => {
              const locked = !isPro
              return (
                <div
                  key={speaker.id}
                  className={`group relative flex flex-col rounded-2xl p-6 border border-slate-100 transition-all ${
                    locked
                      ? 'bg-white/60'
                      : 'bg-white shadow-sm hover:shadow-xl hover:shadow-violet-600/5'
                  }`}
                >
                  {/* ロックオーバーレイ */}
                  {locked && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/10 backdrop-blur-[2px]">
                      <Lock className="w-10 h-10 text-slate-400 opacity-40" />
                    </div>
                  )}

                  {/* トップ行: アバター + PRO バッジ */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`h-16 w-16 rounded-full ${locked ? 'bg-slate-100/50 text-slate-400' : `${GENDER_COLOR_BG[speaker.gender]} ${GENDER_COLOR_TEXT[speaker.gender]}`} text-2xl font-black flex items-center justify-center`}>
                      {getInitial(speaker.name)}
                    </div>
                    <span className="rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700 tracking-wider">
                      PRO
                    </span>
                  </div>

                  {/* 名前 */}
                  <h3 className={`text-xl font-black mb-1 ${locked ? 'text-slate-400' : 'text-slate-900'}`}>{speaker.name}</h3>

                  {/* 説明 */}
                  <p className={`text-sm line-clamp-2 mb-4 ${locked ? 'text-slate-400' : 'text-slate-500'}`}>{speaker.description}</p>

                  {/* タグ */}
                  <div className="flex gap-2 flex-wrap mb-6">
                    <span className={`rounded-lg px-2 py-1 text-xs font-medium ${locked ? 'bg-slate-100 text-slate-400' : GENDER_TAG_STYLE[speaker.gender]}`}>
                      {GENDER_LABEL[speaker.gender]}
                    </span>
                    <span className={`rounded-lg px-2 py-1 text-xs font-medium ${locked ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                      {speaker.characteristics}
                    </span>
                  </div>

                  {/* ボタン */}
                  <div className="mt-auto flex gap-3 relative z-20">
                    {locked ? (
                      <>
                        <button
                          disabled
                          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-slate-400 cursor-not-allowed"
                        >
                          試聴
                        </button>
                        <Link
                          href="/voice/pricing"
                          className="flex flex-[2] items-center justify-center gap-1 rounded-xl bg-slate-200 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-300 transition-colors"
                        >
                          アップグレード
                        </Link>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => togglePlay(speaker)}
                          disabled={loadingId === speaker.id}
                          className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-sm font-bold transition-colors ${
                            playingId === speaker.id
                              ? 'bg-violet-600 text-white hover:bg-violet-700'
                              : 'bg-violet-600/10 text-violet-600 hover:bg-violet-600/20'
                          }`}
                        >
                          {loadingId === speaker.id ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> 読込中</>
                          ) : playingId === speaker.id ? (
                            <><Pause className="w-4 h-4" /> 停止</>
                          ) : (
                            <><Play className="w-4 h-4" /> 試聴</>
                          )}
                        </button>
                        <Link
                          href={`/voice/new?speaker=${speaker.id}`}
                          className="flex flex-[2] items-center justify-center gap-1 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white hover:bg-violet-600/90 transition-colors"
                        >
                          この声で生成
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
