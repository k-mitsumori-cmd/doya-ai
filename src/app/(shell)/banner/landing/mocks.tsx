// ドヤバナーAI LP 用 製品モック（実機能の様子を表す・サンプルデータ・実在ブランド不使用）
import React from 'react'
import { Sym } from '@/components/lp'

/** A/B/C 3案バナープレビュー */
const VARIANTS = [
  { label: '案A', bg: 'linear-gradient(135deg,#0066ff,#00e0ff)', head: '初回限定 30%OFF', sub: '今だけのはじめての方へ', cta: '詳しく見る' },
  { label: '案B', bg: 'linear-gradient(135deg,#ec4899,#f97316)', head: '新生活を、軽やかに。', sub: '春の新作コレクション', cta: 'いますぐ購入' },
  { label: '案C', bg: 'linear-gradient(135deg,#0f172a,#334155)', head: 'プロが選ぶ品質を', sub: '無料トライアル受付中', cta: '無料で試す' },
]

export function BannerVariantsMock() {
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sym name="auto_awesome" size={18} style={{ color: 'var(--lp-accent)' }} />
          <span className="font-black text-slate-800 text-sm">AIが3案を同時生成</span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5">A / B / C</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {VARIANTS.map((v, i) => (
          <div key={i} className="rounded-xl overflow-hidden bg-white border border-slate-100 shadow-sm">
            <div className="aspect-square p-2.5 flex flex-col justify-between text-white" style={{ background: v.bg }}>
              <span className="text-[9px] font-black bg-white/25 rounded px-1.5 py-0.5 self-start backdrop-blur-sm">{v.label}</span>
              <div>
                <p className="text-[12px] font-black leading-tight">{v.head}</p>
                <p className="text-[8px] font-bold opacity-90 mt-0.5 leading-tight">{v.sub}</p>
              </div>
              <span className="text-[8px] font-black bg-white text-slate-800 rounded px-1.5 py-0.5 self-start">{v.cta}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-3 text-[10px] font-bold text-slate-400">
        <Sym name="touch_app" size={13} />
        <span>気に入った案を選んで書き出し</span>
      </div>
    </div>
  )
}

/** 業種テンプレート選択 */
const TEMPLATES = [
  { icon: 'wifi', name: '通信・回線', tone: '#0066ff' },
  { icon: 'shopping_bag', name: 'EC・通販', tone: '#ec4899' },
  { icon: 'badge', name: '採用・求人', tone: '#0891b2' },
  { icon: 'spa', name: '美容・サロン', tone: '#7c3aed' },
  { icon: 'restaurant', name: '飲食・グルメ', tone: '#f97316' },
  { icon: 'school', name: 'スクール・教育', tone: '#0284c7' },
]

export function BannerTemplatesMock() {
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center gap-2 mb-3">
        <Sym name="category" size={18} className="text-[color:#0284c7]" />
        <span className="font-black text-slate-800 text-sm">業種テンプレートを選ぶ</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {TEMPLATES.map((t, i) => (
          <div key={i} className={`bg-white rounded-xl p-2.5 flex flex-col items-center gap-1.5 shadow-sm border ${i === 0 ? '' : 'border-slate-100'}`}
            style={i === 0 ? { borderColor: 'var(--lp-accent)', borderWidth: 2 } : undefined}>
            <span className="grid place-items-center rounded-lg shrink-0" style={{ width: 34, height: 34, background: `color-mix(in srgb, ${t.tone} 12%, transparent)` }}>
              <Sym name={t.icon} size={18} style={{ color: t.tone }} />
            </span>
            <span className="text-[10px] font-black text-slate-700 text-center leading-tight">{t.name}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 bg-white border border-slate-100 rounded-xl p-2.5 shadow-sm">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sym name="palette" size={14} className="text-[color:#0284c7]" />
          <span className="text-[11px] font-black text-slate-700">ブランドカラー</span>
        </div>
        <div className="flex items-center gap-1.5">
          {['#0066ff', '#ec4899', '#0f172a', '#00e0ff', '#f97316'].map((c) => (
            <span key={c} className="w-5 h-5 rounded-full border-2 border-white shadow" style={{ background: c }} />
          ))}
          <span className="text-[10px] font-bold text-slate-400 ml-1">を反映</span>
        </div>
      </div>
    </div>
  )
}

/** サイズプリセット＆書き出し */
const SIZES = [
  { name: '正方形', ratio: '1:1', w: 40, h: 40 },
  { name: '横長', ratio: '1.91:1', w: 52, h: 28 },
  { name: '縦長', ratio: '4:5', w: 34, h: 42 },
  { name: 'ストーリー', ratio: '9:16', w: 26, h: 46 },
]

export function BannerSizesMock() {
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center gap-2 mb-3">
        <Sym name="aspect_ratio" size={18} className="text-[color:#0284c7]" />
        <span className="font-black text-slate-800 text-sm">サイズプリセット＆書き出し</span>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {SIZES.map((s, i) => (
          <div key={i} className={`bg-white rounded-xl p-2 flex flex-col items-center gap-1.5 shadow-sm border ${i === 0 ? '' : 'border-slate-100'}`}
            style={i === 0 ? { borderColor: 'var(--lp-accent)', borderWidth: 2 } : undefined}>
            <div className="grid place-items-center" style={{ height: 48 }}>
              <span className="rounded" style={{ width: s.w, height: s.h, background: 'linear-gradient(135deg,#0066ff,var(--lp-accent))' }} />
            </div>
            <span className="text-[10px] font-black text-slate-700 leading-none">{s.name}</span>
            <span className="text-[9px] font-bold text-slate-400 leading-none">{s.ratio}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-3 py-2.5 shadow-sm">
        <div className="flex items-center gap-1.5">
          <Sym name="image" size={14} className="text-slate-400" />
          <span className="text-[11px] font-bold text-slate-500">高品質PNGで書き出し</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-black text-white rounded-lg px-2.5 py-1.5" style={{ background: '#0066ff' }}>
          <Sym name="download" size={13} />書き出す
        </span>
      </div>
    </div>
  )
}
