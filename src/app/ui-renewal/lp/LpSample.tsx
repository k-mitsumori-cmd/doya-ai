'use client'

// ドヤAI 入口LPのデザイン見本。右下の切り替えで4案を見比べる。
// 案ごとにヒーローの構成から変える（色だけの差にしない）。
// 数値はすべて見本。サービス名・説明・料金は正本（services.ts / unified-plan.ts）から引く。
import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  ArrowUp,
  Building2,
  Check,
  Image as ImageIcon,
  MessageSquareText,
  PenLine,
  Sparkles,
  UserRoundCheck,
  Wand2,
} from 'lucide-react'
import s from '../renewal.module.css'
import l from './lp.module.css'
import { Cursor } from '../Cursor'
import { DesignDock, useDesign, type Design } from '../design'
import { CountUp, SplitText, useInView, useReveal } from '../motion'
import { STAGES, mascotOf, stageServices } from '../data'
import { getPublicServices, getServiceById } from '@/lib/services'
import { UNIFIED_PLAN_COPY, UNIFIED_PRO_PRICE_LABEL } from '@/lib/unified-plan'

const APP_HREF = '/ui-renewal'

export function LpSample() {
  const { design, setDesign, cursorOn, setCursorOn } = useDesign()
  const root = useReveal<HTMLDivElement>([design])
  const aiCount = getPublicServices().length

  // カーソルに追従する光（data-spot の要素だけ）
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest?.('[data-spot]') as HTMLElement | null
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <div
      ref={root}
      className={`${s.root} ${l.lp}`}
      data-design={design}
      data-cursor-fx={cursorOn ? 'on' : 'off'}
      onPointerMove={onPointerMove}
    >
      <Cursor enabled={cursorOn} />
      <div className={s.proposalBar}>
        <span className={s.proposalTag}>提案</span>
        LPデザイン案の見本です。右下で4つの案を切り替えられます。数値はすべて見本です。
      </div>

      <Nav />
      <Hero key={design} design={design} aiCount={aiCount} />
      <Steps />
      <MapTeaser aiCount={aiCount} />
      <Features />
      <Numbers aiCount={aiCount} />
      <Pricing />
      <Faq aiCount={aiCount} />
      <CtaBand />
      <Footer />

      <DesignDock design={design} onChange={setDesign} cursorOn={cursorOn} onCursor={setCursorOn} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={l.nav} data-scrolled={scrolled ? '' : undefined}>
      <a href="#top" className={l.brand}>
        <img src="/character/hello-256.webp" alt="" width={30} height={30} />
        ドヤAI
      </a>
      <nav className={l.navLinks} aria-label="ページ内">
        <a href="#map">AIの一覧</a>
        <a href="#features">できること</a>
        <a href="#pricing">料金</a>
        <a href="#faq">よくある質問</a>
      </nav>
      <a href={APP_HREF} className={l.navCta} data-magnetic data-cursor="はじめる">
        無料ではじめる
      </a>
    </header>
  )
}

/* ---------- 「AIに頼む」のデモ：例文を打ち、振り分け先を見せる ---------- */
const DEMOS = [
  { text: '秋の限定メニューのバナーを4案つくって', id: 'banner' },
  { text: '「カフェ 集客」で記事の構成を考えて', id: 'seo' },
  { text: '明日の商談先の会社を調べておいて', id: 'shodan' },
  { text: '一次面接をAIに任せたい', id: 'mensetsu' },
]

function AskDemo({ compact = false }: { compact?: boolean }) {
  const [i, setI] = useState(0)
  const [typed, setTyped] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTyped(DEMOS[i].text)
      setDone(true)
      return
    }
    let pos = 0
    setDone(false)
    const full = DEMOS[i].text
    const t = setInterval(() => {
      pos += 1
      setTyped(full.slice(0, pos))
      if (pos >= full.length) {
        clearInterval(t)
        setDone(true)
        setTimeout(() => setI((n) => (n + 1) % DEMOS.length), 2200)
      }
    }, 60)
    return () => clearInterval(t)
  }, [i])
  const svc = getServiceById(DEMOS[i].id)
  return (
    <div className={`${l.ask} ${compact ? l.askCompact : ''}`}>
      <div className={l.askBox}>
        <Sparkles size={18} strokeWidth={1.75} className={l.askSpark} />
        <span className={l.askText}>
          {typed}
          <i className={l.caret} />
        </span>
        <a href={APP_HREF} className={l.askSend} data-magnetic data-cursor="試す" aria-label="AIに頼む（見本の画面へ）">
          <ArrowUp size={18} strokeWidth={2.25} />
        </a>
      </div>
      <div className={l.askRoute} data-on={done ? '' : undefined} aria-live="polite">
        <img src={mascotOf(DEMOS[i].id)} alt="" width={28} height={28} />
        <span>
          <b>{svc?.name}</b> で進めます
        </span>
      </div>
    </div>
  )
}

/* ---------- 製品画面のモック（ウィンドウ枠で見せる・Attio型） ---------- */
function AppMock({ tilt = false }: { tilt?: boolean }) {
  return (
    <div className={`${l.window} ${tilt ? l.windowTilt : ''}`} data-spot>
      <div className={l.winBar}>
        <i />
        <i />
        <i />
        <span className={l.winUrl}>doya-ai.surisuta.jp</span>
      </div>
      <div className={l.winBody}>
        <aside className={l.winSide}>
          <span className={l.winLogo}>
            <img src="/character/hello-256.webp" alt="" width={18} height={18} /> ドヤAI
          </span>
          {STAGES.map((st) => (
            <span key={st.id} className={l.winNav} style={{ '--c': st.color } as CSSProperties}>
              <i />
              {st.label}
            </span>
          ))}
        </aside>
        <div className={l.winMain}>
          <p className={l.winHello}>おはようございます。今日は何を任せますか。</p>
          <div className={l.winAsk}>
            <Sparkles size={12} /> バナーを4案つくって
          </div>
          <div className={l.winKpis}>
            <span>
              <small>任せた時間</small>
              <b>42.5h</b>
            </span>
            <span>
              <small>成果物</small>
              <b>128件</b>
            </span>
            <span>
              <small>残り回数</small>
              <b>37回</b>
            </span>
          </div>
          <div className={l.winBanners}>
            {['cat-food', 'purpose-sns_ad', 'cat-beauty', 'purpose-campaign'].map((n, i) => (
              <span key={n} style={{ '--i': i } as CSSProperties}>
                <img src={`/banner-samples/${n}.webp`} alt="" loading="lazy" />
                <b>{[92, 88, 84, 79][i]}</b>
              </span>
            ))}
          </div>
          <div className={l.winChart} aria-hidden="true">
            {[9, 12, 10, 16, 14, 21, 19, 27, 24, 30, 28, 34].map((v, i) => (
              <span key={i} style={{ '--h': v / 34, '--i': i } as CSSProperties} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Ctas() {
  return (
    <div className={l.ctas}>
      <a href={APP_HREF} className={s.btnPrimary} data-magnetic data-cursor="はじめる">
        <span>無料ではじめる</span>
        <span className={s.arw}>
          <ArrowRight size={15} strokeWidth={2} />
        </span>
      </a>
      <a href="#map" className={l.ghost} data-cursor="見る">
        AIの一覧を見る
      </a>
    </div>
  )
}

/* ---------- ヒーロー：案ごとに構成を変える ---------- */
function Hero({ design, aiCount }: { design: Design; aiCount: number }) {
  const label = `${aiCount}のAIを、1つのアカウントで`
  if (design === 'aurora') {
    return (
      <section id="top" className={`${l.hero} ${l.heroAurora}`}>
        <span className={l.blobs} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <p className={l.pill} data-reveal>
          <Wand2 size={14} /> {label}
        </p>
        <h1 className={l.auroraTitle}>
          <SplitText text="仕事の流れごと、" />
          <br />
          <SplitText text="AIに任せる。" delay={300} />
        </h1>
        <p className={l.lead} data-reveal style={{ '--d': '.4s' } as CSSProperties}>
          バナーも、記事も、商談の準備も。やりたいことを書くだけで、合うAIが動き出します。
        </p>
        <div data-reveal style={{ '--d': '.55s' } as CSSProperties}>
          <AskDemo />
        </div>
        <div data-reveal style={{ '--d': '.7s' } as CSSProperties}>
          <Ctas />
        </div>
        {/* 浮遊カード */}
        <div className={`${l.float} ${l.f1}`} aria-hidden="true">
          <img src="/banner-samples/cat-food.webp" alt="" />
          <span>おすすめ 92点</span>
        </div>
        <div className={`${l.float} ${l.f2}`} aria-hidden="true">
          <small>今月任せた時間（見本）</small>
          <b>42.5時間</b>
        </div>
        <div className={`${l.float} ${l.f3}`} aria-hidden="true">
          <img src="/ui-renewal/mascots/seo.webp" alt="" />
          <span>構成ができました</span>
        </div>
        <div className={`${l.float} ${l.f4}`} aria-hidden="true">
          <img src="/doyaslide/template-covers/04-gentle-pastel.webp" alt="" />
        </div>
      </section>
    )
  }
  if (design === 'midnight') {
    return (
      <section id="top" className={`${l.hero} ${l.heroMidnight}`}>
        <span className={l.gridBg} aria-hidden="true" />
        <span className={s.heroGrain} aria-hidden="true" />
        <p className={l.mono} data-reveal>
          DOYA AI / AI WORKSPACE
        </p>
        <h1 className={l.nightTitle}>
          <SplitText text="AIが、チームの一員になる。" />
          <span className={l.nightMute}>
            <SplitText text={`${aiCount}のAIが、集客から採用まで仕事を進めます。`} delay={380} />
          </span>
        </h1>
        <div className={l.nightRow} data-reveal style={{ '--d': '.5s' } as CSSProperties}>
          <AskDemo compact />
          <Ctas />
        </div>
        <div className={l.nightStage} data-reveal style={{ '--d': '.7s' } as CSSProperties}>
          <span className={l.glow} aria-hidden="true" />
          <AppMock tilt />
        </div>
      </section>
    )
  }
  if (design === 'pop') {
    return (
      <section id="top" className={`${l.hero} ${l.heroPop}`}>
        <div className={l.bento}>
          <div className={`${l.box} ${l.boxTitle}`} data-reveal>
            <p className={l.sticker}>{label}</p>
            <h1>
              <SplitText text="めんどうな仕事、" />
              <br />
              <SplitText text="ぜんぶAIに。" delay={260} />
            </h1>
            <Ctas />
          </div>
          <div className={`${l.box} ${l.boxBear}`} data-reveal style={{ '--d': '.1s' } as CSSProperties}>
            <img src="/renewal/bear-hero.webp" alt="ドヤAIのキャラクター" />
            <span className={l.bubble}>まかせて</span>
          </div>
          <div className={`${l.box} ${l.boxAsk}`} data-reveal style={{ '--d': '.2s' } as CSSProperties}>
            <p className={l.boxLabel}>AIに頼む</p>
            <AskDemo compact />
          </div>
          <div className={`${l.box} ${l.boxStat}`} data-reveal style={{ '--d': '.3s' } as CSSProperties}>
            <b>{aiCount}</b>
            <span>のAIが使い放題</span>
          </div>
          <div className={`${l.box} ${l.boxShot}`} data-reveal style={{ '--d': '.4s' } as CSSProperties}>
            <img src="/banner-samples/purpose-sns_ad.webp" alt="" />
          </div>
        </div>
        <Marquee />
      </section>
    )
  }
  // clear：左に言葉、右に製品画面の分割型
  return (
    <section id="top" className={`${l.hero} ${l.heroClear}`}>
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <i key={c} className={s.cross} data-c={c} aria-hidden="true" />
      ))}
      <div className={l.clearCopy}>
        <p className={s.eyebrow} data-reveal>
          <span className={s.eyebrowNo}>{aiCount} AI</span>
          <span>AI WORKSPACE</span>
        </p>
        <h1 className={l.clearTitle}>
          <SplitText text="その仕事、" />
          <span className={l.clearMute}>
            <SplitText text="AIチームに任せよう。" delay={240} />
          </span>
        </h1>
        <p className={l.lead} data-reveal style={{ '--d': '.35s' } as CSSProperties}>
          {label}。バナー・記事・商談準備・採用まで、やりたいことを書くだけで進みます。
        </p>
        <div data-reveal style={{ '--d': '.5s' } as CSSProperties}>
          <AskDemo />
        </div>
        <div data-reveal style={{ '--d': '.65s' } as CSSProperties}>
          <Ctas />
        </div>
      </div>
      <div className={l.clearShot} data-reveal="img" style={{ '--d': '.3s' } as CSSProperties}>
        <AppMock />
      </div>
    </section>
  )
}

function Marquee() {
  const names = getPublicServices().map((x) => x.name)
  return (
    <div className={l.marquee} aria-hidden="true">
      <div>
        {[...names, ...names].map((n, i) => (
          <span key={i}>
            {n}
            <Sparkles size={14} />
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------- セクション見出し ---------- */
function Head({ no, en, title, mute }: { no: string; en: string; title: string; mute?: string }) {
  return (
    <div className={l.head}>
      <p className={s.eyebrow} data-reveal>
        <span className={s.eyebrowNo}>{no}</span>
        <span>{en}</span>
      </p>
      <h2 className={l.h2} data-reveal style={{ '--d': '.08s' } as CSSProperties}>
        {title}
        {mute && <span className={l.h2Mute}>{mute}</span>}
      </h2>
    </div>
  )
}

function Steps() {
  const steps = [
    { icon: <MessageSquareText size={22} />, t: '頼む', b: 'やりたいことを、ふだんの言葉で書きます。URLを貼るだけでも始められます。' },
    { icon: <Wand2 size={22} />, t: 'AIが進める', b: '合うAIが選ばれ、調べる・考える・作るまでを順に進めます。途中の様子も見えます。' },
    { icon: <Check size={22} />, t: '選んで使う', b: '点数つきの案から選び、そのまま書き出します。気に入らなければ作り直せます。' },
  ]
  return (
    <section className={l.section}>
      <Head no="01" en="HOW IT WORKS" title="3ステップで、仕事が終わる。" mute="プロンプトの知識はいりません。" />
      <ol className={l.steps}>
        {steps.map((st, i) => (
          <li key={st.t} data-reveal data-spot style={{ '--d': `${i * 0.12}s` } as CSSProperties}>
            <span className={l.stepNo}>{String(i + 1).padStart(2, '0')}</span>
            <span className={l.stepIcon}>{st.icon}</span>
            <strong>{st.t}</strong>
            <p>{st.b}</p>
            <span className={l.stepLine} />
          </li>
        ))}
      </ol>
    </section>
  )
}

function MapTeaser({ aiCount }: { aiCount: number }) {
  return (
    <section id="map" className={l.section}>
      <Head no="02" en="WORK MAP" title={`会社の仕事の流れに、${aiCount}のAIを。`} mute="集める・売る・雇う・回す。" />
      <div className={l.map}>
        <div className={l.mapHub} data-reveal="img">
          <img src="/ui-renewal/workmap-hub.webp" alt="4つの仕事を分担するSaaSクマのチーム" loading="lazy" />
        </div>
        <ul className={l.mapList}>
          {STAGES.map((st, i) => (
            <li key={st.id} data-reveal style={{ '--d': `${i * 0.1}s`, '--c': st.color } as CSSProperties}>
              <div className={l.mapStage}>
                <span>{st.no}</span>
                <strong>{st.label}</strong>
                <small>{st.lead}</small>
              </div>
              <div className={l.mapChips}>
                {stageServices(st).map((svc) => (
                  <span key={svc.id} data-cursor={svc.description.slice(0, 18)}>
                    <img src={mascotOf(svc.id)} alt="" loading="lazy" />
                    {svc.name}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Tile({ id, className, children, icon }: { id: string; className?: string; children: ReactNode; icon: ReactNode }) {
  const svc = getServiceById(id)
  return (
    <article className={`${l.tile} ${className ?? ''}`} data-reveal data-spot data-cursor="詳しく">
      <p className={l.tileTag}>
        {icon}
        {svc?.name}
      </p>
      <h3>{svc?.description}</h3>
      <div className={l.tileArt}>{children}</div>
    </article>
  )
}

function Features() {
  return (
    <section id="features" className={l.section}>
      <Head no="03" en="FEATURES" title="使うたびに、画面が先回りする。" mute="主なAIの見本です。" />
      <div className={l.tiles}>
        <Tile id="banner" className={l.tileWide} icon={<ImageIcon size={14} />}>
          <div className={l.collage}>
            {['cat-food', 'cat-beauty', 'purpose-webinar', 'cat-it', 'purpose-campaign', 'cat-realestate'].map((n, i) => (
              <img key={n} src={`/banner-samples/${n}.webp`} alt="" loading="lazy" style={{ '--i': i } as CSSProperties} />
            ))}
          </div>
        </Tile>
        <Tile id="seo" icon={<PenLine size={14} />}>
          <div className={l.doc}>
            <span className={l.docTag}>結論</span>
            <i style={{ width: '92%' }} />
            <i style={{ width: '78%' }} />
            <b />
            <i style={{ width: '85%' }} />
            <i style={{ width: '64%' }} />
            <span className={l.docScore}>86点</span>
          </div>
        </Tile>
        <Tile id="shodan" icon={<Building2 size={14} />}>
          <div className={l.company}>
            <img src="/ui-renewal/mascots/shodan.webp" alt="" loading="lazy" />
            <span>
              <b>会社の概要</b>
              <i />
              <i />
            </span>
            <span>
              <b>課題の仮説</b>
              <i />
              <i />
            </span>
          </div>
        </Tile>
        <Tile id="mensetsu" icon={<UserRoundCheck size={14} />}>
          <div className={l.chat}>
            <p className={l.chatAi}>
              <img src="/ui-renewal/mascots/mensetsu.webp" alt="" loading="lazy" />
              これまでで一番工夫したお仕事を教えてください。
            </p>
            <p className={l.chatMe}>前職で受付の流れを見直しました。</p>
          </div>
        </Tile>
        <Tile id="doyaslide" className={l.tileWide} icon={<Sparkles size={14} />}>
          <div className={l.covers}>
            {['02-pop-sticker', '05-trust-navy', '07-fresh-aqua', '14-data-dashboard'].map((n, i) => (
              <img key={n} src={`/doyaslide/template-covers/${n}.webp`} alt="" loading="lazy" style={{ '--i': i } as CSSProperties} />
            ))}
          </div>
        </Tile>
      </div>
    </section>
  )
}

function Numbers({ aiCount }: { aiCount: number }) {
  const [ref, seen] = useInView<HTMLElement>()
  const items = [
    { v: aiCount, d: 0, unit: 'のAI', note: '1つのアカウントで' },
    { v: 42.5, d: 1, unit: '時間', note: '1か月に任せた時間（見本）' },
    { v: 128, d: 0, unit: '件', note: '1か月の成果物（見本）' },
    { v: 4, d: 0, unit: '段階', note: '集める・売る・雇う・回す' },
  ]
  return (
    <section ref={ref} className={`${l.section} ${l.numbers}`}>
      {items.map((it, i) => (
        <div key={it.note} className={l.num} data-reveal style={{ '--d': `${i * 0.1}s` } as CSSProperties}>
          <b>
            <CountUp value={it.v} decimals={it.d} start={seen} />
            <small>{it.unit}</small>
          </b>
          <span>{it.note}</span>
        </div>
      ))}
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" className={l.section}>
      <Head no="04" en="PRICING" title="料金は、2つだけ。" mute={UNIFIED_PLAN_COPY.proTagline} />
      <div className={l.plans}>
        <div className={l.plan} data-reveal data-spot>
          <p className={l.planName}>{UNIFIED_PLAN_COPY.freeName}</p>
          <p className={l.planPrice}>
            ¥0<small>/月</small>
          </p>
          <p className={l.planNote}>{UNIFIED_PLAN_COPY.freeTagline}</p>
          <ul>
            <li>
              <Check size={15} /> すべてのAIを無料の範囲で試せます
            </li>
            <li>
              <Check size={15} /> アカウントは1つ
            </li>
          </ul>
          <a href={APP_HREF} className={l.ghost} data-cursor="はじめる">
            無料ではじめる
          </a>
        </div>
        <div className={`${l.plan} ${l.planPro}`} data-reveal data-spot style={{ '--d': '.12s' } as CSSProperties}>
          <span className={l.planBadge}>おすすめ</span>
          <p className={l.planName}>{UNIFIED_PLAN_COPY.proName}</p>
          <p className={l.planPrice}>
            {UNIFIED_PRO_PRICE_LABEL}
            <small>/月</small>
          </p>
          <p className={l.planNote}>{UNIFIED_PLAN_COPY.proNote}</p>
          <ul>
            <li>
              <Check size={15} /> 全サービスのプロ機能
            </li>
            <li>
              <Check size={15} /> 上限アップ
            </li>
          </ul>
          <a href={APP_HREF} className={s.btnPrimary} data-magnetic data-cursor="選ぶ">
            <span>プロプランにする</span>
            <span className={s.arw}>
              <ArrowRight size={15} strokeWidth={2} />
            </span>
          </a>
        </div>
      </div>
    </section>
  )
}

function Faq({ aiCount }: { aiCount: number }) {
  const qa = [
    { q: 'どのAIが使えますか。', a: `集客・営業・採用・管理の${aiCount}のAIを、1つのアカウントで使えます。一覧は上の業務マップをご覧ください。` },
    { q: 'プロプランは、サービスごとに契約が必要ですか。', a: UNIFIED_PLAN_COPY.proNote },
    { q: 'AIへの頼み方が分かりません。', a: '「バナーを4案」「商談の準備」など、ふだんの言葉で書けば合うAIへ振り分けます。よく使う頼み方はボタンからも選べます。' },
    { q: 'このページの数値は実績ですか。', a: 'いいえ。このページはデザインの見本で、数値はすべて見本です。' },
  ]
  return (
    <section id="faq" className={l.section}>
      <Head no="05" en="FAQ" title="よくある質問" />
      <div className={l.faq}>
        {qa.map((x, i) => (
          <details key={x.q} data-reveal style={{ '--d': `${i * 0.06}s` } as CSSProperties}>
            <summary data-cursor="開く">
              {x.q}
              <span className={l.plus} aria-hidden="true" />
            </summary>
            <p>{x.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function CtaBand() {
  return (
    <section className={l.cta} data-reveal>
      <span className={l.ctaGlow} aria-hidden="true" />
      <img src="/character/success-256.webp" alt="" className={l.ctaBear} width={120} height={120} />
      <h2>
        今日の仕事を、ひとつ
        <br />
        AIに任せてみませんか。
      </h2>
      <a href={APP_HREF} className={s.btnPrimary} data-magnetic data-cursor="はじめる">
        <span>無料ではじめる</span>
        <span className={s.arw}>
          <ArrowRight size={15} strokeWidth={2} />
        </span>
      </a>
    </section>
  )
}

function Footer() {
  return (
    <footer className={l.footer}>
      <span className={l.brand}>
        <img src="/character/hello-256.webp" alt="" width={24} height={24} />
        ドヤAI
      </span>
      <nav>
        <a href="/terms">利用規約</a>
        <a href="/privacy">プライバシーポリシー</a>
        <a href="/tokushoho">特定商取引法に基づく表記</a>
      </nav>
      <small>このページはデザインの見本です。</small>
    </footer>
  )
}
