'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useHrOrganizationRequest } from '@/components/hr/HrOrganizationScope'
import { createHrPeriodRecoverySession, readHrPeriodRecoveryItems, type HrPeriodRecoveryItem } from '@/lib/hr/period-creation-recovery'
import type { PeriodCreationResult } from '@/lib/hr/use-evaluation-period-creation'

export default function HrPeriodCreationRecovery({ onReconciled }: { onReconciled: () => void }) {
  const scope = useHrOrganizationRequest()
  const operationBusy = useRef(false)
  const session = useRef<ReturnType<typeof createHrPeriodRecoverySession> | null>(null)
  const [items, setItems] = useState<HrPeriodRecoveryItem[]>([]), [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmed, setConfirmed] = useState<{ item: HrPeriodRecoveryItem; result: PeriodCreationResult } | null>(null)
  const refresh = useCallback(() => {
    session.current?.invalidate(); setConfirmed(null)
    try { setItems(readHrPeriodRecoveryItems(scope.actor, scope.organizationId)); setMessage('') }
    catch { setItems([]); setMessage('操作記録を安全に読み取れませんでした。記録は消去していません。ブラウザの保存設定をご確認ください。') }
  }, [scope])
  useEffect(() => {
    const active = createHrPeriodRecoverySession(scope.actor, scope.organizationId, scope.request, scope.isCurrent)
    session.current = active; refresh()
    const changed = (event: StorageEvent) => { if (event.key === null || event.key.startsWith('hr-period-create-intent:v1:')) refresh() }
    window.addEventListener('storage', changed); window.addEventListener('focus', refresh)
    return () => { active.dispose(); if (session.current === active) session.current = null; window.removeEventListener('storage', changed); window.removeEventListener('focus', refresh) }
  }, [scope, refresh])
  const run = async (item: HrPeriodRecoveryItem, action: 'inspect' | 'cancel' | 'acknowledge') => {
    const active = session.current
    if (!active || operationBusy.current || !scope.isCurrent()) return
    operationBusy.current = true; setBusy(true); setMessage('')
    const current = () => session.current === active && scope.isCurrent()
    try {
      if (action === 'acknowledge') {
        await active.acknowledge(item)
        if (!current()) return
        refresh(); onReconciled()
      } else {
        const result = await active.inspect(item, action === 'cancel')
        if (current()) setConfirmed({ item, result })
      }
    } catch { if (current()) { setConfirmed(null); setMessage('操作結果を確認できませんでした。記録は保持しています。ログイン状態・所属組織・権限を確認してから、結果を確認し直してください。') } }
    finally { if (current()) { operationBusy.current = false; setBusy(false) } }
  }
  return <section aria-label="競合した評価期間の作成操作を確認" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-6">
    <h2 className="font-bold">未確認の作成操作を1件ずつ確認してください</h2>
    <p className="mt-2 text-sm">新しい評価期間は作成せず、保存済みの結果を確認します。未受付の操作は終了した後に記録を整理できます。他の操作記録は保持します。</p>
    {message && <p role="alert" className="mt-2">{message}</p>}
    {busy && <p role="status">操作結果を確認しています。</p>}
    <ul className="mt-4 space-y-4">{items.map((item, index) => {
      const result = confirmed?.item.operationId === item.operationId && confirmed.item.fingerprint === item.fingerprint ? confirmed.result : null
      return <li key={JSON.stringify([item.operationId, item.fingerprint])} className="rounded-xl border bg-white p-4">
        <p className="font-bold">未確認の作成操作 {index + 1}</p>
        {result && <p role="status">{result.state === 'created' ? '評価期間は保存済みです。内容を確認してから記録を整理してください。' : result.state === 'not_received' ? '受付記録がありません。遅れて届く作成を防ぐため、この操作を終了してください。' : result.state === 'deleted' ? '作成済みの評価期間は削除されています。再作成は行いません。' : 'この作成操作は終了しています。'}</p>}
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => void run(item, 'inspect')} className="rounded-xl border px-4 py-2 disabled:opacity-50">この操作の結果を確認する</button>
          {result?.state === 'not_received' && <button type="button" disabled={busy} onClick={() => void run(item, 'cancel')} className="rounded-xl border px-4 py-2 disabled:opacity-50">この未受付の操作を終了する</button>}
          {result?.state === 'created' && <Link href={'/hr/evaluations/period/' + encodeURIComponent(result.period.id)} className="underline">保存済みの評価期間を開く</Link>}
          {result && result.state !== 'not_received' && <button type="button" disabled={busy} onClick={() => void run(item, 'acknowledge')} className="rounded-xl border px-4 py-2 disabled:opacity-50">確認済みとしてこの記録を整理する</button>}
        </div>
      </li>
    })}</ul>
  </section>
}
