'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { shodanGet, shodanSend } from '@/lib/shodan/client'
import { ROLE_LABEL, type ShodanRole } from '@/lib/shodan/types'
import toast from 'react-hot-toast'

const sym = (name: string, size = 18) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>

type Member = { id: string; name: string | null; role: string; status: string; inviteEmail: string | null; acceptedAt: string | null }

export default function ShodanMembersPage() {
  const params = useParams<{ orgSlug: string }>()
  const orgSlug = decodeURIComponent(String(params.orgSlug))
  const [members, setMembers] = useState<Member[] | null>(null)
  const [myRole, setMyRole] = useState<ShodanRole>('member')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ShodanRole>('member')
  const [inviting, setInviting] = useState(false)

  const load = () => {
    shodanGet<{ members: Member[]; myRole: ShodanRole }>('/api/shodan/members', orgSlug)
      .then((d) => { setMembers(d.members); setMyRole(d.myRole) })
      .catch((e) => { toast.error(e.message); setMembers([]) })
  }
  useEffect(load, [orgSlug])

  const canManage = myRole === 'admin' || myRole === 'owner'

  const invite = async () => {
    if (!email.trim()) { toast.error('メールアドレスを入力してください'); return }
    setInviting(true)
    try {
      await shodanSend('/api/shodan/members', orgSlug, 'POST', { email, role })
      toast.success('招待メールを送信しました')
      setEmail('')
      load()
    } catch (e: any) { toast.error(e.message) } finally { setInviting(false) }
  }

  const remove = async (m: Member) => {
    if (!confirm(`${m.name || m.inviteEmail || 'このメンバー'}を削除しますか？`)) return
    try {
      await shodanSend(`/api/shodan/members/${m.id}`, orgSlug, 'DELETE')
      setMembers((prev) => (prev || []).filter((x) => x.id !== m.id))
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-black text-slate-900">メンバー</h1>
      <p className="text-sm font-bold text-slate-400 mt-1 mb-6">チームを招待して、商談準備・自社情報を共有できます。組織ごとに情報は分離されています。</p>

      {canManage && (
        <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm mb-6">
          <div className="font-black text-slate-700 text-sm mb-3 flex items-center gap-1">{sym('person_add', 18)}メンバーを招待</div>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-sm focus:border-purple-400 outline-none"
            />
            <select value={role} onChange={(e) => setRole(e.target.value as ShodanRole)} className="rounded-xl border border-slate-200 px-3 py-2.5 font-bold text-sm">
              <option value="member">メンバー</option>
              <option value="manager">マネージャー</option>
              {myRole === 'owner' && <option value="admin">管理者</option>}
            </select>
            <button onClick={invite} disabled={inviting} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-sm shadow-md disabled:opacity-50">
              {inviting ? '送信中…' : '招待を送る'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {members === null ? (
          <div className="p-8 text-center text-slate-400 font-bold">読み込み中…</div>
        ) : (
          members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 last:border-0">
              <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                {(m.name || m.inviteEmail || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-slate-900 truncate">{m.name || m.inviteEmail || '（招待中）'}</div>
                <div className="text-xs font-bold text-slate-400">{ROLE_LABEL[m.role as ShodanRole] || m.role}</div>
              </div>
              {m.status === 'PENDING' && <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">招待中</span>}
              {m.role === 'owner' && <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">オーナー</span>}
              {canManage && m.role !== 'owner' && (
                <button onClick={() => remove(m)} className="text-slate-300 hover:text-rose-500 transition-colors" title="削除">{sym('delete', 18)}</button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
