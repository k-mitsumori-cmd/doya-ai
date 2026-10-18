// ドヤHR LP 用 製品モック（実機能の様子を表す・サンプルデータ・PIIなし）
import React from 'react'
import { Sym } from '@/components/lp'

const AV = ['#0066ff', '#0284c7', '#7c3aed', '#0891b2', '#2563eb', '#0ea5e9']
function Avatar({ i, initial, size = 36 }: { i: number; initial: string; size?: number }) {
  return (
    <span className="grid place-items-center rounded-full text-white font-black shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg, ${AV[i % AV.length]}, ${AV[(i + 2) % AV.length]})` }}>
      {initial}
    </span>
  )
}

const PEOPLE = [
  { n: '佐藤 花子', d: '営業部', r: '主任', g: 'A' },
  { n: '田中 大輔', d: '開発部', r: 'リーダー', g: 'S' },
  { n: '鈴木 美咲', d: '人事部', r: '担当', g: 'B' },
  { n: '高橋 健',   d: 'マーケ', r: '主任', g: 'A' },
]

/** 従業員データベース（ヒーロー用） */
export function HrEmployeesMock() {
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sym name="groups" size={18} className="text-[color:#0284c7]" />
          <span className="font-black text-slate-800 text-sm">従業員データベース</span>
          <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5">24名</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-black text-white rounded-lg px-2.5 py-1.5" style={{ background: '#0066ff' }}>
          <Sym name="add" size={13} />追加
        </span>
      </div>
      <div className="flex items-center gap-1.5 mb-3 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
        <Sym name="search" size={14} className="text-slate-300" />
        <span className="text-[11px] text-slate-300 font-bold">名前・部署で検索</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {PEOPLE.map((p, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-xl p-2.5 flex items-center gap-2.5 shadow-sm">
            <Avatar i={i} initial={p.n[0]} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-black text-slate-800 truncate">{p.n}</p>
              <p className="text-[10px] font-bold text-slate-400 truncate">{p.d}・{p.r}</p>
            </div>
            <span className="text-[10px] font-black text-white rounded-md px-1.5 py-0.5" style={{ background: 'var(--lp-accent)' }}>{p.g}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 組織図（自動生成） */
export function HrOrgChartMock() {
  const heads = [{ n: '営業部長', i: 0 }, { n: '開発部長', i: 1 }, { n: '管理部長', i: 2 }]
  return (
    <div className="p-6 bg-slate-50/60">
      <div className="flex flex-col items-center">
        <div className="bg-white border-2 rounded-xl px-4 py-2.5 flex items-center gap-2.5 shadow-sm" style={{ borderColor: 'var(--lp-accent)' }}>
          <Avatar i={4} initial="代" size={32} />
          <div><p className="text-[12px] font-black text-slate-800">代表取締役</p><p className="text-[10px] font-bold text-slate-400">CEO</p></div>
        </div>
        <div className="w-px h-5 bg-slate-300" />
        <div className="h-px w-2/3 bg-slate-300" />
        <div className="grid grid-cols-3 gap-3 w-full mt-5">
          {heads.map((h, k) => (
            <div key={k} className="flex flex-col items-center">
              <div className="w-px h-3 bg-slate-300 -mt-5 mb-2" />
              <div className="bg-white border border-slate-200 rounded-xl px-2 py-2 flex flex-col items-center gap-1 shadow-sm w-full">
                <Avatar i={h.i} initial={h.n[0]} size={28} />
                <p className="text-[10px] font-black text-slate-700 text-center leading-tight">{h.n}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** MBO評価 + AI下書き */
export function HrEvalMock() {
  const scores = [{ l: '目標達成度', v: 88 }, { l: '行動評価', v: 74 }, { l: 'スキル', v: 92 }]
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center gap-2 mb-3">
        <Sym name="assignment" size={18} className="text-[color:#0284c7]" />
        <span className="font-black text-slate-800 text-sm">人事評価（MBO）</span>
      </div>
      <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2.5 shadow-sm mb-3">
        {scores.map((s, i) => (
          <div key={i}>
            <div className="flex justify-between text-[11px] font-bold mb-1"><span className="text-slate-500">{s.l}</span><span className="text-slate-800">{s.v}</span></div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${s.v}%`, background: 'linear-gradient(90deg,#0066ff,var(--lp-accent))' }} /></div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sym name="auto_awesome" size={14} style={{ color: 'var(--lp-accent)' }} />
          <span className="text-[11px] font-black text-slate-700">AIが評価コメントを下書き</span>
        </div>
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
          今期は新規開拓で目標を大きく上回り、チーム内の連携も主導しました。次期はマネジメント面での…
        </p>
        <div className="flex justify-end mt-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-black rounded-md px-2 py-1" style={{ background: 'color-mix(in srgb, var(--lp-accent) 12%, transparent)', color: 'var(--lp-accent)' }}>
            <Sym name="refresh" size={12} />再生成
          </span>
        </div>
      </div>
    </div>
  )
}
