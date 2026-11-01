// ドヤAIO LP 用 製品モック（AI可視性/AEOの様子を表す・サンプルデータ・実在ブランド名なし）
import React from 'react'
import { Sym } from '@/components/lp'

/** AI可視性ランキング（Share of Voice の横棒グラフ・ヒーロー用） */
export function AioSovMock() {
  const rows = [
    { n: '自社ブランド', v: 42, self: true },
    { n: '競合A', v: 26 },
    { n: '競合B', v: 18 },
    { n: '競合C', v: 9 },
    { n: 'その他', v: 5 },
  ]
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sym name="leaderboard" size={18} className="text-[color:#0891b2]" />
          <span className="font-black text-slate-800 text-sm">AI可視性ランキング</span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5">Share of Voice</span>
      </div>
      <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2.5 shadow-sm">
        {rows.map((r, i) => (
          <div key={i}>
            <div className="flex justify-between items-center text-[11px] font-bold mb-1">
              <span className={r.self ? 'text-slate-800 font-black inline-flex items-center gap-1' : 'text-slate-500'}>
                {r.self && <Sym name="workspace_premium" size={13} style={{ color: 'var(--lp-accent)' }} />}
                {r.n}
              </span>
              <span className={r.self ? 'text-slate-900 font-black' : 'text-slate-500'}>{r.v}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${r.v}%`,
                  background: r.self ? 'linear-gradient(90deg,#0066ff,var(--lp-accent))' : '#cbd5e1',
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-1">
        <Sym name="forum" size={12} className="text-slate-300" />
        「おすすめのAIバナー作成ツールは？」など30プロンプトの集計
      </p>
    </div>
  )
}

/** 4エンジン言及率カード */
export function AioEnginesMock() {
  const engines = [
    { n: 'ChatGPT', sym: 'smart_toy', hit: 26, total: 30 },
    { n: 'Gemini', sym: 'auto_awesome', hit: 21, total: 30 },
    { n: 'Claude', sym: 'psychology', hit: 18, total: 30 },
    { n: 'Perplexity', sym: 'travel_explore', hit: 24, total: 30 },
  ]
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center gap-2 mb-3">
        <Sym name="hub" size={18} className="text-[color:#0891b2]" />
        <span className="font-black text-slate-800 text-sm">4エンジン言及率</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {engines.map((e, i) => {
          const pct = Math.round((e.hit / e.total) * 100)
          return (
            <div key={i} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="grid place-items-center rounded-lg" style={{ width: 24, height: 24, background: 'color-mix(in srgb, var(--lp-accent) 12%, transparent)' }}>
                  <Sym name={e.sym} size={15} style={{ color: 'var(--lp-accent)' }} />
                </span>
                <span className="text-[12px] font-black text-slate-800">{e.n}</span>
              </div>
              <div className="flex items-end justify-between mb-1.5">
                <span className="text-[20px] font-black text-slate-900 leading-none">{pct}<span className="text-[12px] text-slate-400">%</span></span>
                <span className="text-[10px] font-bold text-slate-400">{e.hit}/{e.total}回</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#0066ff,var(--lp-accent))' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 引用元ドメインのリスト */
export function AioCitationsMock() {
  const sites = [
    { d: 'example-media.jp', label: '比較メディア', n: 12 },
    { d: 'note.example.com', label: 'ブログ記事', n: 8 },
    { d: 'jp.wikipedia-example.org', label: '百科事典', n: 6 },
    { d: 'own-brand.example.jp', label: '自社サイト', n: 5, self: true },
    { d: 'review-example.net', label: 'レビュー', n: 4 },
  ]
  const max = 12
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sym name="link" size={18} className="text-[color:#0891b2]" />
          <span className="font-black text-slate-800 text-sm">引用元ドメイン</span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5">AIが根拠にしたサイト</span>
      </div>
      <div className="bg-white border border-slate-100 rounded-xl divide-y divide-slate-100 shadow-sm">
        {sites.map((s, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
            <span className="grid place-items-center rounded-md shrink-0" style={{ width: 22, height: 22, background: s.self ? 'color-mix(in srgb, var(--lp-accent) 14%, transparent)' : '#f1f5f9' }}>
              <Sym name={s.self ? 'verified' : 'public'} size={13} style={{ color: s.self ? 'var(--lp-accent)' : '#94a3b8' }} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black text-slate-800 truncate">{s.d}</p>
              <p className="text-[9px] font-bold text-slate-400 truncate">{s.label}</p>
            </div>
            <div className="w-16 shrink-0">
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(s.n / max) * 100}%`, background: s.self ? 'linear-gradient(90deg,#0066ff,var(--lp-accent))' : '#cbd5e1' }} />
              </div>
            </div>
            <span className="text-[10px] font-black text-slate-500 w-8 text-right shrink-0">{s.n}回</span>
          </div>
        ))}
      </div>
    </div>
  )
}
