// ドヤ勤怠 LP 用 製品モック（実機能の様子を表す・サンプルデータ・PIIなし）
import React from 'react'
import { Sym } from '@/components/lp'

const AV = ['#0ea5e9', '#0284c7', '#0066ff', '#0891b2', '#2563eb', '#38bdf8']
function Avatar({ i, initial, size = 32 }: { i: number; initial: string; size?: number }) {
  return (
    <span className="grid place-items-center rounded-full text-white font-black shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg, ${AV[i % AV.length]}, ${AV[(i + 2) % AV.length]})` }}>
      {initial}
    </span>
  )
}

/** 打刻画面（ヒーロー用・ワンクリック打刻） */
export function KintaiClockMock() {
  return (
    <div className="p-5 bg-slate-50/60">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Avatar i={0} initial="佐" size={30} />
          <div>
            <p className="text-[12px] font-black text-slate-800 leading-tight">佐藤 花子</p>
            <p className="text-[10px] font-bold text-slate-400 leading-tight">営業部・主任</p>
          </div>
        </div>
        <span className="text-[10px] font-black text-white rounded-md px-2 py-0.5" style={{ background: 'var(--lp-accent)' }}>勤務中</span>
      </div>
      {/* 現在時刻 */}
      <div className="bg-white border border-slate-100 rounded-2xl px-4 py-5 shadow-sm mb-4 text-center">
        <p className="text-[10px] font-bold text-slate-400 mb-1">2026年7月24日（金）</p>
        <p className="text-4xl font-black text-slate-900 tracking-tight tabular-nums">09:02<span className="text-lg text-slate-400">:47</span></p>
        <p className="text-[11px] font-bold text-slate-500 mt-2">本日の勤務時間 <span className="text-slate-800 tabular-nums">0:02</span></p>
      </div>
      {/* 打刻ボタン */}
      <div className="grid grid-cols-2 gap-2.5">
        <button className="flex flex-col items-center justify-center gap-1 rounded-2xl py-4 text-white font-black shadow-lg" style={{ background: '#0066ff', boxShadow: '0 10px 24px rgba(0,102,255,0.28)' }}>
          <Sym name="login" size={26} />
          <span className="text-sm">出勤</span>
          <span className="text-[10px] font-bold opacity-80 tabular-nums">09:02 打刻済み</span>
        </button>
        <button className="flex flex-col items-center justify-center gap-1 rounded-2xl py-4 font-black border-2 border-slate-200 bg-white text-slate-400">
          <Sym name="logout" size={26} />
          <span className="text-sm">退勤</span>
          <span className="text-[10px] font-bold">タップで打刻</span>
        </button>
      </div>
    </div>
  )
}

/** 勤怠集計テーブル（月次） */
export function KintaiSummaryMock() {
  const rows = [
    { d: '7/21（月）', in: '09:00', out: '18:03', work: '8:03', ot: '0:03' },
    { d: '7/22（火）', in: '08:55', out: '19:41', work: '9:46', ot: '1:41' },
    { d: '7/23（水）', in: '09:02', out: '18:00', work: '7:58', ot: '—' },
    { d: '7/24（木）', in: '08:58', out: '20:12', work: '10:14', ot: '2:12' },
    { d: '7/25（金）', in: '09:01', out: '17:30', work: '7:29', ot: '—' },
  ]
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sym name="bar_chart" size={18} className="text-[color:#0284c7]" />
          <span className="font-black text-slate-800 text-sm">勤怠集計</span>
          <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5">2026年7月</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-black text-white rounded-lg px-2.5 py-1.5" style={{ background: 'var(--lp-accent)' }}>
          <Sym name="download" size={13} />CSV
        </span>
      </div>
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_0.9fr] text-[10px] font-black text-slate-400 bg-slate-50 border-b border-slate-100 px-3 py-2">
          <span>日付</span><span className="text-right">出勤</span><span className="text-right">退勤</span><span className="text-right">実働</span><span className="text-right">残業</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_0.9fr] text-[11px] font-bold px-3 py-2 border-b border-slate-50 last:border-0">
            <span className="text-slate-700">{r.d}</span>
            <span className="text-right text-slate-500 tabular-nums">{r.in}</span>
            <span className="text-right text-slate-500 tabular-nums">{r.out}</span>
            <span className="text-right text-slate-800 tabular-nums">{r.work}</span>
            <span className="text-right tabular-nums" style={{ color: r.ot === '—' ? '#cbd5e1' : 'var(--lp-accent)' }}>{r.ot}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {[{ l: '実働合計', v: '43:30' }, { l: '残業', v: '3:56' }, { l: '出勤日数', v: '5日' }].map((s, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-lg px-2 py-2 text-center shadow-sm">
            <p className="text-[9px] font-bold text-slate-400">{s.l}</p>
            <p className="text-[13px] font-black text-slate-800 tabular-nums">{s.v}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 申請承認（休暇/残業申請のリスト） */
export function KintaiRequestsMock() {
  const reqs = [
    { i: 1, n: '田中 大輔', d: '開発部', type: '有給休暇', span: '7/28（月） 終日', status: 'pending' },
    { i: 2, n: '鈴木 美咲', d: '人事部', type: '残業申請', span: '7/24（木） 2:00', status: 'approved' },
    { i: 3, n: '高橋 健', d: 'マーケ', type: '打刻修正', span: '7/23（水） 退勤', status: 'pending' },
  ]
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center gap-2 mb-3">
        <Sym name="task_alt" size={18} className="text-[color:#0284c7]" />
        <span className="font-black text-slate-800 text-sm">申請・承認</span>
        <span className="text-[10px] font-black text-white rounded-full px-1.5 py-0.5" style={{ background: '#0066ff' }}>2件 未処理</span>
      </div>
      <div className="space-y-2.5">
        {reqs.map((r) => (
          <div key={r.i} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
            <div className="flex items-center gap-2.5 mb-2">
              <Avatar i={r.i} initial={r.n[0]} size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-black text-slate-800 truncate">{r.n} <span className="text-[10px] font-bold text-slate-400">・{r.d}</span></p>
                <p className="text-[10px] font-bold text-slate-500">{r.type}｜{r.span}</p>
              </div>
              {r.status === 'approved' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-black rounded-md px-2 py-1" style={{ background: 'color-mix(in srgb, var(--lp-accent) 14%, transparent)', color: 'var(--lp-accent)' }}>
                  <Sym name="check_circle" size={12} fill />承認済み
                </span>
              ) : (
                <span className="text-[10px] font-black text-amber-600 bg-amber-50 rounded-md px-2 py-1">承認待ち</span>
              )}
            </div>
            {r.status === 'pending' && (
              <div className="flex gap-2 pl-[38px]">
                <span className="flex-1 text-center text-[11px] font-black text-white rounded-lg py-1.5" style={{ background: '#0066ff' }}>承認</span>
                <span className="flex-1 text-center text-[11px] font-black text-slate-500 rounded-lg py-1.5 border border-slate-200">却下</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
