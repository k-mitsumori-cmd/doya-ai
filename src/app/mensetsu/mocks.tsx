// ドヤ面接官 LP用 製品モック（サンプル。実在の応募者・企業は使わない）
// ⚠️ AIが合否を決めるように見える表現にしないこと。出すのは推薦度で、決めるのは人。
import React from 'react'
import { Sym } from '@/components/lp'

/** 面接の様子（ヒーロー用） */
export function MensetsuLiveMock() {
  return (
    <div className="bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sym name="support_agent" size={18} style={{ color: 'var(--lp-accent)' }} />
          <span className="text-sm font-black text-slate-800">一次面接</span>
        </div>
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-black tabular-nums text-white">12:34</span>
      </div>
      <div
        className="relative mb-2 grid aspect-video place-items-center overflow-hidden rounded-xl"
        style={{ background: 'linear-gradient(135deg,#0f172a,#1d4ed8)' }}
      >
        <div className="text-center">
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-white/15">
            <Sym name="person" size={24} className="text-white" />
          </div>
          <p className="text-[9px] font-bold text-white/70">面接官</p>
        </div>
        <div className="absolute bottom-2 right-2 grid h-12 w-16 place-items-center rounded-lg bg-slate-800 ring-1 ring-white/20">
          <Sym name="videocam_off" size={14} className="text-white/40" />
        </div>
      </div>
      <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm">
        <p className="text-[9px] font-bold text-slate-400">質問 3 / 12</p>
        <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-800">
          直近で担当された案件のうち、もっとも難しかったものと、その進め方を教えてください。
        </p>
      </div>
    </div>
  )
}

/** 評価軸ごとのスコアと根拠 */
export function MensetsuScoreMock() {
  const rows = [
    { k: '課題設定力', v: 4 },
    { k: '実行・遂行力', v: 5 },
    { k: '協働・巻き込み', v: 3 },
    { k: '学習と再現性', v: 0, insufficient: true },
  ]
  return (
    <div className="bg-slate-50/60 p-4">
      <div className="space-y-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        {rows.map((r, i) => (
          <div key={i}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-600">{r.k}</span>
              {r.insufficient ? (
                <span className="rounded bg-slate-100 px-1.5 py-px text-[9px] font-bold text-slate-500">情報不足</span>
              ) : (
                <span className="text-[10px] font-black tabular-nums text-slate-800">{r.v}<span className="text-slate-300">/5</span></span>
              )}
            </div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  className="h-1.5 flex-1 rounded-full"
                  style={{ background: !r.insufficient && n <= r.v ? 'linear-gradient(90deg,#0066ff,var(--lp-accent))' : '#e2e8f0' }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] font-bold text-slate-400">判断できない軸は推測で埋めず「情報不足」と出します</p>
    </div>
  )
}

/** ガードレール */
export function MensetsuGuardMock() {
  const rows = [
    { t: '前職での役割と成果を教えてください', ok: true },
    { t: 'チームで意見が割れたときの進め方は', ok: true },
    { t: 'ご家族は何をされていますか', ok: false, why: '家族構成' },
    { t: 'ご結婚のご予定はありますか', ok: false, why: '結婚・出産の予定' },
  ]
  return (
    <div className="bg-slate-50/60 p-4">
      <div className="space-y-1.5 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        {rows.map((r, i) => (
          <div key={i} className="flex items-start gap-2 border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
            <Sym
              name={r.ok ? 'check_circle' : 'block'}
              size={13}
              className={r.ok ? 'mt-px text-emerald-500' : 'mt-px text-rose-500'}
            />
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] font-bold leading-snug ${r.ok ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                {r.t}
              </p>
              {!r.ok && <span className="text-[9px] font-bold text-rose-500">除外: {r.why}</span>}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] font-bold text-slate-400">選考で尋ねてはいけない事項は質問を作る時点で除外します</p>
    </div>
  )
}
