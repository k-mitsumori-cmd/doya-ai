'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { sfaInit } from '@/lib/sfa/client'

interface Member {
  id: string
  name: string | null
  role: string
  status: string
  inviteEmail: string | null
  acceptedAt: string | null
}
const ROLE_LABEL: Record<string, string> = { owner: 'オーナー', admin: '管理者', manager: 'マネージャー', member: 'メンバー' }
const STATUS_LABEL: Record<string, string> = { ACTIVE: '参加中', PENDING: '招待中', INACTIVE: '無効' }
const ASSIGNABLE = [
  { value: 'member', label: 'メンバー' },
  { value: 'manager', label: 'マネージャー' },
  { value: 'admin', label: '管理者' },
]
const RANK: Record<string, number> = { member: 0, manager: 1, admin: 2, owner: 3 }

export default function SfaMembersPage() {
  const orgSlug = (useParams().orgSlug as string) || ''
  const { status } = useSession()
  const ready = status === 'authenticated' && !!orgSlug
  const [members, setMembers] = useState<Member[]>([])
  const [myRole, setMyRole] = useState('member')
  const [myMemberId, setMyMemberId] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    if (!ready) return
    fetch('/api/sfa/members', sfaInit(orgSlug))
      .then((r) => r.json())
      .then((d) => {
        setMembers(d.members || [])
        setMyRole(d.myRole || 'member')
        setMyMemberId(d.myMemberId || '')
      })
      .catch(() => {})
  }, [ready, orgSlug])
  useEffect(() => load(), [load])

  const canManage = myRole === 'admin' || myRole === 'owner'
  // 自分より下位の権限のみ付与可能（サーバ側と一致）
  const assignable = ASSIGNABLE.filter((r) => RANK[r.value] < (RANK[myRole] ?? 0))

  const invite = async () => {
    if (!email.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/sfa/members', sfaInit(orgSlug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setEmail('')
      toast.success('招待メールを送信しました')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (m: Member, newRole: string) => {
    if (newRole === m.role) return
    // 楽観更新
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role: newRole } : x)))
    try {
      const res = await fetch(`/api/sfa/members/${m.id}`, sfaInit(orgSlug, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      toast.success('権限を変更しました')
    } catch (e: any) {
      toast.error(e.message)
      load()
    }
  }

  const remove = async (m: Member) => {
    const label = m.status === 'PENDING' ? '招待を取り消しますか？' : `${m.name || m.inviteEmail} を削除しますか？`
    if (!window.confirm(label)) return
    try {
      const res = await fetch(`/api/sfa/members/${m.id}`, sfaInit(orgSlug, { method: 'DELETE' }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      toast.success(m.status === 'PENDING' ? '招待を取り消しました' : '削除しました')
      setMembers((prev) => prev.filter((x) => x.id !== m.id))
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <h1 className="text-2xl font-black text-slate-900 mb-1">メンバー</h1>
      <p className="text-slate-500 font-bold text-sm mb-6">チームを招待し、権限を管理できます。</p>

      {canManage && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <p className="font-black text-slate-700 mb-3">メンバーを招待</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="invite@example.com"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-bold"
            />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 font-bold">
              {assignable.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <button onClick={invite} disabled={busy} className="px-5 py-3 rounded-xl bg-green-600 text-white font-black disabled:opacity-50 whitespace-nowrap">
              {busy ? '送信中…' : '招待する'}
            </button>
          </div>
          <p className="text-[11px] font-bold text-slate-400 mt-2">招待リンクの有効期限は48時間です。</p>
        </div>
      )}

      <div className="space-y-2">
        {members.map((m) => {
          const isSelf = m.id === myMemberId
          // 自分より下位のメンバーのみ編集可（サーバ側と一致）
          const editable = canManage && !isSelf && RANK[m.role] < (RANK[myRole] ?? 0)
          return (
            <div key={m.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-slate-800 truncate">
                  {m.name || m.inviteEmail || '（招待中）'}
                  {isSelf && <span className="ml-2 text-[10px] font-black text-green-600">あなた</span>}
                </p>
                {m.inviteEmail && m.name && <p className="text-[11px] font-bold text-slate-400 truncate">{m.inviteEmail}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {editable ? (
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m, e.target.value)}
                    className="text-xs font-black rounded-lg border border-slate-200 px-2 py-1.5 bg-slate-50"
                  >
                    {ASSIGNABLE.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-black text-slate-500">{ROLE_LABEL[m.role] || m.role}</span>
                )}
                <span
                  className={`text-[11px] font-black rounded-full px-2.5 py-1 ${
                    m.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : m.status === 'PENDING' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {STATUS_LABEL[m.status] || m.status}
                </span>
                {editable && (
                  <button
                    onClick={() => remove(m)}
                    title={m.status === 'PENDING' ? '招待を取り消す' : '削除'}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
