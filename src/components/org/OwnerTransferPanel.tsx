'use client'

import { useSession } from 'next-auth/react'
import { useOwnerTransfer } from '@/lib/use-owner-transfer'
import { ownerTransferPlanLabel } from '@/lib/owner-transfer-client'
import type { OwnerTransferService } from '@/lib/owner-transfer/types'
import type { WorkspaceProof } from '@/lib/organization-workspace-selection'
const roleLabel: Record<string, string> = { admin: '管理者', manager: 'マネージャー', member: 'メンバー' }

export default function OwnerTransferPanel({ service, organizationSlug, organizationId, role, proof, onCommitted }: {
  service: OwnerTransferService
  organizationSlug: string
  organizationId?: string
  role: string
  proof?: WorkspaceProof
  onCommitted?: () => void
}) {
  const { data: session, status } = useSession()
  const sessionActor = status === 'authenticated' ? (session?.user as { id?: string } | undefined)?.id ?? '' : ''
  const actorId = proof?.actorId ?? sessionActor
  const current = () => status === 'authenticated' && sessionActor === actorId && !!actorId &&
    (!proof || proof.current() && proof.organization.slug === organizationSlug && proof.organization.id === organizationId)
  const { state, refreshCandidates, start, status: observe, cancelMissing, newAfterTerminal } = useOwnerTransfer({
    service, actorId, organizationSlug, organizationId, owner: role === 'owner',
    revision: JSON.stringify([proof?.revision ?? organizationSlug, status, actorId]), active: current, onCommitted,
  })
  if (!actorId || !organizationSlug) return null
  const canChoose = role === 'owner' && state.phase === 'idle' && !state.handle
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200" aria-label="オーナーの引継ぎ">
      <h2 className="text-base font-bold text-slate-900">オーナーの引継ぎ</h2>
      <p className="mt-1 text-sm text-slate-600">参加済みのメンバーへ引き継げます。引継ぎ後、ご自身は管理者になります。個人の有料契約は移りません。</p>
      {state.message && <p role="alert" className="mt-3 text-sm text-amber-800">{state.message}</p>}
      {state.phase === 'checking' && <p role="status" className="mt-3 text-sm text-slate-600">引継ぎ状況を確認しています。</p>}
      {state.phase === 'committed' && <p role="status" className="mt-3 text-sm text-emerald-800">この引継ぎは完了しました。現在の権限はメンバー一覧で再確認してください。</p>}
      {state.phase === 'canceled' && <p role="status" className="mt-3 text-sm text-slate-600">未実行の引継ぎ申請は取り消されました。完了済みの引継ぎは元に戻りません。</p>}
      {state.handle && ['unknown', 'rejected', 'checking', 'missing', 'committed', 'canceled'].includes(state.phase) && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={state.busy} onClick={() => void observe()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">引継ぎ状況を確認</button>
          {state.phase === 'missing' && <button type="button" disabled={state.busy} onClick={() => void cancelMissing()} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">未実行の引継ぎ申請を取り消す</button>}
          {['canceled', 'committed'].includes(state.phase) && role === 'owner' && <button type="button" disabled={state.busy} onClick={() => void newAfterTerminal()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">現在の権限を確認して別の引継ぎを始める</button>}
        </div>
      )}
      {canChoose && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-slate-700">後任を選択</p>
          {!state.candidates && <button type="button" onClick={() => void refreshCandidates()} className="text-sm font-semibold underline">後任候補を再確認する</button>}
          {state.candidates?.candidates.length === 0 && <p className="text-sm text-slate-600">参加済みの後任候補がいません。</p>}
          {state.candidates?.candidates.map(candidate => (
            <div key={candidate.memberId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
              <p className="text-sm text-slate-700">{candidate.name || '名前未設定'}（{roleLabel[candidate.role]}）・現在のプラン: {ownerTransferPlanLabel(candidate.plan) ?? '確認できません'}</p>
              <button type="button" disabled={state.busy} onClick={() => void start(candidate)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">この方へ引き継ぐ</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
