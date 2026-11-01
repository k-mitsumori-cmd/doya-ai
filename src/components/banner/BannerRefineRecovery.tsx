'use client'
import type { useBannerRefineRecovery } from '@/lib/banner/use-refine-recovery'

export default function BannerRefineRecovery({ recovery }: { recovery: ReturnType<typeof useBannerRefineRecovery> }) {
  const { intent, result, message, busy } = recovery
  if (!intent && !message) return null
  const completed = result?.state === 'completed'
  const terminal = result && ['completed', 'failed', 'cancelled', 'unavailable'].includes(result.state)
  return <section aria-label="前のバナー修正の結果確認" className="my-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
    <p className="font-bold">{completed ? '保存済みの修正結果' : '前の修正結果を確認してください'}</p>
    <p role="status" className="mt-2">{message || (completed ? '結果は履歴にも保存されています。別の画像を上書きせず、ここからダウンロードできます。' : '通信が途切れた場合も同じ操作を再生成せず、保存結果を確認できます。')}</p>
    {completed && result.refinedImage && <div className="mt-3"><img src={result.refinedImage} alt="保存済みの修正バナー" className="max-h-64 max-w-full rounded-lg" /><a className="mt-2 inline-block font-bold underline" href={result.refinedImage} download={`banner-refined-${result.operationId}.png`}>修正画像をダウンロード</a></div>}
    {intent && <div className="mt-3 flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={() => void recovery.recover()} className="rounded-lg border border-slate-400 bg-white px-3 py-2 disabled:opacity-50">{busy ? '確認中…' : '修正結果を確認'}</button>
      {result?.state === 'missing' && <button type="button" disabled={busy} onClick={() => void recovery.recover(true)} className="rounded-lg border border-slate-400 bg-white px-3 py-2 disabled:opacity-50">未受付の操作を終了</button>}
      {terminal && <button type="button" disabled={busy} onClick={() => recovery.acknowledge(result.operationId)} className="rounded-lg bg-slate-800 px-3 py-2 text-white disabled:opacity-50">確認して次の修正へ</button>}
    </div>}
  </section>
}
