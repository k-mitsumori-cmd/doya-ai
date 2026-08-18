// ドヤ広告画像AI LP用 製品モック（サンプル。実在ブランドは使わない）
import React from 'react'
import { Sym } from '@/components/lp'

/** 媒体別に並ぶ広告画像（ヒーロー用） */
export function AdImageGridMock() {
  const items = [
    { m: 'Meta', s: '1080×1080', ratio: 'aspect-square' },
    { m: 'Google', s: '1200×628', ratio: 'aspect-[1200/628]' },
    { m: 'X', s: '1600×900', ratio: 'aspect-video' },
    { m: 'LINE', s: '1080×1920', ratio: 'aspect-[9/16]' },
  ]
  return (
    <div className="bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sym name="wallpaper" size={18} style={{ color: 'var(--lp-accent)' }} />
          <span className="text-sm font-black text-slate-800">媒体別の書き出し</span>
        </div>
        <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
          切り抜きなし
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm">
            <div
              className={`${it.ratio} relative grid place-items-center`}
              style={{ background: 'linear-gradient(135deg,#0066ff,var(--lp-accent))' }}
            >
              <div className="px-2 text-center">
                <p className="text-[9px] font-black leading-tight text-white">見積もりを、その場で。</p>
                <span className="mt-1 inline-block rounded bg-white/95 px-1.5 py-px text-[7px] font-black text-slate-800">
                  無料ではじめる
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[9px] font-bold text-slate-700">{it.m}</span>
              <span className="text-[8px] tabular-nums text-slate-400">{it.s}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 文字の自動検査 */
export function AdImageVerifyMock() {
  const rows = [
    { n: 'Meta 正方形', ok: true },
    { n: 'Google レスポンシブ', ok: true },
    { n: 'X 横長', ok: true },
    { n: 'LINE 縦長', ok: false },
  ]
  return (
    <div className="bg-slate-50/60 p-4">
      <div className="space-y-1.5 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
            <span className="text-[10px] font-bold text-slate-600">{r.n}</span>
            {r.ok ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                <Sym name="check" size={11} />文字OK
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                <Sym name="refresh" size={11} />作り直し
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] font-bold text-slate-400">描かれた文字を読み取って照合し、不合格なら自動で作り直します</p>
    </div>
  )
}

/** 改善のフィードバック */
export function AdImageRefineMock() {
  return (
    <div className="bg-slate-50/60 p-4">
      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-700">AIによる採点</span>
          <span className="text-sm font-black tabular-nums text-slate-900">72<span className="text-[10px] text-slate-400">/100</span></span>
        </div>
        <div className="space-y-1.5">
          {[
            { k: '見出しの読みやすさ', v: 85 },
            { k: '余白のバランス', v: 60 },
            { k: 'ボタンの目立ち方', v: 55 },
          ].map((r, i) => (
            <div key={i}>
              <div className="mb-0.5 flex justify-between text-[9px] font-bold">
                <span className="text-slate-500">{r.k}</span>
                <span className="tabular-nums text-slate-600">{r.v}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${r.v}%`, background: 'linear-gradient(90deg,#0066ff,var(--lp-accent))' }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[9px] font-bold leading-relaxed text-slate-600">
          見出し周りの余白を広げ、ボタンの面積を1.3倍にすると視認性が上がります
        </p>
      </div>
    </div>
  )
}
