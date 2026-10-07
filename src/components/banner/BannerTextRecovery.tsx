'use client'
import type { useBannerTextRecovery } from '@/lib/banner/use-text-recovery'
import type { BannerTextResult } from '@/lib/banner/text-client'

export default function BannerTextRecovery({ recovery, onApply }: { recovery: ReturnType<typeof useBannerTextRecovery>; onApply: (result: BannerTextResult) => void }) {
  const { intent, result, message, busy } = recovery
  if (!intent && !message) return null
  const completed = result?.state === 'completed'
  const terminal = result && ['completed', 'failed', 'cancelled'].includes(result.state)
  return <section aria-label="前のAI返信の結果確認" className="my-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
    <p className="font-bold">{completed ? '保存済みのAI返信' : '前のAI返信の結果を確認してください'}</p>
    <p role="status" className="mt-2">{message || '通信が途切れた場合も、同じ操作を再生成せず保存結果を確認できます。'}</p>
    {completed && result.reply && <p className="mt-3 whitespace-pre-wrap">{result.reply}</p>}
    {intent && <div className="mt-3 flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={() => void recovery.recover()} className="rounded-lg border border-slate-400 bg-white px-3 py-2 disabled:opacity-50">{busy ? '確認中…' : 'AI返信の結果を確認'}</button>
      {result?.state === 'missing' && <button type="button" disabled={busy} onClick={() => void recovery.recover(true)} className="rounded-lg border border-slate-400 bg-white px-3 py-2 disabled:opacity-50">未受付の操作を終了</button>}
      {completed && <button type="button" disabled={busy} onClick={() => onApply(result)} className="rounded-lg bg-slate-800 px-3 py-2 text-white disabled:opacity-50">この返信・提案を会話に追加</button>}
      {terminal && <button type="button" disabled={busy} onClick={() => recovery.acknowledge(result.operationId)} className="rounded-lg border border-slate-400 bg-white px-3 py-2 disabled:opacity-50">確認して次の相談へ</button>}
    </div>}
  </section>
}
