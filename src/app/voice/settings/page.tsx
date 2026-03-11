'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Save, SlidersHorizontal, Bell, AlertTriangle, Trash2, User } from 'lucide-react'
import { getAllSpeakers } from '@/lib/voice/speakers'
import { isVoiceProFromUser } from '@/lib/voice/plans'

const STORAGE_KEY = 'doya_voice_settings'

interface VoiceSettings {
  defaultSpeakerId: string
  defaultSpeed: number
  defaultPitch: number
  defaultVolume: number
  defaultPauseLength: string
  defaultEmotionTone: string
  defaultOutputFormat: string
}

const DEFAULT_SETTINGS: VoiceSettings = {
  defaultSpeakerId: 'akira',
  defaultSpeed: 1.0,
  defaultPitch: 0,
  defaultVolume: 100,
  defaultPauseLength: 'standard',
  defaultEmotionTone: 'neutral',
  defaultOutputFormat: 'mp3',
}

export default function VoiceSettingsPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const isPro = isVoiceProFromUser(user)

  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [notifyOnComplete, setNotifyOnComplete] = useState(true)
  const [notifyEmail, setNotifyEmail] = useState(false)
  const speakers = getAllSpeakers()

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) })
      const savedTime = localStorage.getItem(STORAGE_KEY + '_saved_at')
      if (savedTime) setLastSavedAt(savedTime)
    } catch {}
  }, [])

  const save = () => {
    const now = new Date()
    const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    localStorage.setItem(STORAGE_KEY + '_saved_at', timeStr)
    setLastSavedAt(timeStr)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const update = (key: keyof VoiceSettings, value: string | number) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return '?'
    const parts = user.name.split(/[\s　]+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return user.name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900">設定</h1>
        <p className="text-slate-500 mt-1">アカウントと生成環境のカスタマイズを行います</p>
      </div>

      {/* Account Info Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        {user ? (
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-black text-lg flex-shrink-0">
              {getUserInitials()}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 truncate">{user.name || 'ユーザー'}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  isPro
                    ? 'bg-violet-100 text-violet-600'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {isPro ? 'PRO' : 'FREE'}
                </span>
              </div>
              <p className="text-sm text-slate-400 truncate mt-0.5">{user.email || ''}</p>
            </div>
            {/* Plan Change Button */}
            <Link
              href="/voice/pricing"
              className="flex-shrink-0 px-4 py-2 rounded-xl border border-violet-200 text-violet-600 text-sm font-bold hover:bg-violet-50 transition-colors"
            >
              プランを変更
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-slate-500 text-sm">ログインしてください</p>
            </div>
          </div>
        )}
      </div>

      {/* Default Generation Settings Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 mb-6">
          <SlidersHorizontal className="w-5 h-5 text-violet-600" />
          デフォルト生成設定
        </h2>

        <div className="space-y-6">
          {/* Voice / Tone - 2-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* デフォルトボイス */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">ボイスキャラクター</label>
              <select
                value={settings.defaultSpeakerId}
                onChange={e => update('defaultSpeakerId', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none bg-white"
              >
                {speakers.map(s => (
                  <option key={s.id} value={s.id} disabled={s.isPro && !isPro}>
                    {s.name}（{s.gender === 'male' ? '男性' : s.gender === 'female' ? '女性' : '中性'}・{s.ageGroup}）
                    {s.isPro && !isPro ? ' [PRO]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 感情トーン */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">感情トーン</label>
              <select
                value={settings.defaultEmotionTone}
                onChange={e => update('defaultEmotionTone', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none bg-white"
              >
                <option value="neutral">ニュートラル</option>
                <option value="bright">明るい</option>
                <option value="calm">落ち着き</option>
                <option value="serious">真剣</option>
                <option value="gentle">やさしい</option>
              </select>
            </div>
          </div>

          {/* 話速 */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm font-bold text-slate-700">話速</label>
              <span className="text-sm font-mono text-violet-600 font-bold">{settings.defaultSpeed.toFixed(1)}x</span>
            </div>
            <input type="range" min={0.5} max={2.0} step={0.1}
              value={settings.defaultSpeed}
              onChange={e => update('defaultSpeed', Number(e.target.value))}
              className="w-full accent-violet-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>0.5x</span>
              <span>2.0x</span>
            </div>
          </div>

          {/* ピッチ */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm font-bold text-slate-700">ピッチ</label>
              <span className="text-sm font-mono text-violet-600 font-bold">{settings.defaultPitch > 0 ? `+${settings.defaultPitch}` : settings.defaultPitch}st</span>
            </div>
            <input type="range" min={-10} max={10} step={1}
              value={settings.defaultPitch}
              onChange={e => update('defaultPitch', Number(e.target.value))}
              className="w-full accent-violet-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>-10st</span>
              <span>+10st</span>
            </div>
          </div>

          {/* 出力形式 - Radio-style cards */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">出力形式</label>
            <div className="grid grid-cols-2 gap-3">
              {/* MP3 */}
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="outputFormat"
                  value="mp3"
                  checked={settings.defaultOutputFormat === 'mp3'}
                  onChange={() => update('defaultOutputFormat', 'mp3')}
                  className="peer sr-only"
                />
                <div className="p-3 text-center rounded-xl border-2 border-slate-200 transition-all peer-checked:border-violet-600 peer-checked:bg-violet-50 hover:border-slate-300">
                  <div className="font-bold text-slate-900 text-sm">MP3</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">軽量・標準的</div>
                </div>
              </label>

              {/* WAV */}
              <label className={!isPro ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}>
                <input
                  type="radio"
                  name="outputFormat"
                  value="wav"
                  checked={settings.defaultOutputFormat === 'wav'}
                  onChange={() => update('defaultOutputFormat', 'wav')}
                  disabled={!isPro}
                  className="peer sr-only"
                />
                <div className={`p-3 text-center rounded-xl border-2 border-slate-200 transition-all ${
                  isPro ? 'peer-checked:border-violet-600 peer-checked:bg-violet-50 hover:border-slate-300' : ''
                }`}>
                  <div className="font-bold text-slate-900 text-sm">
                    WAV
                    {!isPro && <span className="ml-1 text-[10px] text-violet-500 font-black">PRO</span>}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">高音質・非圧縮</div>
                </div>
              </label>

              {/* OGG */}
              <label className={!isPro ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}>
                <input
                  type="radio"
                  name="outputFormat"
                  value="ogg"
                  checked={settings.defaultOutputFormat === 'ogg'}
                  onChange={() => update('defaultOutputFormat', 'ogg')}
                  disabled={!isPro}
                  className="peer sr-only"
                />
                <div className={`p-3 text-center rounded-xl border-2 border-slate-200 transition-all ${
                  isPro ? 'peer-checked:border-violet-600 peer-checked:bg-violet-50 hover:border-slate-300' : ''
                }`}>
                  <div className="font-bold text-slate-900 text-sm">
                    OGG
                    {!isPro && <span className="ml-1 text-[10px] text-violet-500 font-black">PRO</span>}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Web向け軽量</div>
                </div>
              </label>

              {/* M4A */}
              <label className={!isPro ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}>
                <input
                  type="radio"
                  name="outputFormat"
                  value="m4a"
                  checked={settings.defaultOutputFormat === 'm4a'}
                  onChange={() => update('defaultOutputFormat', 'm4a')}
                  disabled={!isPro}
                  className="peer sr-only"
                />
                <div className={`p-3 text-center rounded-xl border-2 border-slate-200 transition-all ${
                  isPro ? 'peer-checked:border-violet-600 peer-checked:bg-violet-50 hover:border-slate-300' : ''
                }`}>
                  <div className="font-bold text-slate-900 text-sm">
                    M4A
                    {!isPro && <span className="ml-1 text-[10px] text-violet-500 font-black">PRO</span>}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Apple互換</div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Settings Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 mb-6">
          <Bell className="w-5 h-5 text-violet-600" />
          通知設定
        </h2>

        <div className="space-y-4">
          {/* 音声生成完了通知 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-700">音声生成完了</p>
              <p className="text-xs text-slate-400 mt-0.5">アプリ内通知</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnComplete}
                onChange={() => setNotifyOnComplete(!notifyOnComplete)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-violet-600 peer-focus:ring-2 peer-focus:ring-violet-500/20 after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner" />
            </label>
          </div>

          <div className="border-t border-slate-100" />

          {/* メール通知 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-700">メール通知</p>
              <p className="text-xs text-slate-400 mt-0.5">お知らせやアップデート</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={() => setNotifyEmail(!notifyEmail)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-violet-600 peer-focus:ring-2 peer-focus:ring-violet-500/20 after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-inner" />
            </label>
          </div>
        </div>
      </div>

      {/* Data Management Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 mb-6">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          データ管理
        </h2>

        <div className="p-4 rounded-xl bg-red-50 border border-red-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-red-700 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" />
                全プロジェクトを削除
              </p>
              <p className="text-xs text-red-400 mt-1">
                すべての生成済み音声・プロジェクトデータを完全に削除します。この操作は元に戻せません。
              </p>
            </div>
            <button
              onClick={() => alert('この機能は現在準備中です')}
              className="flex-shrink-0 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
            >
              削除する
            </button>
          </div>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => alert('この機能は現在準備中です')}
            className="text-xs text-slate-400 hover:text-red-400 transition-colors underline underline-offset-2"
          >
            アカウントを完全に削除する
          </button>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={save}
        className={`w-full py-4 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-2 ${
          saved
            ? 'bg-green-500 text-white shadow-xl shadow-green-500/30'
            : 'bg-violet-600 hover:bg-violet-700 text-white shadow-xl shadow-violet-600/30'
        }`}
      >
        {saved ? '保存しました' : <><Save className="w-5 h-5" />設定を保存</>}
      </button>
      <p className="text-center text-xs text-slate-400">
        {lastSavedAt ? `最終保存: ${lastSavedAt}` : 'ブラウザに保存されます'}
      </p>
    </div>
  )
}
