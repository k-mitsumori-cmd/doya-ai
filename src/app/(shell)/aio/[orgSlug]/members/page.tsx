'use client'

import { useParams } from 'next/navigation'
import { useOrgTeamMembers } from '@/lib/use-org-team-members'
import { ROLE_LABEL } from '@/lib/aio/types'
import { PageHeader } from '@/components/aio/ui'
import { InviteDeliveryNotice } from '@/components/InviteDeliveryNotice'

const sym = (name: string, size = 18) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>

export default function AioMembersPage() {
  const params = useParams<{ orgSlug: string }>()
  const orgSlug = String(params.orgSlug)
  const { members, myRole, email, role, loaded, canManage, busy, unknown, loading, error, notice, inviteUrl, requiresLogin,
    setEmail, setRole, canRemove, invite, remove, load } = useOrgTeamMembers('aio', orgSlug)
  const disabled = !!busy || unknown || !loaded

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <PageHeader mood="thumbsup" icon="group" title="メンバー" subtitle="チームを招待して、自社ブランドのAI検索での露出状況と監視設定を共有します。組織ごとに情報は分離されています。" />

      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}
      {unknown && <p role="status" className="mb-4 text-sm text-amber-900">操作結果が未確認のため再送信を停止しています。メンバー一覧を再確認してください。</p>}
      {requiresLogin && <p role="alert" className="mb-4 text-sm text-rose-700">ログインしてメンバー情報をご確認ください。<a className="ml-2 underline" href={`/api/auth/signin?callbackUrl=${encodeURIComponent(`/aio/${encodeURIComponent(orgSlug)}/members`)}`}>ログインする</a></p>}
      {(unknown || !loaded) && !requiresLogin && <button type="button" disabled={!!busy || loading} onClick={() => void load()} className="mb-4 text-sm font-semibold underline">メンバー一覧を再確認する</button>}
      {inviteUrl ? <InviteDeliveryNotice key={inviteUrl} url={inviteUrl} /> : null}

      {canManage && (
        <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm mb-6">
          <div className="font-black text-slate-700 text-sm mb-3 flex items-center gap-1">{sym('person_add', 18)}メンバーを招待</div>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="email" aria-label="招待する方のメールアドレス" maxLength={254} disabled={disabled}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-sm focus:border-purple-400 outline-none"
            />
            <select aria-label="招待する方の権限" disabled={disabled} value={role} onChange={(e) => setRole(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 font-bold text-sm">
              <option value="member">メンバー</option>
              <option value="manager">マネージャー</option>
              {myRole === 'owner' && <option value="admin">管理者</option>}
            </select>
            <button onClick={invite} disabled={disabled || !email.trim()} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-sm shadow-md disabled:opacity-50">
              {busy === 'invite' ? '送信中…' : '招待を送る'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {error ? (
          <div role="alert" className="p-8 text-center">
            <p className="font-bold text-rose-700">{error}</p>
            <button disabled={!!busy || loading} onClick={() => void load()} className="mt-4 rounded-xl border border-rose-300 px-5 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50">再試行</button>
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-slate-400 font-bold">読み込み中…</div>
        ) : (
          (members || []).map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 last:border-0">
              <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                {(m.name || m.inviteEmail || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-slate-900 truncate">{m.name || m.inviteEmail || '（招待中）'}</div>
                <div className="text-xs font-bold text-slate-400">{ROLE_LABEL[m.role as keyof typeof ROLE_LABEL] || m.role}</div>
              </div>
              {m.status === 'PENDING' && <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">招待中</span>}
              {m.status === 'INACTIVE' && <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">無効</span>}
              {m.role === 'owner' && <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">オーナー</span>}
              {canRemove(m.id) && (
                <button disabled={disabled} onClick={() => remove(m.id)} className="text-slate-300 hover:text-rose-500 transition-colors" title="削除">{sym('delete', 18)}</button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
