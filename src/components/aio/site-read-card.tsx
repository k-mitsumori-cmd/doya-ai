'use client'

import { useEffect, useState } from 'react'
import { aioGet } from '@/lib/aio/client'
import type { SiteReadRecord } from '@/lib/aio/site-analysis'

const SOURCE_LABEL: Record<string, string> = { body: '本文', meta: '題名・説明文', subpages: '下層のページ', embedded: 'ページ内データ', user: '利用者の入力' }
const ROWS: Array<['summary' | 'audience' | 'industry' | 'competitorKind', string]> = [['summary', '何のサービスか'], ['audience', '誰向けか'], ['industry', '業種'], ['competitorKind', '競合の種類']]

/** 開始時にサイトから読み取った内容の記録（読み取り専用） */
export function AioSiteReadCard({ orgSlug }: { orgSlug: string }) {
  const [record, setRecord] = useState<SiteReadRecord | null | undefined>(undefined)
  useEffect(() => {
    const controller = new AbortController()
    aioGet<{ record: SiteReadRecord | null }>('/api/aio/site-read', orgSlug, { signal: controller.signal })
      .then(d => { if (!controller.signal.aborted) setRecord(d.record) })
      .catch(() => { if (!controller.signal.aborted) setRecord(null) })
    return () => controller.abort()
  }, [orgSlug])
  if (!record) return null
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-6" aria-label="読み取った内容">
      <h2 className="text-base font-black text-slate-900">読み取った内容</h2>
      <p className="mt-1 text-xs font-bold text-slate-500">
        {new Date(record.at).toLocaleDateString('ja-JP')}に、{record.pagesRead.length}ページから題名を除いて{record.totalChars}文字を読み取りました。使った手段: {record.sources.map(s => SOURCE_LABEL[s] || s).join('、') || 'なし'}。
      </p>
      {record.profile && (
        <dl className="mt-3 space-y-2 text-sm">
          {ROWS.map(([k, label]) => (
            <div key={k}><dt className="font-bold text-slate-700">{label}</dt><dd className="whitespace-pre-wrap break-words text-slate-800">{record.profile![k]}</dd></div>
          ))}
        </dl>
      )}
    </section>
  )
}
