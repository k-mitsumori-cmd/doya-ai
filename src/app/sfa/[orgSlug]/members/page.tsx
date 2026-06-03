'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

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

export default function SfaMembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [myRole, setMyRole] = useState('member')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [busy, setBusy] = useState(false)

  const load = () => {
    fetch('/api/sfa/members', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setMembers(d.members || [])
        setMyRole(d.myRole || 'member')
      })
      .catch(() => {})
  }
  useEffect(load, [])

  const canInvite = myRole === 'admin' || myRole === 'owner'

  const invite = async () => {
    if (!email.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/sfa/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
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

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <h1 className="text-2xl font-black text-slate-900 mb-1">メンバー</h1>
      <p className="text-slate-500 font-bold text-sm mb-6">チームを招待して、一緒に営業管理を。</p>

      {canInvite && (
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
              <option value="member">メンバー</option>
              <option value="manager">マネージャー</option>
              <option value="admin">管理者</option>
            </select>
            <button onClick={invite} disabled={busy} className="px-5 py-3 rounded-xl bg-green-600 text-white font-black disabled:opacity-50 whitespace-nowrap">
              {busy ? '送信中…' : '招待する'}
            </button>
          </div>
          <p className="text-[11px] font-bold text-slate-400 mt-2">招待リンクの有効期限は48時間です。</p>
        </div>
      )}

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="font-black text-slate-800 truncate">{m.name || m.inviteEmail || '（招待中）'}</p>
              <p className="text-xs font-bold text-slate-400">{ROLE_LABEL[m.role] || m.role}</p>
            </div>
            <span
              className={`text-[11px] font-black rounded-full px-2.5 py-1 ${
                m.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : m.status === 'PENDING' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {STATUS_LABEL[m.status] || m.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
