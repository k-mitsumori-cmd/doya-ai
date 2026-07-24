// ============================================
// LPキット v2 — 製品を見せるためのショーケース部品
// MockWindow(ブラウザ/アプリ枠) / ProductHero(テキスト+製品モック) / FeatureShowcase(交互ロウ)
// 製品ビジュアルはコード内モック（実機能の様子を表す・PIIなし・捏造の実績数値は使わない）。
// ============================================
import React from 'react'
import Link from 'next/link'
import { Sym, BgDots, SectionHeading } from './primitives'

/** ブラウザ/アプリ風の枠（中に製品モックを入れる） */
export function MockWindow({ title, children, className = '', floating = true }: { title?: string; children: React.ReactNode; className?: string; floating?: boolean }) {
  return (
    <div className={`relative rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xl shadow-slate-300/40 ${floating ? 'animate-fade-in-up' : ''} ${className}`}>
      {/* トップバー */}
      <div className="flex items-center gap-2 px-4 h-10 border-b border-slate-100 bg-slate-50/80">
        <span className="w-3 h-3 rounded-full bg-slate-300" />
        <span className="w-3 h-3 rounded-full bg-slate-300" />
        <span className="w-3 h-3 rounded-full bg-slate-300" />
        {title && (
          <span className="ml-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 bg-white border border-slate-200 rounded-md px-2.5 py-1">
            <Sym name="lock" size={12} />{title}
          </span>
        )}
      </div>
      {/* 中身 */}
      <div className="relative">{children}</div>
    </div>
  )
}

/** 製品フォワードなヒーロー（左テキスト / 右に製品モック） */
export function ProductHero({
  eyebrow, title, highlight, subtitle, note, ctaHref, ctaLabel = '無料ではじめる',
  subCtaHref, subCtaLabel, visual,
}: {
  eyebrow?: string
  title: React.ReactNode
  highlight?: string
  subtitle: string
  note?: string
  ctaHref: string
  ctaLabel?: string
  subCtaHref?: string
  subCtaLabel?: string
  visual: React.ReactNode
}) {
  return (
    <section className="relative overflow-hidden">
      <BgDots />
      <div className="absolute -top-40 -right-20 w-[640px] h-[640px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, rgba(0,102,255,0.12), transparent)' }} aria-hidden="true" />
      <div className="relative z-10 max-w-6xl mx-auto px-5 pt-14 pb-20 md:pt-20 grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
        {/* テキスト */}
        <div className="text-center lg:text-left">
          {eyebrow && (
            <span className="inline-flex items-center gap-1.5 text-xs md:text-sm font-black tracking-wide mb-5 px-3.5 py-1.5 rounded-full animate-fade-in-up"
              style={{ color: 'var(--lp-accent)', background: 'color-mix(in srgb, var(--lp-accent) 12%, transparent)' }}>
              <Sym name="bolt" size={16} />{eyebrow}
            </span>
          )}
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.12] text-slate-900 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
            {title}
            {highlight && (<><br className="hidden sm:block" /><span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #0066ff, var(--lp-accent))' }}>{highlight}</span></>)}
          </h1>
          <p className="mt-6 text-lg md:text-xl text-slate-600 font-bold leading-relaxed animate-fade-in-up max-w-xl lg:max-w-none mx-auto" style={{ animationDelay: '0.12s' }}>{subtitle}</p>
          <div className="mt-9 flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <Link href={ctaHref} className="inline-flex items-center gap-2 px-8 py-4 text-white font-black text-lg rounded-2xl shadow-lg transition-all hover:-translate-y-1 active:scale-[0.97]"
              style={{ background: '#0066ff', boxShadow: '0 12px 30px rgba(0,102,255,0.32)' }}>
              <Sym name="rocket_launch" size={22} />{ctaLabel}
            </Link>
            {subCtaHref && subCtaLabel && (
              <Link href={subCtaHref} className="inline-flex items-center gap-1.5 px-6 py-4 font-bold text-slate-600 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all">
                {subCtaLabel}<Sym name="arrow_forward" size={18} />
              </Link>
            )}
          </div>
          {note && <p className="mt-4 text-xs font-bold text-slate-400 animate-fade-in-up" style={{ animationDelay: '0.28s' }}>{note}</p>}
        </div>
        {/* 製品モック */}
        <div className="relative animate-fade-in-up" style={{ animationDelay: '0.15s' }}>{visual}</div>
      </div>
    </section>
  )
}

/** 交互に並ぶ機能ショーケース（左右入れ替え・製品モック付き） */
export interface ShowcaseRow { icon: string; title: string; desc: string; bullets?: string[]; visual: React.ReactNode }
export function FeatureShowcase({ eyebrow = 'FEATURES', title, lead, rows }: { eyebrow?: string; title: React.ReactNode; lead?: string; rows: ShowcaseRow[] }) {
  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-5">
        <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />
        <div className="space-y-16 md:space-y-24">
          {rows.map((r, i) => (
            <div key={i} className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              {/* テキスト（偶数は左、奇数は右） */}
              <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                <div className="w-12 h-12 rounded-2xl grid place-items-center mb-4"
                  style={{ background: 'color-mix(in srgb, var(--lp-accent) 12%, transparent)', color: 'var(--lp-accent)' }}>
                  <Sym name={r.icon} size={26} />
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 mb-3 tracking-tight">{r.title}</h3>
                <p className="text-base text-slate-500 font-medium leading-relaxed">{r.desc}</p>
                {r.bullets && (
                  <ul className="mt-5 space-y-2.5">
                    {r.bullets.map((b, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm font-bold text-slate-700">
                        <span className="shrink-0 grid place-items-center w-5 h-5 rounded-md mt-0.5" style={{ background: 'color-mix(in srgb, #0066ff 12%, transparent)', color: '#0066ff' }}>
                          <Sym name="check" size={14} fill />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* 製品モック */}
              <div className={i % 2 === 1 ? 'md:order-1' : ''}>{r.visual}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
