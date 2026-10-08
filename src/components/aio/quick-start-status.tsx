'use client'

import type { useAioQuickStart } from '@/lib/aio/use-quick-start'

export function AioQuickStartStatus({ flow }: { flow: ReturnType<typeof useAioQuickStart> }) {
  const view = flow.view
  if (!view || (!view.intent && !view.error)) return null
  return (
    <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-slate-800" role="status" aria-live="polite">
      <p className="font-bold">{view.phase === 'completed' ? 'ワークスペースの準備ができています' : '前の開始処理を確認してください'}</p>
      <p className="mt-1">{view.phase === 'completed' ? '保存結果を開いても、スキャンは自動で再実行しません。ダッシュボードから診断を開始できます。'
        : view.phase === 'cancelling' ? '終了処理中です。処理の終了を確認してから次の作成を開始できます。'
        : view.phase === 'busy' ? '他の作成処理が枠を確保しています。完了後に、同じサイトのURLを入力して続きを開始できます。'
        : view.phase === 'ready' ? '同じサイトのURLを入力して、開始処理を続けてください。'
        : view.phase === 'missing' ? '処理がまだ確認できません。新しく開始せず、再確認するか、この操作を終了してください。'
        : view.phase === 'failed' ? '開始処理は完了していません。この操作を終了すると、入力内容を見直して改めて開始できます。'
        : '通信が途切れても、新しく作成せず保存状況を確認できます。'}</p>
      {view.error && <p className="mt-2 font-bold text-red-700">{view.error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {view.intent && <>
          <button type="button" disabled={view.busy} onClick={() => void flow.recover()} className="rounded-lg bg-white px-3 py-2 font-bold disabled:opacity-50">保存状況を確認</button>
          {['ready', 'busy'].includes(view.phase) && <button type="button" disabled={view.busy} onClick={() => void flow.resume()} className="rounded-lg bg-purple-700 px-3 py-2 font-bold text-white disabled:opacity-50">開始処理を続ける</button>}
          {view.phase === 'completed' && <button type="button" disabled={view.busy} onClick={() => void flow.open()} className="rounded-lg bg-purple-700 px-3 py-2 font-bold text-white disabled:opacity-50">保存結果を開く</button>}
          {view.phase !== 'completed' && <button type="button" disabled={view.busy && view.phase === 'cancelling'} onClick={flow.cancel} className="rounded-lg bg-white px-3 py-2 font-bold disabled:opacity-50">この操作を終了</button>}
        </>}
        {view.error?.startsWith('ログイン') && <button type="button" onClick={() => void flow.signIn()} className="rounded-lg bg-white px-3 py-2 font-bold">ログインを確認</button>}
      </div>
    </div>
  )
}
