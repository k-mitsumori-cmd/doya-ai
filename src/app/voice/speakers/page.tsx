'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Play, Pause, Star } from 'lucide-react'
import { getAllSpeakers, type VoiceSpeaker } from '@/lib/voice/speakers'
import Link from 'next/link'

const GENDER_LABEL = { male: '男性', female: '女性', neutral: '中性' }
const GENDER_COLOR = {
  male: 'bg-blue-100 text-blue-700',
  female: 'bg-pink-100 text-pink-700',
  neutral: 'bg-purple-100 text-purple-700',
}
const AGE_LABEL: Record<string, string> = {
  '10s': '10代', '20s': '20代', '30s': '30代', '40s': '40代', '50s': '50代',
}

export default function SpeakersPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const isPro = ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(
    String(user?.voicePlan || user?.plan || '').toUpperCase()
  )

  const speakers = getAllSpeakers()
  const [filter, setFilter] = useState<'all' | 'male' | 'female' | 'neutral'>('all')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)
  const [currentBlobUrl, setCurrentBlobUrl] = useState<string | null>(null)

  const filtered = filter === 'all' ? speakers : speakers.filter(s => s.gender === filter)

  const togglePlay = async (speaker: VoiceSpeaker) => {
    if (playingId === speaker.id) {
      audioEl?.pause()
      setPlayingId(null)
      if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); setCurrentBlobUrl(null) }
      return
    }
    audioEl?.pause()
    if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); setCurrentBlobUrl(null) }

    // サンプル音声取得 (audioBase64 → Blob URL)
    const res = await fetch(`/api/voice/speakers/${speaker.id}/sample`)
    if (!res.ok) return
    const data = await res.json()
    if (!data.audioBase64) return

    const byteChars = atob(data.audioBase64)
    const byteArr = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
    const blob = new Blob([byteArr], { type: 'audio/mpeg' })
    const blobUrl = URL.createObjectURL(blob)

    const audio = new Audio(blobUrl)
    audio.play()
    audio.onended = () => { setPlayingId(null); URL.revokeObjectURL(blobUrl); setCurrentBlobUrl(null) }
    setAudioEl(audio)
    setCurrentBlobUrl(blobUrl)
    setPlayingId(speaker.id)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">ボイスキャラクター</h1>
        <p className="text-sm text-slate-500 mt-1">12種類の声質から最適なキャラクターを選んでください</p>
      </div>

      {/* フィルター */}
      <div className="flex gap-2">
        {(['all', 'male', 'female', 'neutral'] as const).map(g => (
          <button
            key={g}
            onClick={() => setFilter(g)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              filter === g
                ? 'bg-violet-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700'
            }`}
          >
            {g === 'all' ? 'すべて' : GENDER_LABEL[g]}
          </button>
        ))}
      </div>

      {/* スピーカー一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(speaker => {
          const locked = speaker.isPro && !isPro
          return (
            <div
              key={speaker.id}
              className={`relative p-5 rounded-2xl border-2 transition-all ${
                locked
                  ? 'border-slate-200 bg-slate-50 opacity-70'
                  : 'border-slate-200 bg-white hover:border-violet-300 hover:shadow-md'
              }`}
            >
              {locked && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 rounded-full">
                  <Star className="w-3 h-3" />
                  PRO
                </div>
              )}

              <div className="flex items-start gap-4">
                {/* アバター */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
                  speaker.gender === 'male' ? 'bg-blue-100' : speaker.gender === 'female' ? 'bg-pink-100' : 'bg-purple-100'
                }`}>
                  {speaker.gender === 'male' ? '👨' : speaker.gender === 'female' ? '👩' : '🧑'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-slate-900 text-lg">{speaker.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${GENDER_COLOR[speaker.gender]}`}>
                      {GENDER_LABEL[speaker.gender]}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {AGE_LABEL[speaker.ageGroup] ?? speaker.ageGroup}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-1">{speaker.description}</p>
                  <p className="text-xs text-slate-400 mb-3">用途: {speaker.useCases.join('、')}</p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => !locked && togglePlay(speaker)}
                      disabled={locked}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                        locked
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : playingId === speaker.id
                          ? 'bg-violet-600 text-white hover:bg-violet-700'
                          : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                      }`}
                    >
                      {playingId === speaker.id ? (
                        <><Pause className="w-3.5 h-3.5" /> 停止</>
                      ) : (
                        <><Play className="w-3.5 h-3.5" /> 試聴</>
                      )}
                    </button>
                    {!locked && (
                      <Link
                        href={`/voice/new?speaker=${speaker.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        この声で生成 →
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* タグ */}
              <div className="flex gap-1 mt-3 flex-wrap">
                {speaker.tags.map(tag => (
                  <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* アップグレード誘導 */}
      {!isPro && (
        <div className="p-6 bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border border-violet-200 text-center">
          <p className="text-lg font-black text-violet-900 mb-1">全12キャラクターを使うには</p>
          <p className="text-sm text-violet-700 mb-4">Proプランにアップグレードすると、全キャラクター + 詳細パラメータ調整が使えます</p>
          <Link
            href="/voice/pricing"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-xl font-black text-sm hover:bg-violet-700 transition-colors"
          >
            Proプランを見る →
          </Link>
        </div>
      )}
    </div>
  )
}
