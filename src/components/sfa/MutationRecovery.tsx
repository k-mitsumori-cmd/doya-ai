'use client'

import type { useSfaClientMutations } from '@/lib/sfa/use-client-mutations'
import { signIn } from 'next-auth/react'
import { ErrorNotice } from '@/components/ds'

export default function MutationRecovery({ mutations }: { mutations: ReturnType<typeof useSfaClientMutations> }) {
  // 新しい見た目（UI 品質 S-20）: ログイン切れ・上限は、何が起きたか・どうすればよいかと操作を1つ出す。サーバーの文はそのまま出さない
  if (mutations.requiresLogin) return <div className="my-3"><ErrorNotice what="ログインの有効期限が切れています。" how="もう一度ログインしてください。入力内容はこの画面に残しています。" onRetry={() => void signIn()} retryLabel="ログインし直す" /></div>
  if (mutations.upgradeHref && !mutations.pending.length) {
    const href = mutations.upgradeHref
    return <div className="my-3"><ErrorNotice what="今のプランで使える上限に達したため、保存できませんでした。" how="料金プランを見直すと、続けて登録できます。入力内容はこの画面に残しています。" onRetry={() => window.location.assign(href)} retryLabel="料金プランを見る" /></div>
  }
  if (!mutations.message && !mutations.pending.length) return null
  // 新しい見た目のときは、押せる大きさ（44px）と、キーボードで分かる枠を付ける
  const action = 'inline-flex min-h-11 items-center rounded-lg border border-amber-400 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066ff] disabled:opacity-50'
  return <div role="status" aria-live="polite" className="my-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
    {mutations.message && <p className="break-words">{mutations.message}</p>}
    {mutations.upgradeHref && <a href={mutations.upgradeHref} className="inline-block rounded border border-amber-400 px-3 py-2 font-bold">プランと利用枠を確認</a>}
    {mutations.pending.map(entry => <div key={entry.lane} className="flex flex-wrap items-center gap-2">
      <span>{entry.kind === 'next-action' ? 'AI提案' : entry.kind === 'score' ? 'AI判定' : entry.kind === 'conversion' ? 'リード転換' : entry.kind === 'lead' ? 'リード' : entry.kind === 'import' ? 'CSV取込' : entry.kind === 'team' ? 'チーム' : entry.kind === 'account' ? '取引先' : entry.kind === 'contact' ? '担当者' : entry.kind === 'task' ? 'タスク' : entry.kind === 'deal' ? '商談' : '活動'}の操作結果を確認しています。</span>
      <button type="button" disabled={mutations.busy.includes(entry.lane)} onClick={() => void mutations.recover(entry)} className={action}>保存結果を確認</button>
      {entry.operationId && <button type="button" disabled={mutations.busy.includes(entry.lane)} onClick={() => void mutations.recover(entry, true)} className={action}>未保存ならこの操作を取り消す</button>}
    </div>)}
  </div>
}
