'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface OrgSettings {
  id?: string
  name: string
  industry: string
  employeeScale: string
  fiscalYearStart: string
}

interface OrgMember {
  id: string
  name: string
  email: string
  role: string
  joinedAt: string
}

export default function HrSettingsPage() {
  const [settings, setSettings] = useState<OrgSettings>({
    name: '',
    industry: '',
    employeeScale: '',
    fiscalYearStart: '04',
  })
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/hr/settings')
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (data.settings) setSettings(data.settings)
        if (data.members) setMembers(data.members)
      } catch {
        // API not ready
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/api/hr/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('設定の保存に失敗しました')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail) return
    setInviting(true)
    setError(null)
    try {
      const res = await fetch('/api/hr/organization/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      })
      if (!res.ok) throw new Error('招待の送信に失敗しました')
      setInviteEmail('')
      // Re-fetch members
      const settingsRes = await fetch('/api/hr/settings')
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        if (data.members) setMembers(data.members)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setInviting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-32 bg-slate-200 rounded" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
          <div className="h-40 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900">設定</h1>
          <p className="text-sm text-slate-500 mt-1">組織情報とメンバーを管理</p>
        </div>

        {/* Error / Success */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <span className="material-symbols-outlined text-lg align-middle mr-1">error</span>
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
            <span className="material-symbols-outlined text-lg align-middle mr-1">check_circle</span>
            設定を保存しました
          </div>
        )}

        {/* Organization Info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sky-500">apartment</span>
            組織情報
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">組織名</label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                placeholder="株式会社サンプル"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">業種</label>
                <input
                  type="text"
                  value={settings.industry}
                  onChange={(e) => setSettings({ ...settings, industry: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                  placeholder="IT・ソフトウェア"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">従業員規模</label>
                <select
                  value={settings.employeeScale}
                  onChange={(e) => setSettings({ ...settings, employeeScale: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                >
                  <option value="">選択してください</option>
                  <option value="1-10">1〜10名</option>
                  <option value="11-30">11〜30名</option>
                  <option value="31-50">31〜50名</option>
                  <option value="51-100">51〜100名</option>
                  <option value="101-300">101〜300名</option>
                  <option value="301+">301名以上</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">期首月</label>
              <select
                value={settings.fiscalYearStart}
                onChange={(e) => setSettings({ ...settings, fiscalYearStart: e.target.value })}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const month = String(i + 1).padStart(2, '0')
                  return (
                    <option key={month} value={month}>{i + 1}月</option>
                  )
                })}
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>

        {/* Members */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sky-500">group</span>
            メンバー
          </h2>

          {/* Invite */}
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="メールアドレスで招待"
              className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
            />
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail}
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 text-sky-600 rounded-xl text-sm font-semibold hover:bg-sky-100 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">send</span>
              {inviting ? '送信中...' : '招待'}
            </button>
          </div>

          {/* Member List */}
          {members.length > 0 ? (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                      {member.name?.[0] || member.email[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{member.name || member.email}</p>
                      <p className="text-xs text-slate-400">{member.email}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    member.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {member.role === 'ADMIN' ? '管理者' : 'メンバー'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">まだメンバーはいません</p>
          )}
        </div>

        {/* Evaluation Templates */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sky-500">description</span>
            評価テンプレート
          </h2>
          <div className="text-center py-8 text-slate-400">
            <span className="material-symbols-outlined text-3xl mb-2 block">construction</span>
            <p className="text-sm">評価テンプレートの管理機能は準備中です</p>
            <p className="text-xs mt-1">現在はデフォルトのMBO形式で評価を実施できます</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
