'use client'

import { useOwnerTransfer } from '@/lib/hr/use-owner-transfer'
import { ownerTransferPlanLabel } from '@/lib/hr/owner-transfer-client'

const roleLabel: Record<string, string> = { ADMIN: '管理者', MANAGER: 'マネージャー', MEMBER: 'メンバー' }

export default function HrOwnerTransferPanel({ actorId, organizationId, organizationSlug, role, request, current, onCommitted }: {
  actorId: string
  organizationId: string
  organizationSlug: string
  role: string
  request: typeof fetch
  current: () => boolean
  onCommitted: () => void
}) {
  const { state, refreshCandidates, moreCandidates, start, status, cancelMissing, newAfterTerminal } = useOwnerTransfer({
    service: 'hr', actorId, organizationId, organizationSlug, owner: role === 'OWNER',
    revision: JSON.stringify([actorId, organizationId, role]), active: current, transport: request, onCommitted,
  })
  const canChoose = role === 'OWNER' && state.phase === 'idle' && !state.handle
  return (
    <section className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm" aria-label="オーナー権限の移譲">
      <h2 className="text-base font-bold text-slate-900">オーナー権限の移譲</h2>
      <p className="mt-1 text-sm text-slate-600">参加済みのメンバーへ移譲できます。移譲後、あなたは管理者になります。組織の利用上限は後任のプランに切り替わります。個人の有料契約は移りません。</p>
      {state.message && <p role="alert" className="mt-3 text-sm text-amber-800">{state.message}</p>}
      {state.phase === 'checking' && <p role="status" className="mt-3 text-sm text-slate-600">引継ぎ状況を確認しています。</p>}
      {state.phase === 'committed' && <p role="status" className="mt-3 text-sm text-emerald-800">この引継ぎは完了しました。現在の権限を再確認しています。</p>}
      {state.phase === 'canceled' && <p role="status" className="mt-3 text-sm text-slate-600">未実行の引継ぎ申請は取り消されました。完了済みの移譲は元に戻りません。</p>}
      {state.handle && ['unknown', 'rejected', 'checking', 'missing', 'committed', 'canceled'].includes(state.phase) && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={state.busy} onClick={() => void status()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">引継ぎ状況を確認</button>
          {state.phase === 'missing' && <button type="button" disabled={state.busy} onClick={() => void cancelMissing()} className="rounded-lg border border-amber-300 px-3 py-2 text-sm disabled:opacity-50">未実行の引継ぎを取り消す</button>}
          {['canceled', 'committed'].includes(state.phase) && role === 'OWNER' && <button type="button" disabled={state.busy} onClick={() => void newAfterTerminal()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">現在の権限を確認して別の引継ぎを始める</button>}
        </div>
      )}
      {canChoose && <div className="mt-4 space-y-2">
        <p className="text-sm font-semibold">後任を選択</p>
        {!state.candidates && <button type="button" onClick={() => void refreshCandidates()} className="text-sm underline">後任候補を再確認する</button>}
        {state.candidates?.candidates.length === 0 && <p className="text-sm">参加済みの後任候補がいません。</p>}
        {state.candidates?.candidates.map(candidate => <div key={candidate.memberId} className="flex items-center justify-between gap-2 rounded-lg border p-3">
          <span className="text-sm">{candidate.name || '名前未設定'}（{roleLabel[candidate.role]}）・現在のプラン: {ownerTransferPlanLabel(candidate.plan) ?? '確認できません'}</span>
          <button type="button" disabled={state.busy} onClick={() => void start(candidate)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50">この方へ引き継ぐ</button>
        </div>)}
        {state.candidates?.nextCursor && <button type="button" disabled={state.busy} onClick={() => void moreCandidates()} className="text-sm underline disabled:opacity-50">次の候補を表示</button>}
      </div>}
    </section>
  )
}
