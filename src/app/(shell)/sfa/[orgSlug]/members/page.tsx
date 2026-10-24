'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { InviteDeliveryNotice } from '@/components/InviteDeliveryNotice'
import { sfaInit } from '@/lib/sfa/client'
import SfaPageHeading from '@/components/sfa/PageHeading'
import SfaLoadError from '@/components/sfa/SfaLoadError'
import { useUiNext } from '@/components/shell/ui-next-context'
import { Trash2 } from 'lucide-react'
import { confirmDialog } from '@/components/ds/dialog'

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
  const uiNext = useUiNext()
  const orgSlug = (useParams().orgSlug as string) || ''
  const ready = !!orgSlug
  const [members, setMembers] = useState<Member[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading')
  // 新しい見た目のとき、失敗の種類（ログイン切れ・権限なし・通信）で案内を変えるために、HTTP の状態を持つ（画面には出さない）
  const [loadStatus, setLoadStatus] = useState(0)
  const [myRole, setMyRole] = useState('member')
  const [myMemberId, setMyMemberId] = useState('')
  const requestSeq = useRef(0)
  const invalidateRequests = useCallback(() => { requestSeq.current++ }, [])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [busy, setBusy] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')

  const load = useCallback(() => {
    if (!ready) return
    const seq = ++requestSeq.current
    setLoadState('loading')
    setLoadStatus(0)
    setMyRole('member')
    setMyMemberId('')
    fetch('/api/sfa/members', sfaInit(orgSlug))
      .then(async (r) => {
        if (!r.ok) { if (requestSeq.current === seq) setLoadStatus(r.status); throw new Error('Members request failed') }
        return r.json()
      })
      .then((d) => {
        if (!Array.isArray(d.members) || typeof d.myRole !== 'string') throw new Error('Invalid members response')
        if (requestSeq.current !== seq) return
        setMembers(d.members)
        setMyRole(d.myRole)
        setMyMemberId(typeof d.myMemberId === 'string' ? d.myMemberId : '')
        setLoadState('ready')
      })
      .catch(() => { if (requestSeq.current === seq) setLoadState('error') })
  }, [ready, orgSlug])
  useEffect(() => {
    load()
    return invalidateRequests
  }, [load, invalidateRequests])

  const canManage = loadState === 'ready' && (myRole === 'admin' || myRole === 'owner')
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
      setInviteUrl(d.emailSent ? '' : d.inviteUrl || '')
      if (d.emailSent) toast.success('招待メールを送信しました')
      else toast.error('招待メールの送信を確認できませんでした。招待リンクをご確認ください。')
      load()
    } catch (e: any) {
      toast.error(/[ぁ-んァ-ヶ一-龠]/.test(String(e?.message ?? '')) ? e.message : '招待できませんでした。通信を確かめて、もう一度お試しください。')
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
      toast.error(/[ぁ-んァ-ヶ一-龠]/.test(String(e?.message ?? '')) ? e.message : '権限を変えられませんでした。通信を確かめて、もう一度お試しください。')
      load()
    }
  }

  const remove = async (m: Member) => {
    const pendingInvite = m.status === 'PENDING'
    const ok = await confirmDialog(pendingInvite
      ? { title: `${m.inviteEmail || m.name} への招待を取り消しますか？`, message: '送った招待のリンクは使えなくなります。', confirmLabel: '取り消す', tone: 'danger' }
      : { title: `${m.name || m.inviteEmail} をメンバーから外しますか？`, message: 'この組織のデータを見られなくなります。', confirmLabel: '削除する', tone: 'danger' })
    if (!ok) return
    try {
      const res = await fetch(`/api/sfa/members/${m.id}`, sfaInit(orgSlug, { method: 'DELETE' }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      toast.success(m.status === 'PENDING' ? '招待を取り消しました' : '削除しました')
      setMembers((prev) => prev.filter((x) => x.id !== m.id))
    } catch (e: any) {
      toast.error(/[ぁ-んァ-ヶ一-龠]/.test(String(e?.message ?? '')) ? e.message : '削除できませんでした。通信を確かめて、もう一度お試しください。')
    }
  }

  return (
    <div className={uiNext ? 'p-4 sm:p-6 lg:p-10 max-w-3xl mx-auto' : 'p-6 lg:p-10 max-w-3xl mx-auto'}>
      <SfaPageHeading className="text-2xl font-black text-slate-900 mb-1">メンバー</SfaPageHeading>
      <p className="text-slate-500 font-bold text-sm mb-6">チームを招待し、権限を管理できます。</p>

      {canManage && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <p className="font-black text-slate-700 mb-3">メンバーを招待</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="invite@example.com"
              aria-label="招待するメールアドレス"
              className={uiNext ? 'min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 font-bold' : 'flex-1 rounded-xl border border-slate-200 px-4 py-3 font-bold'}
            />
            <select aria-label="招待する権限" value={role} onChange={(e) => setRole(e.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 font-bold">
              {assignable.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <button onClick={invite} disabled={busy} className="min-h-11 px-5 py-3 rounded-xl bg-green-600 text-white font-black disabled:opacity-50 whitespace-nowrap">
              {busy ? '送信中…' : '招待する'}
            </button>
          </div>
          <p className="text-[11px] font-bold text-slate-400 mt-2">招待リンクの有効期限は48時間です。</p>
          {inviteUrl ? <InviteDeliveryNotice key={inviteUrl} url={inviteUrl} /> : null}
        </div>
      )}

      <div className="space-y-2">
        {loadState === 'loading' ? (
          <p className="py-8 text-center text-slate-500">読み込み中…</p>
        ) : loadState === 'error' && uiNext ? (
          <SfaLoadError error={loadStatus} what="メンバー一覧" onRetry={load} orgSlug={orgSlug} />
        ) : loadState === 'error' ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center">
            <p className="font-bold text-rose-700">メンバー一覧を読み込めませんでした。時間をおいて再試行してください。</p>
            <button onClick={load} className="mt-4 rounded-xl border border-rose-300 bg-white px-5 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100">再試行</button>
          </div>
        ) : members.map((m) => {
          const isSelf = m.id === myMemberId
          // 自分より下位のメンバーのみ編集可（サーバ側と一致）
          const editable = canManage && !isSelf && RANK[m.role] < (RANK[myRole] ?? 0)
          return (
            <div key={m.id} className={uiNext ? 'bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-center justify-between gap-3' : 'bg-white rounded-xl shadow-sm p-4 flex items-center justify-between gap-3'}>
              <div className={uiNext ? 'min-w-0 flex-1' : 'min-w-0'}>
                <p className="font-black text-slate-800 truncate">
                  {m.name || m.inviteEmail || '（招待中）'}
                  {isSelf && <span className="ml-2 text-[10px] font-black text-green-600 whitespace-nowrap">あなた</span>}
                </p>
                {m.inviteEmail && m.name && <p className="text-[11px] font-bold text-slate-400 truncate">{m.inviteEmail}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {editable ? (
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m, e.target.value)}
                    aria-label={`${m.name || m.inviteEmail || '招待中のメンバー'}の権限`}
                    className={uiNext ? 'min-h-11 text-xs font-black rounded-lg border border-slate-200 px-2 py-1.5 bg-slate-50' : 'text-xs font-black rounded-lg border border-slate-200 px-2 py-1.5 bg-slate-50'}
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
                    aria-label={m.status === 'PENDING' ? `${m.inviteEmail || 'この招待'}の招待を取り消す` : `${m.name || m.inviteEmail || 'このメンバー'}を削除`}
                    className={uiNext ? 'grid h-11 w-11 place-items-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066ff]' : 'text-slate-300 hover:text-red-500 transition-colors'}
                  >
                    {uiNext ? <Trash2 className="h-5 w-5" aria-hidden /> : <span className="material-symbols-outlined text-[20px]">delete</span>}
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
