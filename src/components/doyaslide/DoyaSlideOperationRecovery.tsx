'use client'
import type { useDoyaSlideRecovery } from '@/lib/doyaslide/use-operation-recovery'

export default function DoyaSlideOperationRecovery({ recovery, onConfirm }: {
  recovery: ReturnType<typeof useDoyaSlideRecovery>; onConfirm: () => Promise<void>
}) {
  if (!recovery.intent && !recovery.message) return null
  const terminal = recovery.result && ['completed', 'failed', 'cancelled', 'empty', 'unavailable'].includes(recovery.result.state)
  return <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
    <p className="font-bold">前の生成操作を確認してください。</p>
    <p className="mt-1">{recovery.message || (recovery.result?.state === 'completed' ? `保存済みの結果が${recovery.result.results?.length || 0}枚あります。` : '通信が途切れた場合も、新しく生成せず保存結果を確認できます。')}</p>
    {recovery.result?.errorCount ? <p>{recovery.result.errorCount}枚は保存されていません。確認後、必要なスライドだけ再生成してください。</p> : null}
    <div className="mt-3 flex flex-wrap gap-3">
      <button type="button" disabled={recovery.busy || !recovery.intent} onClick={() => { void recovery.recover() }} className="font-bold underline disabled:opacity-50">保存結果を確認</button>
      {recovery.result?.state === 'missing' && <button type="button" disabled={recovery.busy} onClick={() => { void recovery.recover(true) }} className="font-bold underline">未受付の操作を終了</button>}
      {terminal && <button type="button" disabled={recovery.busy} onClick={() => { void onConfirm() }} className="font-bold underline">確認して操作を閉じる</button>}
    </div>
  </div>
}
