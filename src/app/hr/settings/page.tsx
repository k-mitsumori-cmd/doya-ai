'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface AuditLog {
  id: string
  action: string
  actor: string
  target?: string
  timestamp: string
}

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

interface Department {
  id: string
  name: string
  code: string | null
  sortOrder: number
  employeeCount: number
}

const MEMBER_AVATAR_COLORS = [
  'from-blue-500 to-blue-600',
  'from-red-400 to-red-500',
  'from-emerald-500 to-emerald-600',
  'from-amber-400 to-amber-500',
  'from-purple-500 to-purple-600',
  'from-pink-400 to-pink-500',
]

const DEPT_COLOR_BARS = [
  'bg-blue-500',
  'bg-red-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
]

function getColorByIndex(arr: string[], name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return arr[Math.abs(hash) % arr.length]
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
  const [departments, setDepartments] = useState<Department[]>([])
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [newDeptName, setNewDeptName] = useState('')
  const [newDeptCode, setNewDeptCode] = useState('')
  const [newDeptSortOrder, setNewDeptSortOrder] = useState(0)
  const [creatingDept, setCreatingDept] = useState(false)
  const [deletingDeptId, setDeletingDeptId] = useState<string | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [inviteUrl, setInviteUrl] = useState('')
  const [inviteUrlCopied, setInviteUrlCopied] = useState(false)
  const [generatingInviteUrl, setGeneratingInviteUrl] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferEmail, setTransferEmail] = useState('')
  const [transferring, setTransferring] = useState(false)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const [settingsRes, deptRes] = await Promise.all([
          fetch('/api/hr/settings'),
          fetch('/api/hr/departments'),
        ])
        if (settingsRes.ok) {
          const data = await settingsRes.json()
          if (data.settings) setSettings(data.settings)
          if (data.members) setMembers(data.members)
        }
        if (deptRes.ok) {
          const deptData = await deptRes.json()
          setDepartments(
            (deptData.flat ?? deptData.departments ?? []).map((d: any) => ({
              id: d.id,
              name: d.name,
              code: d.code,
              sortOrder: d.sortOrder ?? 0,
              employeeCount: d.employeeCount ?? d._count?.employees ?? 0,
            }))
          )
        }
        // Fetch audit logs
        try {
          const logRes = await fetch('/api/hr/audit-logs?pageSize=10')
          if (logRes.ok) {
            const logData = await logRes.json()
            const rawLogs = logData.items ?? logData.logs ?? []
            setAuditLogs(rawLogs.map((l: any) => ({
              id: l.id,
              action: l.action,
              actor: l.userName || l.actor || '',
              target: l.target || '',
              timestamp: l.createdAt || l.timestamp || '',
            })))
          }
        } catch {}
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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '招待の送信に失敗しました')
      setInviteEmail('')
      if (data.inviteUrl) {
        setInviteUrl(data.inviteUrl)
      }
      const settingsRes = await fetch('/api/hr/settings')
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        if (settingsData.members) setMembers(settingsData.members)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setInviting(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/hr/departments')
      if (res.ok) {
        const data = await res.json()
        setDepartments(
          (data.flat ?? data.departments ?? []).map((d: any) => ({
            id: d.id,
            name: d.name,
            code: d.code,
            sortOrder: d.sortOrder ?? 0,
            employeeCount: d.employeeCount ?? d._count?.employees ?? 0,
          }))
        )
      }
    } catch {}
  }

  const handleCreateDept = async () => {
    if (!newDeptName) return
    setCreatingDept(true)
    setError(null)
    try {
      const res = await fetch('/api/hr/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeptName, code: newDeptCode || null, sortOrder: newDeptSortOrder }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || '部署の作成に失敗しました')
      }
      setNewDeptName('')
      setNewDeptCode('')
      setNewDeptSortOrder(0)
      setShowDeptModal(false)
      await fetchDepartments()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreatingDept(false)
    }
  }

  const handleDeleteDept = async (id: string) => {
    setDeletingDeptId(id)
    setError(null)
    try {
      const res = await fetch(`/api/hr/departments/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || '部署の削除に失敗しました')
      }
      await fetchDepartments()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeletingDeptId(null)
    }
  }

  const handleGenerateInviteUrl = async () => {
    setGeneratingInviteUrl(true)
    setError(null)
    try {
      const res = await fetch('/api/hr/organization/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `invite-${Date.now()}@placeholder.local`, role: 'MEMBER' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '招待URLの生成に失敗しました')
      const url = data.inviteUrl || `${window.location.origin}/hr/invite/${data.invitation?.token}`
      setInviteUrl(url)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGeneratingInviteUrl(false)
    }
  }

  const handleCopyInviteUrl = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setInviteUrlCopied(true)
      setTimeout(() => setInviteUrlCopied(false), 2000)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = inviteUrl
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setInviteUrlCopied(true)
      setTimeout(() => setInviteUrlCopied(false), 2000)
    }
  }

  const handleTransferOwnership = async () => {
    if (!transferEmail) return
    setTransferring(true)
    setError(null)
    try {
      // メールアドレスから対象メンバーを特定
      const targetMember = members.find((m) => m.email === transferEmail)
      if (!targetMember) {
        throw new Error('指定されたメールアドレスのメンバーが見つかりません')
      }
      const res = await fetch('/api/hr/organization/transfer-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetMemberId: targetMember.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'オーナー移譲に失敗しました')
      }
      setShowTransferModal(false)
      setTransferEmail('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setTransferring(false)
    }
  }

  const AUDIT_ACTION_MAP: Record<string, { icon: string; color: string; label: string }> = {
    MEMBER_INVITED: { icon: 'person_add', color: 'text-blue-600', label: 'メンバー招待' },
    MEMBER_JOINED: { icon: 'group_add', color: 'text-emerald-600', label: 'メンバー参加' },
    MEMBER_REMOVED: { icon: 'person_remove', color: 'text-red-500', label: 'メンバー削除' },
    SETTINGS_UPDATED: { icon: 'settings', color: 'text-slate-600', label: '設定変更' },
    DEPARTMENT_CREATED: { icon: 'apartment', color: 'text-amber-600', label: '部署作成' },
    DEPARTMENT_DELETED: { icon: 'delete', color: 'text-red-500', label: '部署削除' },
    EVALUATION_CREATED: { icon: 'assessment', color: 'text-red-500', label: '評価作成' },
    ROLE_CHANGED: { icon: 'admin_panel_settings', color: 'text-purple-600', label: '権限変更' },
    OWNER_TRANSFERRED: { icon: 'swap_horiz', color: 'text-amber-600', label: 'オーナー移譲' },
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-32 bg-slate-200 rounded" />
          <div className="h-64 bg-slate-100 rounded-3xl" />
          <div className="h-40 bg-slate-100 rounded-3xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900">設定</h1>
            <img
              src="/hr/characters/thumbsup_いいね.png"
              alt="白くまキャラクター"
              className="w-14"
            />
          </div>
          <p className="text-sm text-slate-500 mt-1">組織情報とメンバーを管理</p>
        </div>

        {/* Error / Success */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-2xl text-sm text-red-700">
            <span className="material-symbols-outlined text-lg align-middle mr-1">error</span>
            {error}
            <span className="text-red-500 ml-1">もう一度お試しください。</span>
          </div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-emerald-50 rounded-2xl text-sm text-emerald-700 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg align-middle">check_circle</span>
            設定を保存しました
            <img
              src="/hr/characters/success_成功.png"
              alt="白くまキャラクター"
              className="w-10 inline-block ml-1"
            />
          </motion.div>
        )}

        {/* 1. Department Management — most frequently used */}
        <div className="bg-white rounded-3xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-500">apartment</span>
              </div>
              部署管理
            </h2>
            <button
              onClick={() => setShowDeptModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg hover:bg-blue-700 transition-all"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              部署を追加
            </button>
          </div>

          {departments.length > 0 ? (
            <div className="space-y-2">
              {departments.map((dept) => {
                const barColor = getColorByIndex(DEPT_COLOR_BARS, dept.name)
                return (
                  <div key={dept.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-10 rounded-full ${barColor}`} />
                      <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center">
                        <span className="material-symbols-outlined text-sm text-slate-500">apartment</span>
                      </div>
                      <div>
                        <p className="text-base font-bold text-slate-900">{dept.name}</p>
                        <p className="text-xs text-slate-500">
                          {dept.code ? `${dept.code} / ` : ''}表示順: {dept.sortOrder} / {dept.employeeCount}名
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
                        {dept.employeeCount}名
                      </span>
                      {dept.employeeCount === 0 && (
                        <button
                          onClick={() => handleDeleteDept(dept.id)}
                          disabled={deletingDeptId === dept.id}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="削除"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {deletingDeptId === dept.id ? 'hourglass_empty' : 'delete'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <span className="material-symbols-outlined text-4xl mb-2 block text-amber-300">apartment</span>
              <p className="text-sm font-bold text-slate-700">まだ部署が作成されていません</p>
              <p className="text-xs mt-1">「部署を追加」ボタンから作成してください</p>
            </div>
          )}
        </div>

        {/* Department Create Modal */}
        {showDeptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowDeptModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md mx-4"
            >
              <h2 className="text-lg font-bold text-slate-900 mb-4">部署を追加</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    部署名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="例: 営業部"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">部署コード</label>
                    <input
                      type="text"
                      value={newDeptCode}
                      onChange={(e) => setNewDeptCode(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                      placeholder="例: SALES"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">表示順</label>
                    <input
                      type="number"
                      min={0}
                      value={newDeptSortOrder}
                      onChange={(e) => setNewDeptSortOrder(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowDeptModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCreateDept}
                  disabled={creatingDept || !newDeptName}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {creatingDept ? '作成中...' : '作成'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 2. Members */}
        <div className="bg-white rounded-3xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600">group</span>
            </div>
            メンバー管理
          </h2>

          {/* Invite by email */}
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="メールアドレスで招待"
              className="flex-1 px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">send</span>
              {inviting ? '送信中...' : '招待'}
            </button>
          </div>

          {/* Invite URL */}
          <div className="mb-4 p-4 rounded-2xl bg-slate-50">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-sm text-slate-500">link</span>
              <span className="text-sm font-bold text-slate-700">招待URLで招待</span>
            </div>
            {inviteUrl ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 truncate"
                />
                <motion.button
                  onClick={handleCopyInviteUrl}
                  whileTap={{ scale: 0.95 }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    inviteUrlCopied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {inviteUrlCopied ? 'check' : 'content_copy'}
                  </span>
                  {inviteUrlCopied ? 'コピー済み!' : 'コピー'}
                </motion.button>
              </div>
            ) : (
              <button
                onClick={handleGenerateInviteUrl}
                disabled={generatingInviteUrl}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">add_link</span>
                {generatingInviteUrl ? '生成中...' : '招待URLを生成'}
              </button>
            )}
          </div>

          {/* Member List */}
          {members.length > 0 ? (
            <div className="space-y-2">
              {members.map((member) => {
                const avatarColor = getColorByIndex(MEMBER_AVATAR_COLORS, member.name || member.email)
                return (
                  <div key={member.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                        {member.name?.[0] || member.email[0]}
                      </div>
                      <div>
                        <p className="text-base font-bold text-slate-900">{member.name || member.email}</p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                      member.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {member.role === 'ADMIN' ? '管理者' : 'メンバー'}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-lg font-bold text-slate-500 text-center py-4">まだメンバーはいません</p>
          )}
        </div>

        {/* 3. Organization Info */}
        <div className="bg-white rounded-3xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600">apartment</span>
            </div>
            組織情報
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">組織名</label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                placeholder="株式会社サンプル"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">業種</label>
                <input
                  type="text"
                  value={settings.industry}
                  onChange={(e) => setSettings({ ...settings, industry: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  placeholder="IT・ソフトウェア"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">従業員規模</label>
                <select
                  value={settings.employeeScale}
                  onChange={(e) => setSettings({ ...settings, employeeScale: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
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
              <label className="block text-sm font-bold text-slate-700 mb-1">期首月</label>
              <select
                value={settings.fiscalYearStart}
                onChange={(e) => setSettings({ ...settings, fiscalYearStart: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
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
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full text-base font-bold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>

        {/* Evaluation Templates */}
        <div className="bg-white rounded-3xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-red-500">description</span>
            </div>
            評価テンプレート
          </h2>
          <div className="text-center py-8 text-slate-500">
            <span className="material-symbols-outlined text-4xl mb-2 block text-slate-300">construction</span>
            <p className="text-sm font-bold text-slate-700">評価テンプレートの管理機能は準備中です</p>
            <p className="text-xs mt-1">現在はデフォルトのMBO形式で評価を実施できます</p>
          </div>
        </div>

        {/* Audit Logs */}
        <div className="bg-white rounded-3xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-indigo-600">history</span>
            </div>
            監査ログ
          </h2>
          {auditLogs.length > 0 ? (
            <div className="space-y-2">
              {auditLogs.map((log) => {
                const actionInfo = AUDIT_ACTION_MAP[log.action] ?? {
                  icon: 'info',
                  color: 'text-slate-500',
                  label: log.action,
                }
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                      <span className={`material-symbols-outlined text-sm ${actionInfo.color}`}>
                        {actionInfo.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{actionInfo.label}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {log.actor}
                        {log.target && <> → {log.target}</>}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {log.timestamp && !isNaN(new Date(log.timestamp).getTime())
                        ? new Date(log.timestamp).toLocaleDateString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <span className="material-symbols-outlined text-4xl mb-2 block text-indigo-200">history</span>
              <p className="text-sm font-bold text-slate-700">監査ログはまだありません</p>
              <p className="text-xs mt-1">組織での操作が記録されます</p>
            </div>
          )}
        </div>

        {/* Danger Zone: Owner Transfer */}
        <div className="bg-white rounded-3xl shadow-md p-6 border border-red-100">
          <h2 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-red-500">warning</span>
            </div>
            危険な操作
          </h2>
          <div className="flex items-center justify-between p-4 rounded-2xl bg-red-50">
            <div>
              <p className="text-sm font-bold text-slate-900">オーナー権限の移譲</p>
              <p className="text-xs text-slate-500 mt-0.5">
                組織のオーナー権限を別のメンバーに移譲します。この操作は取り消せません。
              </p>
            </div>
            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-full text-sm font-bold hover:bg-red-50 transition-all"
            >
              <span className="material-symbols-outlined text-sm">swap_horiz</span>
              移譲する
            </button>
          </div>
        </div>

        {/* Owner Transfer Modal */}
        {showTransferModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowTransferModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md mx-4"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-red-500">warning</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">オーナー権限の移譲</h2>
                  <p className="text-xs text-red-500 font-bold">この操作は取り消せません</p>
                </div>
              </div>
              <div className="mb-4 p-3 bg-red-50 rounded-xl">
                <p className="text-sm text-red-700">
                  オーナー権限を移譲すると、あなたの権限は「管理者」に変更されます。
                  新しいオーナーは組織の全設定を変更できるようになります。
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  新しいオーナーのメールアドレス
                </label>
                <input
                  type="email"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-red-500 focus:bg-white transition-all"
                  placeholder="example@company.com"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleTransferOwnership}
                  disabled={transferring || !transferEmail}
                  className="flex items-center gap-2 px-6 py-2.5 bg-red-500 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">swap_horiz</span>
                  {transferring ? '処理中...' : '移譲を実行'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
