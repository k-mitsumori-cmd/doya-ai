'use client'

// ============================================
// 組織メンバーの管理（組織スコープ型サービス共通）
// ============================================
// 招待・権限変更・除名。サービスごとにAPIの接頭辞だけ differs するため、
// basePath を受け取って使い回す。
//
// ⚠️ サーバ側の権限判定を UI で代替しないこと。ここでボタンを隠すのは
//    体験のためであり、実際の防御は API 側（hasMinRole）が行う。

import { useOrgMemberManagement } from '@/lib/use-org-member-management'
import type { OrganizationMemberRow, MemberService } from '@/lib/org-member-response'
export type MemberRow = OrganizationMemberRow

const ROLE_LABEL: Record<string, string> = {
  owner: 'オーナー',
  admin: '管理者',
  manager: 'マネージャー',
  member: 'メンバー',
}
const ROLE_RANK: Record<string, number> = { owner: 4, admin: 3, manager: 2, member: 1 }

export interface MemberPanelProps {
  /** 例: '/api/quote' */
  basePath: string
  /** 'quote' / 'aishodan' — ?org= の付与に使う */
  service: MemberService
  /** 招待された人が何を扱えるようになるかの説明 */
  description: string
}

export default function MemberPanel({ basePath, service, description }: MemberPanelProps) {
  const {members,myRole,myUserId,loading,email,role,busy,inviteUrl,error,notice,loaded,canManage,unknown,
    setEmail,setRole,invite,changeRole,remove,load,session}=useOrgMemberManagement(service,basePath)
  const disabled=!!busy||unknown||!loaded

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-bold text-slate-900">メンバー</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>

      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{notice}</p>}

      {unknown && <p role="status" className="mt-3 text-sm text-amber-800">操作結果が未確認のため再送信を停止しています。</p>}
      {(!loaded || unknown || error) && <button type="button" disabled={!!busy || loading} onClick={() => void load()} className="mt-3 text-sm font-semibold underline">メンバー情報を再読み込みする</button>}
      {loading ? (
        <p className="mt-4 text-sm text-slate-500">読み込み中...</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {members.map((m) => {
            const isMe = Boolean(m.userId && m.userId === myUserId)
            const editable = canManage && m.role !== 'owner' && !isMe && ROLE_RANK[m.role] < ROLE_RANK[myRole]
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {m.name || (isMe ? session?.user?.name : null) || m.inviteEmail || '（名前未設定）'}
                    {isMe && <span className="ml-2 text-[11px] text-slate-500">あなた</span>}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {ROLE_LABEL[m.role] || m.role}
                    {m.status === 'PENDING' && ' / 招待中'}
                  </p>
                </div>
                {editable && (
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.id, e.target.value)}
                      disabled={disabled}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-[#0066ff] focus:outline-none"
                    >
                      <option value="member">メンバー</option>
                      <option value="manager">マネージャー</option>
                      <option value="admin">管理者</option>
                    </select>
                    <button
                      onClick={() => remove(m.id)}
                      disabled={disabled}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs text-rose-700 disabled:opacity-40"
                    >
                      {m.status === 'PENDING' ? '取り消す' : '外す'}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canManage ? (
        <>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              aria-label="招待する方のメールアドレス"
              maxLength={254}
              disabled={disabled}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="招待する方のメールアドレス"
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none"
            />
            <select
              aria-label="招待する方の権限"
              disabled={disabled}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none"
            >
              <option value="member">メンバー</option>
              <option value="manager">マネージャー</option>
              <option value="admin">管理者</option>
            </select>
            <button
              onClick={invite}
              disabled={disabled || !email.trim()}
              className="rounded-lg bg-[#0066ff] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy === 'invite' ? '送信中...' : '招待する'}
            </button>
          </div>
        </>
      ) : (
        loaded && <p className="mt-4 text-xs text-slate-500">メンバーの招待は管理者以上が行えます。</p>
      )}
      {inviteUrl && <p className="mt-3 break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{inviteUrl}</p>}
    </section>
  )
}
