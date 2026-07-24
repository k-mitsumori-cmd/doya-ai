// ドヤ営業管理（SFA）LP 用 製品モック（実機能の様子を表す・サンプルデータ・PIIなし）
import React from 'react'
import { Sym } from '@/components/lp'

const AV = ['#16a34a', '#0284c7', '#0066ff', '#0891b2', '#059669', '#0ea5e9']
function Avatar({ i, initial, size = 26 }: { i: number; initial: string; size?: number }) {
  return (
    <span className="grid place-items-center rounded-full text-white font-black shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg, ${AV[i % AV.length]}, ${AV[(i + 2) % AV.length]})` }}>
      {initial}
    </span>
  )
}

// 商談パイプラインのサンプル（取引先名は一般的な架空社名）
const COLUMNS: { title: string; tint: string; deals: { c: string; amount: string; owner: string }[] }[] = [
  { title: 'リード', tint: '#94a3b8', deals: [
    { c: '山田製作所', amount: '¥80万', owner: '佐' },
    { c: 'みらい商事', amount: '¥120万', owner: '田' },
  ] },
  { title: '商談中', tint: '#0284c7', deals: [
    { c: '青空フーズ', amount: '¥250万', owner: '鈴' },
    { c: '大地建設', amount: '¥60万', owner: '高' },
  ] },
  { title: '提案', tint: '#0066ff', deals: [
    { c: 'さくら物流', amount: '¥340万', owner: '佐' },
  ] },
  { title: '受注', tint: '#16a34a', deals: [
    { c: 'ひかり工業', amount: '¥180万', owner: '田' },
    { c: '結ソリューションズ', amount: '¥90万', owner: '鈴' },
  ] },
]

/** 商談パイプライン（カンバン・ヒーロー用） */
export function SfaPipelineMock() {
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sym name="view_kanban" size={18} className="text-[color:#16a34a]" />
          <span className="font-black text-slate-800 text-sm">商談パイプライン</span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5">7件・¥1,120万</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {COLUMNS.map((col, ci) => (
          <div key={ci} className="min-w-0">
            <div className="flex items-center gap-1 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: col.tint }} />
              <span className="text-[10px] font-black text-slate-600 truncate">{col.title}</span>
              <span className="text-[9px] font-bold text-slate-300">{col.deals.length}</span>
            </div>
            <div className="space-y-1.5">
              {col.deals.map((d, di) => (
                <div key={di} className="bg-white border border-slate-100 rounded-lg p-1.5 shadow-sm">
                  <p className="text-[10px] font-black text-slate-800 truncate leading-tight">{d.c}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] font-black" style={{ color: col.tint }}>{d.amount}</span>
                    <Avatar i={ci + di} initial={d.owner} size={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 取引先一覧のサンプル
const ACCOUNTS = [
  { n: 'さくら物流', p: '担当: 佐藤', deals: 3, amount: '¥340万', s: '提案' },
  { n: '青空フーズ', p: '担当: 鈴木', deals: 2, amount: '¥250万', s: '商談中' },
  { n: 'ひかり工業', p: '担当: 田中', deals: 1, amount: '¥180万', s: '受注' },
  { n: 'みらい商事', p: '担当: 高橋', deals: 1, amount: '¥120万', s: 'リード' },
]

/** 取引先を一元管理 */
export function SfaAccountsMock() {
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sym name="apartment" size={18} className="text-[color:#0284c7]" />
          <span className="font-black text-slate-800 text-sm">取引先</span>
          <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5">18社</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-black text-white rounded-lg px-2.5 py-1.5" style={{ background: '#16a34a' }}>
          <Sym name="add" size={13} />追加
        </span>
      </div>
      <div className="flex items-center gap-1.5 mb-3 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
        <Sym name="search" size={14} className="text-slate-300" />
        <span className="text-[11px] text-slate-300 font-bold">会社名・担当者で検索</span>
      </div>
      <div className="space-y-2">
        {ACCOUNTS.map((a, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-xl p-2.5 flex items-center gap-2.5 shadow-sm">
            <Avatar i={i} initial={a.n[0]} size={32} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-black text-slate-800 truncate">{a.n}</p>
              <p className="text-[10px] font-bold text-slate-400 truncate">{a.p}・商談{a.deals}件</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] font-black text-slate-700">{a.amount}</p>
              <span className="text-[9px] font-black text-white rounded px-1.5 py-0.5" style={{ background: 'var(--lp-accent)' }}>{a.s}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 売上ダッシュボード */
export function SfaDashboardMock() {
  const kpis = [
    { l: '今月売上', v: '¥270万', d: '+18%' },
    { l: '進行中の商談', v: '12件', d: '¥1,120万' },
    { l: '受注率', v: '42%', d: '+6pt' },
  ]
  const bars = [
    { m: '2月', v: 40 }, { m: '3月', v: 58 }, { m: '4月', v: 52 },
    { m: '5月', v: 74 }, { m: '6月', v: 66 }, { m: '7月', v: 90 },
  ]
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center gap-2 mb-3">
        <Sym name="monitoring" size={18} className="text-[color:#16a34a]" />
        <span className="font-black text-slate-800 text-sm">売上ダッシュボード</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-xl p-2.5 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 truncate">{k.l}</p>
            <p className="text-[15px] font-black text-slate-800 leading-tight mt-0.5">{k.v}</p>
            <p className="text-[10px] font-black" style={{ color: 'var(--lp-accent)' }}>{k.d}</p>
          </div>
        ))}
      </div>
      <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-black text-slate-700">月次売上推移</span>
          <span className="text-[10px] font-bold text-slate-400">単位: 万円</span>
        </div>
        <div className="flex items-end justify-between gap-1.5 h-24">
          {bars.map((b, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t-md" style={{ height: `${b.v}%`, background: i === bars.length - 1 ? 'linear-gradient(180deg,#16a34a,#0066ff)' : 'linear-gradient(180deg,#86efac,#16a34a)' }} />
              <span className="text-[9px] font-bold text-slate-400">{b.m}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
