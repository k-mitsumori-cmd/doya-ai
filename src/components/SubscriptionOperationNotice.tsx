'use client'

import type { useSubscriptionManagement } from '@/hooks/useSubscriptionManagement'

type Management = ReturnType<typeof useSubscriptionManagement>

/** The recovery controls remain visible even when the original paid CTA disappears. */
export function SubscriptionOperationNotice({ management }: { management: Management }) {
  if (!management.message && !management.phase) return null
  return <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
    <p>{management.message || '保存済みの契約操作があります。'}</p>
    {management.actions.length > 1 && <p className="mt-2">確認済み {management.actions.filter(a => a.phase === 'confirmed').length} 件／対象 {management.actions.length} 件</p>}
    <div className="mt-3 flex flex-wrap gap-3">
      <button type="button" disabled={management.busy} onClick={() => management.recheck()} className="underline disabled:opacity-50">保存済み操作を確認</button>
      {management.canContinue && <button type="button" disabled={management.busy} onClick={() => management.continueOperation()} className="underline disabled:opacity-50">{management.actions.length > 0 && management.actions.every(a => a.phase === 'confirmed') ? '確認済み結果を確定' : '未送信の操作を続行'}</button>}
      {management.canAbort && <button type="button" disabled={management.busy} onClick={() => management.abortOperation()} className="underline disabled:opacity-50">未実行の操作を終了</button>}
      {management.phase === 'executing' && !management.canContinue && <button type="button" disabled={management.busy} onClick={() => management.reconcileOperation()} className="underline disabled:opacity-50">結果を再確認</button>}
    </div>
  </div>
}
