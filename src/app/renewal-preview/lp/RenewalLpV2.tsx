"use client";

// トップ LP リニューアルの見本 v2（ド派手版、2026-10-27）。
// 参考: elayadesigns の作品集の動画（画面いっぱいの絵、短い大見出し、下に数字の帯）。
// LP だけの見た目の決まりで作る（アプリの中の「1画面1色」は当てはめない）。絵文字は使わない。

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type MouseEvent } from "react";
import { ArrowRight, Check, ChevronDown, Megaphone, Briefcase, Users, Calculator, Target, Sparkles, Menu, X, Layers, ListChecks } from "lucide-react";

/* ---------- 共通のフック ---------- */

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const u = () => setReduced(m.matches);
    u();
    m.addEventListener("change", u);
    return () => m.removeEventListener("change", u);
  }, []);
  return reduced;
}

function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, threshold]);
  return { ref, inView };
}

/** 要素がスクロールのどこまで進んだか（0〜1）。requestAnimationFrame で間引く。 */
function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const total = r.height - window.innerHeight;
        setP(total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1);
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, []);
  return { ref, p };
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  return (
    <div ref={ref} className={`v-reveal ${inView ? "is-in" : ""} ${className}`} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

function CountUp({ to, run }: { to: number; run: boolean }) {
  const [n, setN] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!run) return;
    if (reduced) {
      setN(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 1400);
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, to, reduced]);
  return <>{n.toLocaleString("ja-JP")}</>;
}

/** 絵の上に重ねる背景の動画。読み込めたら出す。動きを減らす設定では出さない。幅で縦横の動画を選ぶ。 */
function BgVideo({ desktop, mobile, className = "" }: { desktop: string; mobile?: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const narrow = matchMedia("(max-width: 767px)").matches;
    setSrc(narrow && mobile ? mobile : desktop);
  }, [desktop, mobile]);
  if (!src) return null;
  return <video className={`v-bgvideo ${ready ? "is-ready" : ""} ${className}`} src={src} autoPlay muted loop playsInline preload="auto" aria-hidden="true" onCanPlay={() => setReady(true)} />;
}

export type Pricing = {
  freeMembers: number;
  freeStart: number;
  freeDaily: number;
  teamBase: number;
  seat: number;
  seatFrom: number;
  seatLater: number;
  enterpriseFrom: number;
  yearlyFreeMonths: number;
  pointsBase: number;
  pointsPerSeat: number;
  packPoints: number;
  packPrice: number;
};
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

/* ---------- データ ---------- */

type DeptId = "marketing" | "sales" | "hr" | "admin";
type Dept = { id: DeptId; name: string; short: string; lead: string; ask: string; mascot: string; icon: ReactNode; tools: { id: string; name: string; soon?: boolean }[] };

const DEPTS: Dept[] = [
  {
    id: "marketing",
    name: "マーケティング",
    short: "マーケ",
    lead: "記事・バナー・広告画像から、AI検索の対策まで。",
    ask: "今月の記事を3本と、告知のバナーを進めたい",
    mascot: "/renewal-lp/dept-marketing.webp",
    icon: <Megaphone size={20} />,
    tools: [
      { id: "seo", name: "記事作成" },
      { id: "banner", name: "バナー" },
      { id: "adimage", name: "広告画像" },
      { id: "aio", name: "AIO" },
      { id: "persona", name: "ペルソナ" },
      { id: "interview", name: "インタビュー" },
      { id: "asklink", name: "AI質問リンク" },
      { id: "popup", name: "ポップアップ" },
      { id: "tenjikai", name: "展示会", soon: true },
    ],
  },
  {
    id: "sales",
    name: "営業",
    short: "セールス",
    lead: "リスト作りから商談の準備、見積もりまで。",
    ask: "来週の商談5件の準備をまとめて進めたい",
    mascot: "/renewal-lp/dept-sales.webp",
    icon: <Briefcase size={20} />,
    tools: [
      { id: "sfa", name: "営業管理" },
      { id: "shodan", name: "商談準備" },
      { id: "aishodan", name: "AI商談" },
      { id: "doyalist", name: "リスト" },
      { id: "doyaslide", name: "スライド" },
      { id: "quote", name: "見積もり" },
    ],
  },
  {
    id: "hr",
    name: "人事・採用",
    short: "人事",
    lead: "採用の面接から、社内の声と勤怠まで。",
    ask: "今月の面接の質問と評価の表をそろえたい",
    mascot: "/renewal-lp/dept-hr.webp",
    icon: <Users size={20} />,
    tools: [
      { id: "hr", name: "採用・人事" },
      { id: "mensetsu", name: "面接官" },
      { id: "kintai", name: "勤怠" },
      { id: "shanai", name: "社内インタビュー", soon: true },
    ],
  },
  {
    id: "admin",
    name: "売上・経理の管理",
    short: "管理",
    lead: "売上と請求、支払い、プロジェクトの進み具合まで。",
    ask: "今月の請求書をまとめて出したい",
    mascot: "/renewal-lp/dept-admin.webp",
    icon: <Calculator size={20} />,
    tools: [
      { id: "income", name: "収入管理", soon: true },
      { id: "expense", name: "支出管理", soon: true },
      { id: "promane", name: "プロマネ" },
    ],
  },
];

const deptOf = (id: DeptId) => DEPTS.find((d) => d.id === id)!;

const GOAL = "来月の展示会で、商談を30件つくりたい";
const PLAN: { dept: DeptId; tool: string; text: string }[] = [
  { dept: "marketing", tool: "ペルソナ", text: "来場しそうな人の像を決める" },
  { dept: "marketing", tool: "展示会", text: "ブースの案とチラシを作る" },
  { dept: "sales", tool: "リスト", text: "声をかける会社を120社に絞る" },
  { dept: "sales", tool: "商談準備", text: "商談の資料と質問をそろえる" },
];

/* ---------- ヘッダー ---------- */

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const s = document.getElementById("v-top-sentinel");
    if (!s) return;
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting));
    io.observe(s);
    return () => io.disconnect();
  }, []);
  const links = [
    { href: "#story", label: "ドヤくんの進め方" },
    { href: "#depts", label: "できること" },
    { href: "#pricing", label: "料金" },
    { href: "#faq", label: "よくある質問" },
  ];
  return (
    <>
      <nav className={`v-nav ${scrolled ? "is-scrolled" : ""}`} aria-label="メイン">
        <Link href="/" className="v-logo" aria-label="ドヤAI トップへ">
          <Image src="/brand/doya-logo-mark-64.webp" alt="" width={32} height={32} />
          <span>ドヤAI</span>
        </Link>
        <div className="v-nav-links">
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>
        <div className="v-nav-actions">
          <Link href="/auth/signin" className="v-nav-login">
            ログイン
          </Link>
          <Link href="/auth/signin" className="v-btn v-btn-sm">
            無料で始める
          </Link>
          <button className={`v-menu-btn ${open ? "is-open" : ""}`} aria-label={open ? "メニューを閉じる" : "メニューを開く"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <Menu size={22} className="v-i-open" />
            <X size={22} className="v-i-close" />
          </button>
        </div>
      </nav>
      <div className={`v-sheet ${open ? "is-open" : ""}`} aria-hidden={!open}>
        {links.map((l, i) => (
          <a key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ "--i": i } as CSSProperties} tabIndex={open ? 0 : -1}>
            {l.label}
          </a>
        ))}
        <Link href="/auth/signin" className="v-btn" style={{ "--i": links.length } as CSSProperties} tabIndex={open ? 0 : -1}>
          無料で始める <ArrowRight size={18} />
        </Link>
      </div>
    </>
  );
}

/* ---------- ファーストビュー（画面いっぱいの絵） ---------- */

function Hero({ toolCount, pricing }: { toolCount: number; pricing: Pricing }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.1);
  return (
    <header className="v-hero">
      <div className="v-hero-bg" aria-hidden="true">
        <Image className="v-hero-img-d" src="/renewal-lp/sys-hero.webp" alt="" fill priority sizes="100vw" />
        <Image className="v-hero-img-m" src="/renewal-lp/sys-hero-portrait.webp" alt="" fill priority sizes="100vw" />
        <BgVideo desktop="/renewal-lp/video/lp-sys-hero-desktop.mp4" mobile="/renewal-lp/video/lp-sys-hero-mobile.mp4" />
      </div>
      <div className="v-hero-shade" aria-hidden="true" />
      <div className="v-hero-inner">
        <p className="v-eyebrow">
          <Sparkles size={16} />
          マーケも営業も売上の管理も。{toolCount}のAIツールが全部入り
        </p>
        <h1 className="v-hero-title">
          <span>ドヤくんに書くだけ。</span>
          <span className="v-grad">経営の仕事が、</span>
          <span className="v-grad">ぜんぶ動きだす。</span>
        </h1>
        <p className="v-hero-sub">ツールを選ぶ必要はありません。やりたいことを書けば、ドヤくんがマーケ・営業・売上の管理まで、必要なツールを順に動かします。無料で始められます。</p>
        <div className="v-hero-cta">
          <Link href="/auth/signin" className="v-btn v-btn-lg v-btn-glow">
            無料で始める <ArrowRight size={20} />
          </Link>
          <a href="#story" className="v-link">
            進め方を見る <ChevronDown size={18} />
          </a>
        </div>
      </div>
      <div ref={ref} className="v-hero-stats">
        <div>
          <b>
            <CountUp to={1} run={inView} />
          </b>
          <span>つの入力欄で全部</span>
        </div>
        <div>
          <b>
            <CountUp to={toolCount} run={inView} />
          </b>
          <span>のAIツール</span>
        </div>
        <div>
          <b>
            ¥<CountUp to={0} run={inView} />
          </b>
          <span>で始められる</span>
        </div>
        <div>
          <b>
            <CountUp to={pricing.freeStart} run={inView} />
          </b>
          <span>最初にもらえるドヤパワー</span>
        </div>
      </div>
    </header>
  );
}

/* ---------- ツールの帯（流れ続ける） ---------- */

function Marquee() {
  const all = DEPTS.flatMap((d) => d.tools.map((t) => ({ ...t, dept: d.id })));
  const rowA = all.slice(0, 11);
  const rowB = all.slice(11).concat(all.slice(0, 4));
  const Row = ({ items, reverse }: { items: typeof all; reverse?: boolean }) => (
    <div className={`v-marquee-row ${reverse ? "is-reverse" : ""}`}>
      <div className="v-marquee-track">
        {[...items, ...items].map((t, i) => (
          <span key={`${t.id}-${i}`} className="v-mchip" data-dept={t.dept}>
            <i />
            {t.name}
          </span>
        ))}
      </div>
    </div>
  );
  return (
    <div className="v-marquee" aria-hidden="true">
      <Row items={rowA} />
      <Row items={rowB} reverse />
    </div>
  );
}

/* ---------- 課題 ---------- */

function Problems() {
  const items = [
    { no: "01", title: "ツールが多すぎる", desc: "マーケ、営業、売上の管理。仕事ごとに別のツールを契約し、どれを使うか選ぶだけで疲れてしまいます。" },
    { no: "02", title: "頼める人が足りない", desc: "やりたい施策はあるのに、手を動かせる人が足りず、後回しになっています。" },
    { no: "03", title: "何をどう頼むか分からない", desc: "AIに何を入れればよいか分からず、試しただけで終わってしまいます。" },
  ];
  return (
    <section className="v-section" aria-labelledby="v-problem-h">
      <div className="v-wrap">
        <Reveal>
          <p className="v-kicker">よくある悩み</p>
          <h2 id="v-problem-h" className="v-h2">
            AIのツールは増えたのに、
            <br />
            仕事はあまり減っていない。
          </h2>
        </Reveal>
        <div className="v-problems">
          {items.map((it, i) => (
            <Reveal key={it.no} className="v-problem" delay={i * 100}>
              <span className="v-problem-no">{it.no}</span>
              <h3>{it.title}</h3>
              <p>{it.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- スクロールで進む場面（目的 → 作戦 → 完了） ---------- */

function Story() {
  const reduced = useReducedMotion();
  const { ref, p: raw } = useScrollProgress<HTMLElement>();
  const p = reduced ? 1 : raw;
  const typed = Math.round(GOAL.length * Math.min(1, p / 0.28));
  const planShown = p > 0.3;
  const done = Math.max(0, Math.min(4, Math.floor((p - 0.36) / 0.13) + 1));
  const step = p < 0.3 ? 0 : p < 0.82 ? 1 : 2;
  const steps = [
    { icon: <Target size={20} />, title: "目的を書く", desc: "やりたいことを1行で書きます。" },
    { icon: <ListChecks size={20} />, title: "作戦を確かめる", desc: "ドヤくんが作業を分け、使うツールと順番を出します。" },
    { icon: <Layers size={20} />, title: "できた物がそろう", desc: "ツールが順に動きます。出す前に、人が確かめます。" },
  ];
  return (
    <section id="story" ref={ref} className="v-story" style={{ "--p": p } as CSSProperties} aria-labelledby="v-story-h">
      <div className="v-story-sticky">
        <div className="v-story-glow" aria-hidden="true" />
        <div className="v-wrap v-story-grid">
          <div className="v-story-copy">
            <p className="v-kicker">ドヤくんの進め方</p>
            <h2 id="v-story-h" className="v-h2">
              ツールを選ぶのは、
              <br />
              ドヤくんの仕事です。
            </h2>
            <ol className="v-steps">
              {steps.map((s, i) => (
                <li key={s.title} className={i === step ? "is-active" : i < step ? "is-done" : ""}>
                  <span className="v-step-icon">{i < step ? <Check size={18} strokeWidth={3} /> : s.icon}</span>
                  <span>
                    <b>{s.title}</b>
                    <small>{s.desc}</small>
                  </span>
                </li>
              ))}
            </ol>
            <div className="v-story-bar" aria-hidden="true">
              <i />
            </div>
          </div>
          <div className="v-console" aria-label="ドヤくんが目的から作戦を立てて進める様子の例">
            <div className="v-console-head">
              <span className="v-dot" />
              ドヤくんに頼む
              <span className="v-console-badge">{done >= 4 ? "完了" : planShown ? "進めています" : "入力中"}</span>
            </div>
            <div className="v-goal">
              <Target size={18} />
              <span>
                {GOAL.slice(0, typed)}
                {!planShown && <i className="v-caret" />}
              </span>
            </div>
            <ol className={`v-plan ${planShown ? "is-shown" : ""}`}>
              {PLAN.map((row, i) => {
                const state = i < done ? "is-done" : i === done && planShown ? "is-run" : "";
                return (
                  <li key={row.text} className={`v-plan-row ${state}`} data-dept={row.dept} style={{ "--i": i } as CSSProperties}>
                    <span className="v-plan-check">{i < done ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                    <span className="v-plan-body">
                      <b>{row.text}</b>
                      <small>
                        <em>{deptOf(row.dept).short}</em>
                        {row.tool}
                      </small>
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="v-console-foot">
              <span>
                {done}/{PLAN.length} 件
              </span>
              <span className="v-meter">
                <i style={{ transform: `scaleX(${done / PLAN.length})` }} />
              </span>
            </div>
            <Image className="v-console-bear" src="/renewal-lp/hero.webp" alt="" width={180} height={180} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 4つの入口 ---------- */

function DeptCard({ d, i, onActive }: { d: Dept; i: number; onActive: (id: DeptId) => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && onActive(d.id), { rootMargin: "-45% 0px -45% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [d.id, onActive]);
  const move = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  return (
    <Reveal className="v-dept" delay={(i % 2) * 120}>
      <article ref={ref} data-dept={d.id} onMouseMove={move}>
        <div className="v-dept-top">
          <div>
            <span className="v-dept-icon">{d.icon}</span>
            <h3>{d.name}</h3>
            <p>{d.lead}</p>
          </div>
          <Image src={d.mascot} alt="" width={180} height={180} className="v-dept-bear" />
        </div>
        <div className="v-ask">
          <span>頼み方の例</span>「{d.ask}」
        </div>
        <ul className="v-chips">
          {d.tools.map((t) =>
            t.soon ? (
              <li key={t.id} className="is-soon">
                {t.name}
                <small>準備中</small>
              </li>
            ) : (
              <li key={t.id}>
                <Link href={`/${t.id}`}>{t.name}</Link>
              </li>
            ),
          )}
        </ul>
      </article>
    </Reveal>
  );
}

function Departments() {
  const [active, setActive] = useState<DeptId>("marketing");
  return (
    <section id="depts" className="v-section v-depts" data-dept={active} aria-labelledby="v-depts-h">
      <div className="v-depts-glow" aria-hidden="true" />
      <div className="v-wrap">
        <Reveal>
          <p className="v-kicker">できること</p>
          <h2 id="v-depts-h" className="v-h2">
            マーケも営業も管理も、
            <br />
            ぜんぶドヤくんに。
          </h2>
          <p className="v-lead">部署やツールを選ぶ必要はありません。どの仕事も、同じ入力欄に書くだけで進みます。</p>
        </Reveal>
        <div className="v-dept-grid">
          {DEPTS.map((d, i) => (
            <DeptCard key={d.id} d={d} i={i} onActive={setActive} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- ひとことの見出し ---------- */

function Tagline() {
  const words = ["ドヤくんに", "書く", "だけで、", "仕事が", "ぜんぶ", "動きだす。"];
  const ref = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      setLit(words.length);
      return;
    }
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const k = (vh * 0.85 - r.top) / (vh * 0.5);
        setLit(Math.max(0, Math.min(words.length, Math.floor(k * words.length))));
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      window.removeEventListener("scroll", on);
      cancelAnimationFrame(raf);
    };
  }, [reduced, words.length]);
  return (
    <section className="v-tagline" aria-label="ドヤAIで変わること">
      <div ref={ref} className="v-tagline-text">
        <span className="v-tl-line">
          {words.slice(0, 3).map((w, i) => (
            <span key={w} className={i < lit ? "is-lit" : ""}>
              {w}
            </span>
          ))}
        </span>
        <span className="v-tl-line">
          {words.slice(3).map((w, i) => (
            <span key={w} className={i + 3 < lit ? "is-lit" : ""}>
              {w}
            </span>
          ))}
        </span>
      </div>
    </section>
  );
}

/* ---------- 使い方の例 ---------- */

/** Keep the added motion scoped to the use-case section. */
function useCaseMotion() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>(".v-case"));
    let frame = 0;
    const update = () => {
      frame = 0;
      for (const el of targets) {
        const r = el.getBoundingClientRect();
        el.classList.toggle("is-active-motion", r.top < innerHeight * .85 && r.bottom > 0);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); removeEventListener("scroll", schedule); removeEventListener("resize", schedule); };
  }, []);
  return ref;
}

function UseCases() {
  const motionRef = useCaseMotion();
  const cases = [
    { dept: "marketing" as const, title: "記事を月に4本出す", ai: ["キーワードから構成を作る", "下書きを書く", "見出しの図をバナーで作る"], human: "内容を確かめて公開する" },
    { dept: "sales" as const, title: "来週の商談5件を準備する", ai: ["相手の会社を調べる", "提案の資料をスライドで作る", "聞くことの一覧を作る"], human: "資料を直して商談に出る" },
    { dept: "hr" as const, title: "面接の質問と評価表を作る", ai: ["求人の内容を読む", "質問を作る", "評価の表を作る"], human: "面接をして評価をつける" },
  ];
  return (
    <section className="v-section" aria-labelledby="v-case-h">
      <div className="v-wrap">
        <Reveal>
          <p className="v-kicker">使い方の例</p>
          <h2 id="v-case-h" className="v-h2">
            手を動かす作業は、
            <br />
            ドヤくんが引き受けます。
          </h2>
          <p className="v-lead">人がするのは、決めることと確かめることです。</p>
        </Reveal>
        <div className="v-cases" ref={motionRef}>
          {cases.map((c, i) => (
            <Reveal key={c.title} className="v-case" delay={i * 100}>
              <div data-dept={c.dept} className="v-case-in">
                <span className="v-case-dept">{deptOf(c.dept).name}</span>
                <h3>{c.title}</h3>
                <p className="v-case-label is-ai">ドヤくんがすること</p>
                <ul className="v-case-list is-ai">
                  {c.ai.map((t) => (
                    <li key={t}>
                      <Check size={14} strokeWidth={3} />
                      {t}
                    </li>
                  ))}
                </ul>
                <p className="v-case-label">あなたがすること</p>
                <ul className="v-case-list is-human">
                  <li>
                    <Users size={14} />
                    {c.human}
                  </li>
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 料金 ---------- */

function Pricing({ pricing: p, toolCount }: { pricing: Pricing; toolCount: number }) {
  const solo = p.teamBase + p.seat;
  return (
    <section id="pricing" className="v-section" aria-labelledby="v-price-h">
      <div className="v-wrap">
        <Reveal>
          <p className="v-kicker">料金</p>
          <h2 id="v-price-h" className="v-h2">
            無料で始めて、
            <br />
            使うぶんだけ広げる。
          </h2>
          <p className="v-lead">ツールごとの契約はいりません。ドヤくんが動いた量は「ドヤパワー」で数えます。文章なら少し、画像や長い作業なら多めに使います。</p>
        </Reveal>
        <div className="v-prices">
          <Reveal className="v-price">
            <h3>フリー</h3>
            <p className="v-price-num">
              ¥0<small>/月</small>
            </p>
            <p className="v-price-desc">まず試したい方に。登録するだけで、すぐに使えます。</p>
            <ul>
              <li>
                <Check size={16} />
                最初にドヤパワー {p.freeStart}
              </li>
              <li>
                <Check size={16} />
                毎日 {p.freeDaily} ずつ回復（上限 {p.freeStart}）
              </li>
              <li>
                <Check size={16} />
                {toolCount}のツールを {p.freeMembers}人まで
              </li>
            </ul>
            <Link href="/auth/signin" className="v-btn v-btn-ghost">
              無料で始める
            </Link>
          </Reveal>
          <Reveal className="v-price is-pro" delay={120}>
            <span className="v-price-tag">おすすめ</span>
            <h3>チーム</h3>
            <p className="v-price-num">
              {yen(p.teamBase)}
              <small>/月 ＋ 1人 {yen(p.seat)}（税抜）</small>
            </p>
            <p className="v-price-desc">
              1人で使うなら月 {yen(solo)}（税抜）。{p.seatFrom}人目からは1人 {yen(p.seatLater)}、{p.enterpriseFrom}人以上はお見積りです。
            </p>
            <ul>
              <li>
                <Check size={16} />
                毎月ドヤパワー {p.pointsBase.toLocaleString("ja-JP")} ＋ 1人 {p.pointsPerSeat}
              </li>
              <li>
                <Check size={16} />
                マーケ・営業・人事・管理の全ツール
              </li>
              <li>
                <Check size={16} />
                年払いなら {p.yearlyFreeMonths}か月分おトク
              </li>
            </ul>
            <Link href="/pricing" className="v-btn v-btn-white">
              料金をくわしく見る <ArrowRight size={18} />
            </Link>
          </Reveal>
        </div>
        <Reveal>
          <p className="v-price-note">
            ドヤパワーが足りないときは、{p.packPoints.toLocaleString("ja-JP")} を {yen(p.packPrice)}（税抜）で追加できます。
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- よくある質問 ---------- */

const FAQ = [
  { q: "仕事やツールごとに、別の契約が要りますか。", a: "要りません。ドヤAIの契約は1つで、マーケ・営業・人事・管理のツールを全部使えます。" },
  { q: "無料プランでは何ができますか。", a: "最初にドヤパワーを100受け取れて、全部のツールを試せます。ドヤパワーは毎日10ずつ回復します（上限100）。Google アカウントで登録でき、そのまま使い始められます。" },
  { q: "ドヤくんは、勝手に外へ送ったり公開したりしますか。", a: "しません。メールの送信や公開など外に出る操作は、人が確かめてから進めます。" },
  { q: "AIが作った物は、そのまま使えますか。", a: "下書きとして使い、内容は人が確かめてください。画面で直してから使えます。" },
  { q: "社員を招待できますか。", a: "できます。会社のアカウントにメンバーを招待して、同じツールを使えます。" },
  { q: "ドヤパワーとは何ですか。", a: "ドヤくんやツールが動いた量を数えるポイントです。文章を作るときは少し、画像や長い作業では多めに使います。" },
  { q: "解約はいつでもできますか。", a: "できます。解約したあとも、いまの契約の期間が終わるまで使えます。" },
];

function Faq() {
  return (
    <section id="faq" className="v-section" aria-labelledby="v-faq-h">
      <div className="v-wrap v-faq-wrap">
        <Reveal>
          <p className="v-kicker">よくある質問</p>
          <h2 id="v-faq-h" className="v-h2">はじめる前に、よく聞かれること。</h2>
        </Reveal>
        <div className="v-faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <ChevronDown size={20} />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 最後の CTA（画面いっぱいの絵）・フッター ---------- */

function FinalCta() {
  return (
    <section className="v-final" aria-labelledby="v-final-h">
      <div className="v-final-bg" aria-hidden="true">
        <Image src="/renewal-lp/sys-finale.webp" alt="" fill sizes="100vw" />
      </div>
      <div className="v-final-shade" aria-hidden="true" />
      <div className="v-final-inner">
        <h2 id="v-final-h">
          まずは無料で、
          <br />
          ドヤくんに書いてみてください。
        </h2>
        <p>Google アカウントで、すぐに始められます。</p>
        <Link href="/auth/signin" className="v-btn v-btn-lg v-btn-glow">
          無料で始める <ArrowRight size={20} />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="v-footer">
      <div className="v-wrap v-footer-inner">
        <div>
          <Link href="/" className="v-logo">
            <Image src="/brand/doya-logo-mark-64.webp" alt="" width={28} height={28} />
            <span>ドヤAI</span>
          </Link>
          <p>運営: 株式会社スリスタ</p>
        </div>
        <nav aria-label="フッター">
          <Link href="/pricing">料金</Link>
          <Link href="/terms">利用規約</Link>
          <Link href="/privacy">プライバシーポリシー</Link>
          <Link href="/tokushoho">特定商取引法に基づく表記</Link>
        </nav>
      </div>
    </footer>
  );
}

function MobileCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // 位置はスクロールのたびに測る（交差の通知だけだと、上に戻ったときに古い値が残るため）
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const end = document.getElementById("v-hero-end");
        const fin = document.querySelector(".v-final");
        if (!end) return;
        const pastHero = end.getBoundingClientRect().top < 0;
        const atFinal = fin ? fin.getBoundingClientRect().top < window.innerHeight : false;
        setShow(pastHero && !atFinal);
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div className={`v-mcta ${show ? "is-shown" : ""}`} aria-hidden={!show}>
      <Link href="/auth/signin" className="v-btn v-btn-glow" tabIndex={show ? 0 : -1}>
        無料で始める <ArrowRight size={18} />
      </Link>
    </div>
  );
}

export function RenewalLpV2({ toolCount, pricing }: { toolCount: number; pricing: Pricing }) {
  return (
    <div className="v">
      <a href="#v-main" className="v-skip">
        本文へ移動
      </a>
      <div id="v-top-sentinel" aria-hidden="true" />
      <Nav />
      <Hero toolCount={toolCount} pricing={pricing} />
      <div id="v-hero-end" aria-hidden="true" />
      <main id="v-main">
        <Marquee />
        <Problems />
        <Story />
        <Departments />
        <Tagline />
        <UseCases />
        <Pricing pricing={pricing} toolCount={toolCount} />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <MobileCta />
    </div>
  );
}
