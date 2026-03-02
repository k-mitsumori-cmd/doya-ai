'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Save, Loader2 } from 'lucide-react'
import { getAllSpeakers } from '@/lib/voice/speakers'

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
  const isPro = ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(
    String(user?.voicePlan || user?.plan || '').toUpperCase()
  )

  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const speakers = getAllSpeakers()

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) })
    } catch {}
  }, [])

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const update = (key: keyof VoiceSettings, value: string | number) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">デフォルト設定</h1>
        <p className="text-sm text-slate-500 mt-1">新規生成時の初期値を設定します（ブラウザに保存）</p>
      </div>

      <div className="space-y-5 bg-white rounded-2xl border border-slate-200 p-6">
        {/* デフォルトボイス */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">デフォルトボイスキャラクター</label>
          <select
            value={settings.defaultSpeakerId}
            onChange={e => update('defaultSpeakerId', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
          >
            {speakers.map(s => (
              <option key={s.id} value={s.id} disabled={s.isPro && !isPro}>
                {s.name}（{s.gender === 'male' ? '男性' : s.gender === 'female' ? '女性' : '中性'}・{s.ageGroup}）
                {s.isPro && !isPro ? ' [PRO]' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 話速 */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-bold text-slate-700">デフォルト話速</label>
            <span className="text-sm font-mono text-violet-600">{settings.defaultSpeed.toFixed(1)}x</span>
          </div>
          <input type="range" min={0.5} max={2.0} step={0.1}
            value={settings.defaultSpeed}
            onChange={e => update('defaultSpeed', Number(e.target.value))}
            className="w-full accent-violet-600"
          />
        </div>

        {/* ピッチ */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-bold text-slate-700">デフォルトピッチ</label>
            <span className="text-sm font-mono text-violet-600">{settings.defaultPitch > 0 ? `+${settings.defaultPitch}` : settings.defaultPitch}st</span>
          </div>
          <input type="range" min={-10} max={10} step={1}
            value={settings.defaultPitch}
            onChange={e => update('defaultPitch', Number(e.target.value))}
            className="w-full accent-violet-600"
          />
        </div>

        {/* 感情トーン */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">デフォルト感情トーン</label>
          <select
            value={settings.defaultEmotionTone}
            onChange={e => update('defaultEmotionTone', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
          >
            <option value="neutral">ニュートラル</option>
            <option value="bright">明るい</option>
            <option value="calm">落ち着き</option>
            <option value="serious">真剣</option>
            <option value="gentle">やさしい</option>
          </select>
        </div>

        {/* 出力形式 */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">デフォルト出力形式</label>
          <div className="flex gap-2">
            {(['mp3', 'wav', 'ogg', 'm4a'] as const).map(fmt => (
              <button
                key={fmt}
                onClick={() => update('defaultOutputFormat', fmt)}
                disabled={!isPro && fmt !== 'mp3'}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                  settings.defaultOutputFormat === fmt
                    ? 'bg-violet-600 text-white'
                    : !isPro && fmt !== 'mp3'
                    ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                    : 'bg-slate-100 text-slate-600 hover:bg-violet-100'
                }`}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={save}
        className={`w-full py-3 rounded-xl font-black text-sm transition-colors flex items-center justify-center gap-2 ${
          saved ? 'bg-green-500 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'
        }`}
      >
        {saved ? '✓ 保存しました' : <><Save className="w-4 h-4" />設定を保存</>}
      </button>
    </div>
  )
}
