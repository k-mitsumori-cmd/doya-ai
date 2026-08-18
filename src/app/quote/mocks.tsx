// ドヤ見積もりAI LP用 製品モック
// ⚠️ サンプルデータ。実在の企業名・実際の取引価格は使わないこと。
import React from 'react'
import { Sym } from '@/components/lp'

/** 見積書の明細（ヒーロー用）。金額の出所が1件ずつ出るのがこのサービスの核 */
export function QuoteLinesMock() {
  const rows = [
    { n: 'サイト初期構築', q: 1, p: '480,000', src: '自社価格', tone: 'own' },
    { n: 'SEO記事制作（月10本）', q: 12, p: '80,000', src: '相場', tone: 'market' },
    { n: '運用ディレクション', q: 12, p: '120,000', src: '自社価格', tone: 'own' },
    { n: '広告運用代行', q: 12, p: '—', src: '要見積', tone: 'unknown' },
  ]
  const style: Record<string, string> = {
    own: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    market: 'bg-sky-50 text-sky-700 border-sky-100',
    unknown: 'bg-amber-50 text-amber-700 border-amber-100',
  }
  return (
    <div className="bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sym name="receipt_long" size={18} style={{ color: 'var(--lp-accent)' }} />
          <span className="text-sm font-black text-slate-800">御見積書</span>
        </div>
        <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
          金額の出所つき
        </span>
      </div>
      <div className="space-y-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold text-slate-800">{r.n}</p>
              <span className={`mt-0.5 inline-block rounded border px-1.5 py-px text-[9px] font-bold ${style[r.tone]}`}>
                {r.src}
              </span>
            </div>
            <span className="shrink-0 text-[10px] font-bold text-slate-400">×{r.q}</span>
            <span className={`shrink-0 text-[11px] font-black tabular-nums ${r.tone === 'unknown' ? 'text-amber-600' : 'text-slate-900'}`}>
              {r.p === '—' ? '要見積' : `¥${r.p}`}
            </span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-2">
          <span className="text-[11px] font-bold text-slate-500">小計（税抜）</span>
          <span className="text-sm font-black tabular-nums text-slate-900">¥3,840,000</span>
        </div>
      </div>
      <p className="mt-2 text-[10px] font-bold leading-relaxed text-slate-400">
        根拠が無い項目は金額を作らず「要見積」で空欄のまま残します
      </p>
    </div>
  )
}

/** 税率区分ごとの計算 */
export function QuoteTaxMock() {
  const rows = [
    { n: '10%対象', base: '3,720,000', tax: '372,000' },
    { n: '8%対象（軽減）', base: '120,000', tax: '9,600' },
  ]
  return (
    <div className="bg-slate-50/60 p-4">
      <div className="space-y-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-600">{r.n}</span>
            <span className="tabular-nums text-slate-500">
              ¥{r.base} <span className="text-slate-300">/</span> 税 ¥{r.tax}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
          <span className="text-[11px] font-black text-slate-700">合計（税込）</span>
          <span className="text-sm font-black tabular-nums text-slate-900">¥4,221,600</span>
        </div>
      </div>
    </div>
  )
}

/** PDF出力 */
export function QuotePdfMock() {
  return (
    <div className="bg-slate-50/60 p-4">
      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="text-[13px] font-black text-slate-900">御見積書</p>
            <p className="mt-0.5 text-[9px] font-bold text-slate-400">No. Q-2026-0142</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold text-slate-500">株式会社サンプル</p>
            <p className="text-[8px] text-slate-400">東京都◯◯区◯◯ 1-2-3</p>
          </div>
        </div>
        <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[9px] font-bold text-slate-500">御見積金額</p>
          <p className="text-lg font-black tabular-nums text-slate-900">¥4,221,600</p>
        </div>
        <div className="space-y-1">
          {['サイト初期構築', 'SEO記事制作', '運用ディレクション'].map((t, i) => (
            <div key={i} className="h-1.5 rounded bg-slate-100" style={{ width: `${92 - i * 14}%` }} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2">
          <Sym name="verified" size={12} className="text-emerald-500" />
          <span className="text-[9px] font-bold text-slate-500">日本語フォント埋め込み済み</span>
        </div>
      </div>
    </div>
  )
}
