'use client'

import type { useSfaClientMutations } from '@/lib/sfa/use-client-mutations'

export default function MutationRecovery({ mutations }: { mutations: ReturnType<typeof useSfaClientMutations> }) {
  if (mutations.requiresLogin) return <p role="alert" className="my-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">ログイン状態を確認できません。再度ログインしてください。入力内容はこの画面に保持しています。</p>
  if (!mutations.message && !mutations.pending.length) return null
  return <div role="status" aria-live="polite" className="my-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
    {mutations.message && <p>{mutations.message}</p>}
    {mutations.pending.map(entry => <div key={entry.lane} className="flex flex-wrap items-center gap-2">
      <span>{entry.kind === 'next-action' ? 'AI提案' : entry.kind === 'score' ? 'AI判定' : entry.kind === 'conversion' ? 'リード転換' : entry.kind === 'lead' ? 'リード' : entry.kind === 'import' ? 'CSV取込' : entry.kind === 'task' ? 'タスク' : entry.kind === 'deal' ? '商談' : '活動'}の操作結果を確認しています。</span>
      <button type="button" disabled={mutations.busy.includes(entry.lane)} onClick={() => void mutations.recover(entry)} className="rounded border border-amber-400 px-3 py-1 disabled:opacity-50">保存結果を確認</button>
      {entry.operationId && <button type="button" disabled={mutations.busy.includes(entry.lane)} onClick={() => void mutations.recover(entry, true)} className="rounded border border-amber-400 px-3 py-1 disabled:opacity-50">未保存ならこの操作を取り消す</button>}
    </div>)}
  </div>
}
