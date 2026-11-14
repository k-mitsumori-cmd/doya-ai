'use client'
// ドヤAI LP 共通の9段の型。段の作りと動きの値は共通。サービスごとに変えるのは lp-content.ts と画面の再現だけ。
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, ChevronDown, FileText, Layers, Link2, ListTree, PenLine, Search, ShieldCheck } from 'lucide-react'
import type { BearItem, IconKey, LpKitContent, LpKitVisuals } from './types'
import { cx, useInView, useMotion } from './hooks'
import { PhraseHeading } from './Phrases'
import { ClickSpark, CountUp, Magnet, Marquee, Reveal, ScrollColorText, SpotlightCard, Tilt } from './motion'
import { DemoStage } from './DemoStage'
import { PixelBear, type BearPose } from './PixelBear'

const ICONS: Record<IconKey, typeof Search> = {
  search: Search, list: ListTree, check: ShieldCheck, pen: PenLine, file: FileText, shield: ShieldCheck, link: Link2, layers: Layers,
}

/* ---------------- 主ボタン（押すと火花が出て、少し間を置いて移る） ---------------- */
export function CtaLink({ href, className, children, spark = true }: { href: string; className?: string; children: ReactNode; spark?: boolean }) {
  const router = useRouter()
  const { ok } = useMotion()
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!spark || !ok || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    window.setTimeout(() => router.push(href), 240)
  }
  const a = (
    <Link href={href} className={cx('lpk-btn lpk-btn-pri', className)} onClick={onClick}>
      {children}
    </Link>
  )
  return spark ? (
    <Magnet>
      <ClickSpark>{a}</ClickSpark>
    </Magnet>
  ) : a
}

/* ---------------- 段0 ヘッダー ---------------- */
export function Header({ c }: { c: LpKitContent }) {
  return (
    <header className="lpk-header">
      <div className="lpk-wrap lpk-header-in">
        <a className="lpk-logo" href="#top" aria-label={`${c.serviceName} のトップへ`}>
          <span className="lpk-logo-mark" aria-hidden="true" />
          <span>ドヤAI</span>
          <b>{c.serviceName}</b>
        </a>
        <nav className="lpk-nav" aria-label="ヘッダー">
          <Link href={c.pricingHref}>料金</Link>
          <Link href={c.loginHref}>ログイン</Link>
        </nav>
        <Link href={c.ctaHref} className="lpk-btn lpk-btn-pri lpk-btn-sm">{c.hero.ctaLabel}</Link>
      </div>
    </header>
  )
}

/* ---------------- 段1 ヒーロー ---------------- */
export function Hero({ c }: { c: LpKitContent }) {
  const h = c.hero
  return (
    <section className="lpk-hero" id="top">
      <div className="lpk-wrap lpk-hero-in">
        <p className="lpk-eyebrow lpk-up" style={{ ['--d' as string]: '0ms' }}>{c.serviceName}</p>
        <PhraseHeading as="h1" spec={h.heading} mode="load" className="lpk-h1" />
        <p className="lpk-sub lpk-up" style={{ ['--d' as string]: '320ms' }}>{h.sub}</p>
        <div className="lpk-cta-row lpk-up" style={{ ['--d' as string]: '400ms' }}>
          <CtaLink href={c.ctaHref}>
            {h.ctaLabel}
            <ArrowRight size={18} aria-hidden="true" />
          </CtaLink>
          <a href="#demo" className="lpk-btn lpk-btn-sec lpk-press" onClick={() => window.dispatchEvent(new Event('lpk:replay'))}>
            {h.subCtaLabel}
          </a>
        </div>
        <p className="lpk-note lpk-up" style={{ ['--d' as string]: '460ms' }}>{h.note}</p>
        <ul className="lpk-facts lpk-up" style={{ ['--d' as string]: '520ms' }}>
          {h.facts.map((f) => (
            <li key={f}>
              <Check size={16} aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------------- 段2 実演の舞台 ---------------- */
export function StageSection({ c, v }: { c: LpKitContent; v: LpKitVisuals }) {
  const s = c.stage
  return (
    <section className="lpk-sec lpk-sec-soft lpk-stage-sec" id="demo">
      <div className="lpk-wrap lpk-center">
        <PhraseHeading spec={s.heading} />
        <Reveal as="p" className="lpk-lead" delay={60}>{s.lead}</Reveal>
      </div>
      <Reveal className="lpk-stage-wrap" delay={120}>
        <DemoStage title={s.windowTitle} tabs={s.tabs} duration={s.duration} hold={s.hold} render={v.demo} />
        <p className="lpk-caption">{s.caption}</p>
      </Reveal>
      <Reveal className="lpk-wrap lpk-flow-wrap" delay={60}>{v.flow}</Reveal>
    </section>
  )
}

/* ---------------- 段3 事実の帯 ---------------- */
export function StatsSection({ c }: { c: LpKitContent }) {
  const s = c.stats
  return (
    <section className="lpk-sec lpk-sec-stats" aria-label="できること">
      <div className="lpk-wrap">
        <ul className="lpk-stats">
          {s.items.map((it, i) => (
            <Reveal as="li" key={it.label} className="lpk-stat" delay={i * 60}>
              <p className="lpk-stat-num">
                <CountUp value={it.value} />
                <span className="lpk-stat-unit">{it.unit}</span>
              </p>
              <p className="lpk-stat-label">{it.label}</p>
            </Reveal>
          ))}
        </ul>
      </div>
      <Marquee items={s.marquee} label={s.marqueeLabel} />
    </section>
  )
}

/* ---------------- 段4 作れる物の見本 ---------------- */
export function ShowcaseSection({ c, v }: { c: LpKitContent; v: LpKitVisuals }) {
  const s = c.showcase
  return (
    <section className="lpk-sec" id="samples">
      <div className="lpk-wrap">
        <div className="lpk-center">
          <PhraseHeading spec={s.heading} />
          <Reveal as="p" className="lpk-lead" delay={60}>{s.lead}</Reveal>
        </div>
        <ul className="lpk-cards">
          {s.items.map((it, i) => (
            <Reveal as="li" key={it.title} className="lpk-cardli" delay={(i % 3) * 60}>
              <Tilt className="lpk-card">
                <div className="lpk-card-vis">{v.outputs[i]}</div>
                <div className="lpk-card-body">
                  <h3>{it.title}</h3>
                  <p className="lpk-kw"><span>入れたキーワード</span>{it.keyword}</p>
                  <p className="lpk-card-note">{it.note}</p>
                </div>
              </Tilt>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------------- 段5 機能の見せ場（PC は見出しを左に固定し、右の画面を切り替える） ---------------- */
export function FeaturesSection({ c, v }: { c: LpKitContent; v: LpKitVisuals }) {
  const f = c.features
  const outer = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const near = useInView(outer, { margin: '-25% 0px -25% 0px' })
  useEffect(() => {
    const el = outer.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      if (window.innerWidth < 1024) return
      const r = el.getBoundingClientRect()
      const travel = r.height - (el.firstElementChild as HTMLElement).offsetHeight
      const p = Math.min(0.999, Math.max(0, (72 - r.top) / Math.max(1, travel)))
      setActive(Math.floor(p * f.items.length))
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      cancelAnimationFrame(raf)
    }
  }, [f.items.length])

  return (
    <section className="lpk-sec lpk-sec-soft lpk-feat" id="features">
      <div className="lpk-wrap">
        {/* スマホ・タブレット（と JS が動かないとき）: 機能ごとに文と画面を縦に並べる */}
        <div className="lpk-feat-m">
          <div className="lpk-center">
            <PhraseHeading spec={f.heading} />
          </div>
          {f.items.map((it, i) => {
            const Icon = ICONS[it.icon]
            return (
              <Reveal key={it.title} className="lpk-feat-card" delay={0}>
                <span className="lpk-ico"><Icon size={22} aria-hidden="true" /></span>
                <h3>{it.title}</h3>
                <p>{it.desc}</p>
                <ul className="lpk-bullets">{it.bullets.map((b) => <li key={b}><Check size={16} aria-hidden="true" />{b}</li>)}</ul>
                <div className="lpk-fpanel"><div className="lpk-fp">{v.features[i]}</div></div>
              </Reveal>
            )
          })}
        </div>

        {/* PC: 左を固定し、右の画面を切り替える */}
        <div className="lpk-feat-d" ref={outer} style={{ ['--n' as string]: f.items.length }}>
          <div className="lpk-feat-sticky">
            <div className="lpk-feat-left">
              <PhraseHeading spec={f.heading} className="lpk-h-left" />
              <ol className="lpk-feat-list">
                {f.items.map((it, i) => {
                  const Icon = ICONS[it.icon]
                  return (
                    <li key={it.title} className={cx(i === active && 'on')}>
                      <span className="lpk-ico"><Icon size={20} aria-hidden="true" /></span>
                      <div>
                        <h3>{it.title}</h3>
                        <div className="lpk-feat-more">
                          <div>
                            <p>{it.desc}</p>
                            <ul className="lpk-bullets">{it.bullets.map((b) => <li key={b}><Check size={16} aria-hidden="true" />{b}</li>)}</ul>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
            <SpotlightCard className="lpk-fpanel lpk-fpanel-d">
              {f.items.map((it, i) => (
                <div key={it.title} className={cx('lpk-fp', i === active && near && 'is-active')} aria-hidden={i !== active}>
                  {v.features[i]}
                </div>
              ))}
            </SpotlightCard>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------- 段6 大きな一言 ---------------- */
export function StatementSection({ c }: { c: LpKitContent }) {
  const s = c.statement
  return (
    <section className="lpk-sec lpk-sec-navy lpk-statement">
      <div className="lpk-wrap lpk-center">
        <p className="lpk-label">{s.label}</p>
        <ScrollColorText phrases={s.phrases} breakPc={s.breakPc} breakSp={s.breakSp} />
      </div>
    </section>
  )
}

/* ---------------- 段7 使い方3ステップ（ドット絵のクマが線の上を進む） ---------------- */
function StepsBear({ items, lines }: { items: BearItem[]; lines: string[] }) {
  const { ok } = useMotion()
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const pos = useRef<HTMLDivElement>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [moving, setMoving] = useState(false)
  const [hop, setHop] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)
  const clicks = useRef(0)
  const lastP = useRef(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const el = root.current
    const tr = track.current
    const ps = pos.current
    if (!el || !tr || !ps) return
    if (!ok) {
      ps.style.transform = 'translate(0px,0px)'
      return
    }
    let raf = 0
    let stopT = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const p = Math.min(1, Math.max(0, (vh * 0.62 - r.top) / Math.max(1, r.height)))
      const horizontal = window.innerWidth >= 768
      const max = horizontal ? tr.clientWidth - ps.offsetWidth : tr.clientHeight - ps.offsetHeight
      const v = Math.max(0, max) * p
      ps.style.transform = horizontal ? `translate(${v}px,0px)` : `translate(0px,${v}px)`
      setStepIdx(Math.min(items.length - 1, Math.floor(p * items.length)))
      if (Math.abs(p - lastP.current) > 0.002) {
        setMoving(true)
        window.clearTimeout(stopT)
        stopT = window.setTimeout(() => setMoving(false), 180)
      }
      lastP.current = p
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      cancelAnimationFrame(raf)
      window.clearTimeout(stopT)
    }
  }, [ok, items.length])

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const press = async () => {
    clicks.current += 1
    const line = clicks.current % 5 === 0 ? 'やったね！ 5回、押してくれました。' : lines[(clicks.current - 1) % lines.length]
    setBubble(line)
    if (ok) {
      setHop(true)
      timers.current.push(window.setTimeout(() => setHop(false), 560))
      if (clicks.current % 5 === 0) {
        try {
          const confetti = (await import('canvas-confetti')).default
          const b = pos.current?.getBoundingClientRect()
          confetti({
            particleCount: 40,
            spread: 70,
            startVelocity: 28,
            ticks: 90,
            origin: b ? { x: (b.left + b.width / 2) / window.innerWidth, y: (b.top + b.height / 2) / window.innerHeight } : undefined,
            colors: ['#0066ff', '#ffd400', '#00e0ff', '#ff1e72'],
            disableForReducedMotion: true,
          })
        } catch {
          /* 紙吹雪が出なくても動作に影響しない */
        }
      }
    }
    timers.current.push(window.setTimeout(() => setBubble(null), 2400))
  }

  const pose: BearPose = hop ? 'jump' : moving && ok ? 'walk' : 'stand'
  return (
    <div ref={root} className="lpk-bear-area">
      <div ref={track} className="lpk-track" aria-hidden={false}>
        <span className="lpk-track-line" aria-hidden="true" />
        <div ref={pos} className="lpk-bear-pos">
          <button type="button" className={cx('lpk-bear-btn', hop && 'hop')} onClick={press} aria-label="クマを押すと、ひとこと話します">
            <PixelBear pose={pose} item={items[stepIdx]} size={64} />
          </button>
          <span className={cx('lpk-bubble', bubble && 'on')} role="status" aria-live="polite">{bubble}</span>
        </div>
      </div>
    </div>
  )
}

export function StepsSection({ c }: { c: LpKitContent }) {
  const s = c.steps
  const icons: IconKey[] = ['search', 'pen', 'check']
  return (
    <section className="lpk-sec" id="steps">
      <div className="lpk-wrap">
        <div className="lpk-center">
          <PhraseHeading spec={s.heading} />
        </div>
        <div className="lpk-steps">
          <StepsBear items={s.items.map((i) => i.item)} lines={s.bearLines} />
          <ol className="lpk-step-list">
            {s.items.map((it, i) => {
              const Icon = ICONS[icons[i] ?? 'search']
              return (
                <Reveal as="li" key={it.title} className="lpk-step" delay={i * 60}>
                  <span className="lpk-step-n">{i + 1}</span>
                  <span className="lpk-ico"><Icon size={20} aria-hidden="true" /></span>
                  <h3>{it.title}</h3>
                  <p>{it.desc}</p>
                </Reveal>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* ---------------- 段8 よくある質問 ---------------- */
export function FaqSection({ c }: { c: LpKitContent }) {
  const f = c.faq
  return (
    <section className="lpk-sec lpk-sec-soft" id="faq">
      <div className="lpk-wrap lpk-faq-wrap">
        <div className="lpk-center">
          <PhraseHeading spec={f.heading} />
        </div>
        <div className="lpk-faq">
          {f.items.map((it, i) => (
            <Reveal key={it.q} delay={i * 60}>
              <details className="lpk-q" open={i === 0}>
                <summary>
                  <span>{it.q}</span>
                  <ChevronDown size={20} aria-hidden="true" />
                </summary>
                <div className="lpk-a"><div><p>{it.a}</p></div></div>
              </details>
            </Reveal>
          ))}
        </div>
        <p className="lpk-faq-link">
          <Link href={c.pricingHref}>
            {f.pricingLinkLabel}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </p>
      </div>
    </section>
  )
}

/* ---------------- 段9 最後の CTA ---------------- */
export function FinalCta({ c }: { c: LpKitContent }) {
  const h = c.hero
  const f = c.finalCta
  const [hop, setHop] = useState(false)
  return (
    <section className="lpk-final">
      <div className="lpk-wrap lpk-final-in">
        <div className="lpk-final-text">
          <PhraseHeading spec={f.heading} className="lpk-h-final" />
          <div className="lpk-cta-row">
            <span onPointerDown={() => { setHop(true); window.setTimeout(() => setHop(false), 600) }}>
              <CtaLink href={c.ctaHref} className="lpk-btn-onnavy">
                {h.ctaLabel}
                <ArrowRight size={18} aria-hidden="true" />
              </CtaLink>
            </span>
            <a href="#demo" className="lpk-btn lpk-btn-ghost lpk-press" onClick={() => window.dispatchEvent(new Event('lpk:replay'))}>{h.subCtaLabel}</a>
          </div>
          <p className="lpk-note lpk-note-onnavy">{h.note}</p>
        </div>
        <div className={cx('lpk-final-img', hop && 'hop')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.imageSrc} alt={f.imageAlt} width={512} height={512} loading="lazy" decoding="async" />
        </div>
      </div>
    </section>
  )
}

/* ---------------- フッター（動きを止める切り替えを含む） ---------------- */
export function Footer({ c, still, onToggleStill }: { c: LpKitContent; still: boolean; onToggleStill: () => void }) {
  return (
    <footer className="lpk-footer">
      <div className="lpk-wrap lpk-footer-in">
        <nav aria-label="フッター" className="lpk-footer-nav">
          {c.footerLinks.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
        </nav>
        <button type="button" className="lpk-still-btn lpk-press" onClick={onToggleStill} aria-pressed={still}>
          {still ? '動きを再開する' : '動きを止める'}
        </button>
        <p className="lpk-copy">運営：株式会社スリスタ</p>
      </div>
    </footer>
  )
}
