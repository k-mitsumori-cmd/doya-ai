'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import toast, { Toaster } from 'react-hot-toast'
import { Shield, UserPlus, RefreshCw, Trash2, ToggleLeft, ToggleRight, KeyRound } from 'lucide-react'

type AdminUser = {
  id: string
  username: string
  email: string | null
  name: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    credentials: 'include',
  })
  const data = (await res.json().catch(() => ({}))) as any
  if (!res.ok) throw new Error(data?.error || res.statusText)
  return data as T
}

export default function AdminAdminUsersPage() {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  const load = async () => {
    setIsLoading(true)
    try {
      const data = await jsonFetch<{ adminUsers: AdminUser[] }>('/api/admin/admin-users', { cache: 'no-store' })
      setAdminUsers(data.adminUsers)
    } catch (e) {
      toast.error((e as Error).message || '取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const byId = useMemo(() => new Map(adminUsers.map((u) => [u.id, u])), [adminUsers])

  const createAdmin = async () => {
    if (!email.trim()) return toast.error('メールが必要です')
    if (!password) return toast.error('パスワードが必要です')
    setIsSaving(true)
    try {
      // usernameは未指定にすると email が使われます（emailログイン前提）
      await jsonFetch('/api/admin/admin-users', {
        method: 'POST',
        body: JSON.stringify({ email, name, password }),
      })
      toast.success('管理者を追加しました')
      setPassword('')
      await load()
    } catch (e) {
      toast.error((e as Error).message || '追加に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleActive = async (id: string) => {
    const u = byId.get(id)
    if (!u) return
    setIsSaving(true)
    try {
      await jsonFetch(`/api/admin/admin-users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !u.isActive }),
      })
      toast.success('更新しました')
      await load()
    } catch (e) {
      toast.error((e as Error).message || '更新に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const resetPassword = async (id: string) => {
    const u = byId.get(id)
    const label = u?.email || u?.username || id
    const pw = window.prompt(`新しいパスワード（要件あり）\n対象: ${label}`)
    if (!pw) return
    setIsSaving(true)
    try {
      await jsonFetch(`/api/admin/admin-users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ password: pw }),
      })
      toast.success('パスワードを更新しました')
      await load()
    } catch (e) {
      toast.error((e as Error).message || '更新に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const removeAdmin = async (id: string) => {
    const u = byId.get(id)
    const label = u?.email || u?.username || id
    if (!window.confirm(`削除しますか？\n${label}`)) return
    setIsSaving(true)
    try {
      await jsonFetch(`/api/admin/admin-users/${id}`, { method: 'DELETE' })
      toast.success('削除しました')
      await load()
    } catch (e) {
      toast.error((e as Error).message || '削除に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-white/60">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <Toaster position="top-right" />
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="w-6 h-6 text-violet-300" />
            管理者アカウント
          </h1>
          <p className="text-white/50 mt-1">
            管理者（AdminUser）の追加/無効化/パスワード再設定/削除を行います。ログインIDはメールでOKです。
          </p>
        </div>
        <button
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all flex items-center gap-2"
          onClick={load}
          disabled={isSaving}
        >
          <RefreshCw className="w-4 h-4" />
          再読み込み
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="text-white font-semibold">管理者一覧</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 bg-white/[0.02]">
                  <th className="text-left px-6 py-3">ログインID</th>
                  <th className="text-left px-6 py-3">名前</th>
                  <th className="text-left px-6 py-3">状態</th>
                  <th className="text-left px-6 py-3">最終ログイン</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {adminUsers.map((u) => (
                  <tr key={u.id} className="text-white/80">
                    <td className="px-6 py-4 font-mono">
                      {u.email || u.username}
                      <div className="text-[11px] text-white/40">username: {u.username}</div>
                    </td>
                    <td className="px-6 py-4">{u.name || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[11px] border ${u.isActive ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' : 'border-red-500/30 text-red-300 bg-red-500/10'}`}>
                        {u.isActive ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white/50">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('ja-JP') : '-'}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all mr-2"
                        disabled={isSaving}
                        onClick={() => resetPassword(u.id)}
                        title="パスワード再設定"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all mr-2"
                        disabled={isSaving}
                        onClick={() => toggleActive(u.id)}
                        title={u.isActive ? '無効化' : '有効化'}
                      >
                        {u.isActive ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                      </button>
                      <button
                        className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/15 transition-all"
                        disabled={isSaving}
                        onClick={() => removeAdmin(u.id)}
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {adminUsers.length === 0 ? (
                  <tr>
                    <td className="px-6 py-6 text-white/50" colSpan={5}>
                      管理者がまだ作成されていません（bootstrap設定 or CLIで作成してください）
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white/[0.03] border border-white/10 rounded-2xl p-6"
        >
          <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-violet-300" />
            管理者を追加
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-white/50 mb-2">メール（ログインID）</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-2">表示名（任意）</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
                placeholder="mitsumori"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-2">初期パスワード</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
                placeholder="12文字以上 + 大/小/数/記号"
              />
              <p className="text-[11px] text-white/40 mt-2">
                ※ パスワード要件: 12文字以上＋大文字/小文字/数字/記号
              </p>
            </div>
            <button
              onClick={createAdmin}
              disabled={isSaving}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold hover:opacity-90 transition-all disabled:opacity-50"
            >
              追加
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}







