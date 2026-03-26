'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Settings,
  Save,
  RefreshCw,
  Mail,
  Clock,
  Shield,
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface DripSettings {
  fromName: string
  fromEmail: string
  replyTo: string
  timezone: string
  sendWindowStart: string
  sendWindowEnd: string
  rateLimit: number
  unsubscribeEnabled: boolean
  unsubscribeFooterText: string
}

const DEFAULT_SETTINGS: DripSettings = {
  fromName: '',
  fromEmail: '',
  replyTo: '',
  timezone: 'Asia/Tokyo',
  sendWindowStart: '09:00',
  sendWindowEnd: '21:00',
  rateLimit: 100,
  unsubscribeEnabled: true,
  unsubscribeFooterText:
    'このメールの配信停止をご希望の場合は、以下のリンクからお手続きください。',
}

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Tokyo', label: '日本標準時 (JST)' },
  { value: 'UTC', label: '協定世界時 (UTC)' },
  { value: 'America/New_York', label: '米国東部標準時 (EST)' },
  { value: 'America/Los_Angeles', label: '米国太平洋標準時 (PST)' },
  { value: 'Europe/London', label: '英国標準時 (GMT)' },
  { value: 'Asia/Shanghai', label: '中国標準時 (CST)' },
  { value: 'Asia/Seoul', label: '韓国標準時 (KST)' },
]

export default function DripSettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<DripSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/drip/settings', {
        credentials: 'include',
      })
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error()
      }
      const data = await res.json()
      const s = data.settings ?? data
      setSettings({
        fromName: s.fromName ?? '',
        fromEmail: s.fromEmail ?? '',
        replyTo: s.replyTo ?? '',
        timezone: s.timezone ?? 'Asia/Tokyo',
        sendWindowStart: s.sendWindowStart ?? '09:00',
        sendWindowEnd: s.sendWindowEnd ?? '21:00',
        rateLimit: s.rateLimit ?? 100,
        unsubscribeEnabled: s.unsubscribeEnabled ?? true,
        unsubscribeFooterText: s.unsubscribeFooterText ?? DEFAULT_SETTINGS.unsubscribeFooterText,
      })
    } catch {
      toast.error('設定の取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    if (!settings.fromEmail.trim()) {
      toast.error('送信元メールアドレスは必須です')
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/drip/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error()
      toast.success('設定を保存しました')
    } catch {
      toast.error('設定の保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const updateField = <K extends keyof DripSettings>(
    field: K,
    value: DripSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-8">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-violet-400" />
            ドリップ設定
          </h1>
          <p className="text-white/50 text-sm mt-1">
            メール配信の基本設定
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 rounded-xl font-medium text-sm transition-colors"
        >
          {isSaving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          保存
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="max-w-3xl space-y-6">
          {/* 送信元情報 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/[0.02] border border-white/10 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold flex items-center gap-2 mb-5">
              <Mail className="w-5 h-5 text-violet-400" />
              送信元情報
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/50 mb-1.5">
                  送信者名
                </label>
                <input
                  type="text"
                  value={settings.fromName}
                  onChange={(e) => updateField('fromName', e.target.value)}
                  placeholder="例: ドヤAI"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1.5">
                  送信元メールアドレス <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  value={settings.fromEmail}
                  onChange={(e) => updateField('fromEmail', e.target.value)}
                  placeholder="例: noreply@doya-ai.surisuta.jp"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-white/50 mb-1.5">
                  返信先メールアドレス
                </label>
                <input
                  type="email"
                  value={settings.replyTo}
                  onChange={(e) => updateField('replyTo', e.target.value)}
                  placeholder="例: support@surisuta.jp"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
            </div>
          </motion.div>

          {/* 配信制御 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/[0.02] border border-white/10 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold flex items-center gap-2 mb-5">
              <Clock className="w-5 h-5 text-violet-400" />
              配信制御
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/50 mb-1.5">
                  タイムゾーン
                </label>
                <select
                  value={settings.timezone}
                  onChange={(e) => updateField('timezone', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 transition-colors appearance-none"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value} className="bg-[#1a1a2e]">
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1.5">
                  レート制限（件/時間）
                </label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={settings.rateLimit}
                  onChange={(e) =>
                    updateField('rateLimit', parseInt(e.target.value) || 100)
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1.5">
                  配信開始時刻
                </label>
                <input
                  type="time"
                  value={settings.sendWindowStart}
                  onChange={(e) =>
                    updateField('sendWindowStart', e.target.value)
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1.5">
                  配信終了時刻
                </label>
                <input
                  type="time"
                  value={settings.sendWindowEnd}
                  onChange={(e) =>
                    updateField('sendWindowEnd', e.target.value)
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
            </div>
          </motion.div>

          {/* 配信停止 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/[0.02] border border-white/10 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold flex items-center gap-2 mb-5">
              <Shield className="w-5 h-5 text-violet-400" />
              配信停止（Unsubscribe）
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">配信停止リンクを有効にする</p>
                  <p className="text-xs text-white/30 mt-0.5">
                    全メールのフッターに配信停止リンクを自動挿入します
                  </p>
                </div>
                <button
                  onClick={() =>
                    updateField(
                      'unsubscribeEnabled',
                      !settings.unsubscribeEnabled
                    )
                  }
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{
                    backgroundColor: settings.unsubscribeEnabled
                      ? 'rgba(16,185,129,0.4)'
                      : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.unsubscribeEnabled
                        ? 'translate-x-[22px]'
                        : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {settings.unsubscribeEnabled && (
                <div>
                  <label className="block text-sm text-white/50 mb-1.5">
                    フッターテキスト
                  </label>
                  <textarea
                    value={settings.unsubscribeFooterText}
                    onChange={(e) =>
                      updateField('unsubscribeFooterText', e.target.value)
                    }
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 transition-colors resize-y"
                  />
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
