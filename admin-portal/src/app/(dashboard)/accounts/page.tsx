'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { KeyRound, Loader2, Plus, Trash2 } from 'lucide-react'
import type { AdminAccountPublic, AdminRole } from '@/lib/accounts/types'

const ROLES: Array<{ id: AdminRole; label: string; desc: string }> = [
  { id: 'owner', label: 'Owner', desc: '全権限（アカウント管理含む）' },
  { id: 'admin', label: 'Admin', desc: '管理権限（アカウント管理可）' },
  { id: 'operator', label: 'Operator', desc: '運用（閲覧＋運用操作）' },
  { id: 'viewer', label: 'Viewer', desc: '閲覧のみ' },
]

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  const data = (await res.json().catch(() => ({}))) as any
  if (!res.ok) throw new Error(data?.error || res.statusText)
  return data as T
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AdminAccountPublic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<AdminRole>('viewer')
  const [newPassword, setNewPassword] = useState('')

  const load = async () => {
    setIsLoading(true)
    try {
      const data = await jsonFetch<{ accounts: AdminAccountPublic[] }>('/api/admin/accounts', { cache: 'no-store' })
      setAccounts(data.accounts)
      setForbidden(false)
    } catch (e) {
      const msg = (e as Error).message || '取得に失敗しました'
      if (msg === 'forbidden') setForbidden(true)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const byId = useMemo(() => {
    const m = new Map<string, AdminAccountPublic>()
    for (const a of accounts) m.set(a.id, a)
    return m
  }, [accounts])

  const handleCreate = async () => {
    if (!newEmail.trim()) return toast.error('メールアドレスが必要です')
    if (!newPassword || newPassword.length < 10) return toast.error('パスワードは10文字以上にしてください')

    setIsSaving(true)
    try {
      await jsonFetch('/api/admin/accounts', {
        method: 'POST',
        body: JSON.stringify({ email: newEmail, name: newName || newEmail, role: newRole, password: newPassword }),
      })
      toast.success('アカウントを追加しました')
      setNewEmail('')
      setNewName('')
      setNewRole('viewer')
      setNewPassword('')
      await load()
    } catch (e) {
      toast.error((e as Error).message || '追加に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRoleChange = async (id: string, role: AdminRole) => {
    setIsSaving(true)
    try {
      await jsonFetch(`/api/admin/accounts/${id}`, { method: 'PUT', body: JSON.stringify({ role }) })
      toast.success('権限を更新しました')
      await load()
    } catch (e) {
      toast.error((e as Error).message || '更新に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetPassword = async (id: string) => {
    const email = byId.get(id)?.email || ''
    const pw = window.prompt(`新しいパスワードを入力（10文字以上）\n対象: ${email}`)
    if (!pw) return
    if (pw.length < 10) return toast.error('10文字以上にしてください')

    setIsSaving(true)
    try {
      await jsonFetch(`/api/admin/accounts/${id}`, { method: 'PUT', body: JSON.stringify({ password: pw }) })
      toast.success('パスワードを更新しました')
      await load()
    } catch (e) {
      toast.error((e as Error).message || '更新に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const email = byId.get(id)?.email || ''
    if (!window.confirm(`削除しますか？\n${email}`)) return
    setIsSaving(true)
    try {
      await jsonFetch(`/api/admin/accounts/${id}`, { method: 'DELETE' })
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="p-8">
        <div className="card">
          <h1 className="text-xl font-bold text-gray-900 mb-2">権限がありません</h1>
          <p className="text-gray-600">
            「アカウント権限」の閲覧/編集は <span className="font-semibold">Owner</span> または <span className="font-semibold">Admin</span> のみ可能です。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <KeyRound className="w-7 h-7 text-gray-600" />
            アカウント権限
          </h1>
          <p className="text-gray-600">アカウントごとの権限（ロール）を管理します</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">メール</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">名前</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">権限</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">最終ログイン</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {accounts.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-mono text-sm text-gray-900">{a.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{a.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          className="input-field py-2 w-auto"
                          value={a.role}
                          disabled={isSaving || a.role === 'owner'}
                          onChange={(e) => handleRoleChange(a.id, e.target.value as AdminRole)}
                        >
                          {ROLES.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('ja-JP') : '-'}</p>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          className="btn-secondary text-sm mr-2"
                          disabled={isSaving}
                          onClick={() => handleResetPassword(a.id)}
                        >
                          パスワード再設定
                        </button>
                        <button
                          className="btn-secondary text-sm"
                          disabled={isSaving || a.role === 'owner'}
                          onClick={() => handleDelete(a.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {accounts.length === 0 ? (
                    <tr>
                      <td className="px-6 py-6 text-sm text-gray-500" colSpan={5}>
                        アカウントがありません
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-gray-400" />
              アカウント追加
            </h3>
            <div className="space-y-3">
              <input className="input-field" placeholder="メール" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <input className="input-field" placeholder="表示名（任意）" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <select className="input-field" value={newRole} onChange={(e) => setNewRole(e.target.value as AdminRole)}>
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}（{r.desc}）
                  </option>
                ))}
              </select>
              <input className="input-field" placeholder="初期パスワード（10文字以上）" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <button className="btn-primary w-full" disabled={isSaving} onClick={handleCreate}>
                追加
              </button>
              <p className="text-xs text-gray-500">
                ※本実装のアカウント情報はサーバーメモリ（簡易）です。本番運用ではDB永続化を推奨します。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


