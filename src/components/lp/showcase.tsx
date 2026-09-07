// ============================================
// LPキット v2 — 製品を見せるためのショーケース部品
// MockWindow(ブラウザ/アプリ枠) / ProductHero(テキスト+製品モック) / FeatureShowcase(交互ロウ)
// 製品ビジュアルはコード内モック（実機能の様子を表す・PIIなし・捏造の実績数値は使わない）。
// ============================================
import React from 'react'
import { RenewalHero } from './renewal/Renewal'
import { ProductPreview } from './renewal/ProductPreview'
import Link from 'next/link'
import Image from 'next/image'
import { Sym, BgDots, SectionHeading } from './primitives'

/** ブラウザ/アプリ風の枠（中に製品モックを入れる） */
export function MockWindow({ title, children, className = '', floating = true }: { title?: string; children: React.ReactNode; className?: string; floating?: boolean }) {
  return (
    <div data-mock-window role="img" aria-label={`${title || "製品画面"}の操作イメージ`} className={`relative rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xl shadow-slate-300/40 ${floating ? 'animate-fade-in-up' : ''} ${className}`}>
      {/* React 18 requires an empty HTML attribute; newer React typings declare inert as boolean. */}
      <div aria-hidden="true" inert={'' as unknown as boolean}>
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
      <div className="relative doya-mock-content">{children}</div>
      </div>
    </div>
  )
}

/** 製品フォワードなヒーロー（左テキスト / 右に製品モック） */
export function ProductHero({
  eyebrow, title, highlight, subtitle, note, ctaHref, ctaLabel = '無料ではじめる',
  subCtaHref, subCtaLabel, visual, image,
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
  /** コード内モック。image を渡した場合はそちらが優先される */
  visual?: React.ReactNode
  /**
   * 実画面キャプチャのヒーロー画像（public/<id>/hero.webp）。
   * ⚠️ 実体が無いパスを渡すと画像が割れる。置いてから渡すこと。
   */
  image?: { src: string; alt: string }
}) {
  return <RenewalHero {...{ eyebrow, title, highlight, subtitle, note, ctaHref, ctaLabel, subCtaHref, subCtaLabel, visual, image }} />
}

/** 交互に並ぶ機能ショーケース（左右入れ替え・製品モック付き） */
export interface ShowcaseRow {
  icon: string
  title: string
  desc: string
  bullets?: string[]
  /** コード内モック。image を渡した場合は image を優先する */
  visual?: React.ReactNode
  /** 実画面キャプチャ（public/<id>/shots/*.webp） */
  image?: { src: string; alt: string }
}
export function FeatureShowcase({ eyebrow = 'FEATURES', title, lead, rows }: { eyebrow?: string; title: React.ReactNode; lead?: string; rows: ShowcaseRow[] }) {
  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-5">
        <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />
        <div className="space-y-16 md:space-y-24">
          {rows.map((r, i) => (
            <div key={i} className="doya-feature-row grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              {/* テキスト（偶数は左、奇数は右） */}
              <div className={i % 2 === 1 ? 'md:order-2' : ''}><div className="doya-feature-number">FEATURE {String(i + 1).padStart(2, '0')}</div>
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
              <ProductPreview className={i % 2 === 1 ? 'md:order-1' : ''} src={r.image?.src} alt={`${r.title}の画面`}>
                {r.visual ? r.visual : r.image ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_48px_rgba(10,15,60,0.14)]">
                    <Image
                      src={r.image.src}
                      alt={r.image.alt}
                      width={1280}
                      height={800}
                      sizes="(max-width: 768px) 100vw, 560px"
                      className="h-auto w-full"
                    />
                  </div>
                ) : r.visual}
              </ProductPreview>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
