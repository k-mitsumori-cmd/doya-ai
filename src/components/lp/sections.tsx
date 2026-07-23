// ============================================
// LP共通セクション部品（Sales Marker型の説得構成）
// Hero → HowItWorks(3ステップ) → Benefits → FeatureGrid → UseCases → Faq → CtaBand
// すべてサーバーコンポーネント（アニメはCSSクラス／FAQは native <details>）。
// 実績数値・導入企業ロゴ・顧客の声など「事実でない証拠」は作らない方針。
// ============================================
import React from 'react'
import Link from 'next/link'
import { Sym, BgDots, SectionHeading } from './primitives'
import { DoyaKun, type Mood } from './DoyaKun'

// ---------- Hero ----------
export function Hero({
  eyebrow,
  title,
  highlight,
  subtitle,
  note,
  ctaHref,
  ctaLabel = '無料ではじめる',
  subCtaHref,
  subCtaLabel,
  mood = 'present',
}: {
  eyebrow?: string
  /** 見出し（highlight を含まない前半） */
  title: React.ReactNode
  /** グラデ強調する語 */
  highlight?: string
  subtitle: string
  note?: string
  ctaHref: string
  ctaLabel?: string
  subCtaHref?: string
  subCtaLabel?: string
  mood?: Mood
}) {
  return (
    <section className="relative overflow-hidden">
      <BgDots />
      {/* 上部のブランドグロー */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, rgba(0,102,255,0.10), transparent)' }} aria-hidden="true" />
      <div className="relative z-10 max-w-4xl mx-auto px-5 pt-16 pb-16 md:pt-24 md:pb-20 text-center">
        <div className="flex justify-center mb-6">
          <DoyaKun mood={mood} size={132} priority />
        </div>
        {eyebrow && (
          <span className="inline-flex items-center gap-1.5 text-xs md:text-sm font-black tracking-wide mb-5 px-3.5 py-1.5 rounded-full animate-fade-in-up"
            style={{ color: 'var(--lp-accent)', background: 'color-mix(in srgb, var(--lp-accent) 12%, transparent)' }}>
            <Sym name="bolt" size={16} />
            {eyebrow}
          </span>
        )}
        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.12] text-slate-900 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          {title}
          {highlight && (
            <>
              <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #0066ff, var(--lp-accent))' }}>{highlight}</span>
            </>
          )}
        </h1>
        <p className="mt-6 text-lg md:text-xl text-slate-600 font-bold leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.12s' }}>
          {subtitle}
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <Link href={ctaHref}
            className="inline-flex items-center gap-2 px-9 py-4 text-white font-black text-lg rounded-2xl shadow-lg transition-all hover:-translate-y-1 active:scale-[0.97]"
            style={{ background: '#0066ff', boxShadow: '0 12px 30px rgba(0,102,255,0.32)' }}>
            <Sym name="rocket_launch" size={22} />
            {ctaLabel}
          </Link>
          {subCtaHref && subCtaLabel && (
            <Link href={subCtaHref}
              className="inline-flex items-center gap-1.5 px-6 py-4 font-bold text-slate-600 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all">
              {subCtaLabel}
              <Sym name="arrow_forward" size={18} />
            </Link>
          )}
        </div>
        {note && <p className="mt-4 text-xs font-bold text-slate-400 animate-fade-in-up" style={{ animationDelay: '0.28s' }}>{note}</p>}
      </div>
    </section>
  )
}

// ---------- How it works（3ステップ） ----------
export interface Step { title: string; desc: string; icon: string }
export function HowItWorks({ eyebrow = 'HOW IT WORKS', title, lead, steps }: { eyebrow?: string; title: React.ReactNode; lead?: string; steps: Step[] }) {
  return (
    <section className="relative py-20 md:py-28 bg-slate-50/70">
      <div className="max-w-6xl mx-auto px-5">
        <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((s, i) => (
            <div key={s.title} className="relative bg-white rounded-3xl border border-slate-100 p-8 shadow-sm animate-fade-in-up" style={{ animationDelay: `${0.08 * i}s` }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="grid place-items-center w-11 h-11 rounded-2xl text-white font-black shadow-md"
                  style={{ background: 'linear-gradient(135deg, #0066ff, var(--lp-accent))' }}>{i + 1}</span>
                <Sym name={s.icon} size={26} className="text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">{s.title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{s.desc}</p>
              {i < steps.length - 1 && (
                <Sym name="arrow_forward" size={22} className="hidden md:block absolute top-1/2 -right-5 -translate-y-1/2 text-slate-300 z-10" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- Benefits（価値提案 3枚） ----------
export interface Benefit { title: string; desc: string; icon: string }
export function Benefits({ title, lead, items }: { title: React.ReactNode; lead?: string; items: Benefit[] }) {
  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-5">
        <SectionHeading eyebrow="WHY" title={title} lead={lead} />
        <div className="grid md:grid-cols-3 gap-6">
          {items.map((b, i) => (
            <div key={b.title} className="group relative bg-white rounded-3xl border border-slate-100 p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all animate-fade-in-up" style={{ animationDelay: `${0.06 * i}s` }}>
              <div className="w-14 h-14 rounded-2xl grid place-items-center mb-5"
                style={{ background: 'color-mix(in srgb, var(--lp-accent) 12%, transparent)', color: 'var(--lp-accent)' }}>
                <Sym name={b.icon} size={28} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">{b.title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- Feature grid（services.ts の features を流用） ----------
export function FeatureGrid({ title = '主な機能', lead, features }: { title?: React.ReactNode; lead?: string; features: string[] }) {
  return (
    <section className="relative py-20 md:py-28 bg-slate-50/70">
      <div className="max-w-5xl mx-auto px-5">
        <SectionHeading eyebrow="FEATURES" title={title} lead={lead} />
        <div className="grid sm:grid-cols-2 gap-4">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-3 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm animate-fade-in-up" style={{ animationDelay: `${0.04 * i}s` }}>
              <span className="shrink-0 grid place-items-center w-8 h-8 rounded-lg mt-0.5"
                style={{ background: 'color-mix(in srgb, #0066ff 10%, transparent)', color: '#0066ff' }}>
                <Sym name="check" size={18} fill />
              </span>
              <p className="text-sm md:text-base font-bold text-slate-700 leading-relaxed">{f}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- Use cases（こんな方に） ----------
export function UseCases({ title = 'こんな課題を解決します', items }: { title?: React.ReactNode; items: string[] }) {
  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-4xl mx-auto px-5">
        <SectionHeading eyebrow="USE CASES" title={title} />
        <div className="space-y-3">
          {items.map((u, i) => (
            <div key={i} className="flex items-center gap-4 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm animate-fade-in-up" style={{ animationDelay: `${0.04 * i}s` }}>
              <Sym name="arrow_circle_right" size={26} style={{ color: 'var(--lp-accent)' } as React.CSSProperties} />
              <p className="text-sm md:text-base font-bold text-slate-700">{u}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- FAQ（native details = JSなし・LLMO/リッチリザルト向き） ----------
export interface Faq { q: string; a: string }
export function FaqSection({ title = 'よくある質問', items }: { title?: React.ReactNode; items: Faq[] }) {
  if (!items?.length) return null
  return (
    <section className="relative py-20 md:py-28 bg-slate-50/70">
      <div className="max-w-3xl mx-auto px-5">
        <SectionHeading eyebrow="FAQ" title={title} />
        <div className="space-y-3">
          {items.map((f, i) => (
            <details key={i} className="group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none p-5">
                <span className="flex items-start gap-3 font-black text-slate-900">
                  <span className="shrink-0 font-black" style={{ color: 'var(--lp-accent)' }}>Q.</span>
                  {f.q}
                </span>
                <Sym name="expand_more" size={24} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-5 pb-5 pl-11 text-sm text-slate-600 font-medium leading-relaxed">{f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- CTA band（最終導線） ----------
export function CtaBand({ title, subtitle, ctaHref, ctaLabel = '無料ではじめる', note, mood = 'jump' }: { title: React.ReactNode; subtitle?: string; ctaHref: string; ctaLabel?: string; note?: string; mood?: Mood }) {
  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-5xl mx-auto px-5">
        <div className="relative overflow-hidden rounded-[2.5rem] px-6 py-16 md:py-20 text-center text-white"
          style={{ background: 'linear-gradient(135deg, #0047b3, #0066ff 55%, var(--lp-accent))' }}>
          <div className="absolute inset-0 opacity-20 bg-dots-pattern bg-dots" aria-hidden="true" />
          <div className="relative z-10">
            <div className="flex justify-center mb-6"><DoyaKun mood={mood} size={104} /></div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">{title}</h2>
            {subtitle && <p className="mt-4 text-base md:text-lg font-bold text-white/85 max-w-xl mx-auto">{subtitle}</p>}
            <div className="mt-9">
              <Link href={ctaHref}
                className="inline-flex items-center gap-2 px-10 py-4 bg-white font-black text-lg rounded-2xl shadow-xl transition-all hover:-translate-y-1 active:scale-[0.97]"
                style={{ color: '#0066ff' }}>
                <Sym name="rocket_launch" size={22} />
                {ctaLabel}
              </Link>
            </div>
            {note && <p className="mt-4 text-xs font-bold text-white/70">{note}</p>}
          </div>
        </div>
      </div>
    </section>
  )
}
