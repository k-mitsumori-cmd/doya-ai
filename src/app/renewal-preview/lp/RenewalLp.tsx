"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Layers,
  ListChecks,
  Megaphone,
  Briefcase,
  Users,
  Calculator,
  Target,
  Sparkles,
  Menu,
  X,
} from "lucide-react";

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

/** 画面に入ったら一度だけ true（約30%見えたら）。 */
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

/** 画面にあるあいだだけ true（ループを止めるため）。 */
function useOnScreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, on };
}

function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li" }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  return (
    <Tag ref={ref as never} className={`rlp-reveal ${inView ? "is-in" : ""} ${className}`} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {children}
    </Tag>
  );
}

function CountUp({ to, run, suffix = "" }: { to: number; run: boolean; suffix?: string }) {
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
    const dur = 1100;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, to, reduced]);
  return (
    <span className="rlp-num">
      {n.toLocaleString("ja-JP")}
      {suffix}
    </span>
  );
}

/* ---------- データ ---------- */

type Dept = {
  id: "marketing" | "sales" | "hr" | "admin";
  name: string;
  short: string;
  lead: string;
  ask: string;
  mascot: string;
  icon: ReactNode;
  tools: { id: string; name: string; soon?: boolean }[];
};

const DEPTS: Dept[] = [
  {
    id: "marketing",
    name: "ドヤマーケAI",
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
    name: "ドヤセールスAI",
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
    name: "ドヤ人事AI",
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
    name: "ドヤ管理AI",
    short: "管理",
    lead: "請求と支払い、プロジェクトの進み具合を1か所に。",
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

const GOAL = "来月の展示会で、商談を30件つくりたい";
const PLAN: { dept: Dept["id"]; tool: string; text: string }[] = [
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
    const s = document.getElementById("rlp-top-sentinel");
    if (!s) return;
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting));
    io.observe(s);
    return () => io.disconnect();
  }, []);
  const links = [
    { href: "#depts", label: "4つの入口" },
    { href: "#agent", label: "ドヤくんの進め方" },
    { href: "#pricing", label: "料金" },
    { href: "#faq", label: "よくある質問" },
  ];
  return (
    <>
      <nav className={`rlp-nav ${scrolled ? "is-scrolled" : ""}`} aria-label="メイン">
        <Link href="/" className="rlp-logo" aria-label="ドヤAI トップへ">
          <Image src="/brand/doya-logo-mark-64.webp" alt="" width={32} height={32} />
          <span>ドヤAI</span>
        </Link>
        <div className="rlp-nav-links">
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>
        <div className="rlp-nav-actions">
          <Link href="/auth/signin" className="rlp-nav-login">
            ログイン
          </Link>
          <Link href="/auth/signin" className="rlp-btn rlp-btn-sm">
            無料で始める
          </Link>
          <button className={`rlp-menu-btn ${open ? "is-open" : ""}`} aria-label={open ? "メニューを閉じる" : "メニューを開く"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <Menu size={22} className="rlp-i-open" />
            <X size={22} className="rlp-i-close" />
          </button>
        </div>
      </nav>
      <div className={`rlp-sheet ${open ? "is-open" : ""}`} aria-hidden={!open}>
        {links.map((l, i) => (
          <a key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ "--i": i } as CSSProperties} tabIndex={open ? 0 : -1}>
            {l.label}
          </a>
        ))}
        <Link href="/auth/signin" className="rlp-btn" style={{ "--i": links.length } as CSSProperties} tabIndex={open ? 0 : -1}>
          無料で始める <ArrowRight size={18} />
        </Link>
      </div>
    </>
  );
}

/* ---------- ファーストビュー：エージェントの操作盤（ストーリーが回る） ---------- */

function AgentConsole() {
  const reduced = useReducedMotion();
  const { ref, on } = useOnScreen<HTMLDivElement>();
  // 0..GOAL.length: 入力中 / 以降: 作戦の各行
  const [typed, setTyped] = useState(0);
  const [stage, setStage] = useState(0); // 0=入力 1=作戦表示 2..5=各行の完了 6=完了
  useEffect(() => {
    if (reduced) {
      setTyped(GOAL.length);
      setStage(6);
      return;
    }
    if (!on) return;
    let t: number;
    if (stage === 0) {
      if (typed < GOAL.length) t = window.setTimeout(() => setTyped((n) => n + 1), 70);
      else t = window.setTimeout(() => setStage(1), 650);
    } else if (stage < 6) {
      t = window.setTimeout(() => setStage((s) => s + 1), stage === 1 ? 900 : 1100);
    } else {
      t = window.setTimeout(() => {
        setTyped(0);
        setStage(0);
      }, 3200);
    }
    return () => clearTimeout(t);
  }, [typed, stage, on, reduced]);
  const done = Math.max(0, Math.min(4, stage - 1));
  return (
    <div ref={ref} className="rlp-console" aria-label="ドヤくんが目的から作戦を立てて進める様子の例">
      <div className="rlp-console-head">
        <span className="rlp-dot" />
        ドヤくんに頼む
        <span className="rlp-console-badge">{stage >= 6 ? "完了" : stage >= 1 ? "進めています" : "入力中"}</span>
      </div>
      <div className="rlp-goal">
        <Target size={18} />
        <span>
          {GOAL.slice(0, typed)}
          {stage === 0 && <i className="rlp-caret" />}
        </span>
      </div>
      <ol className={`rlp-plan ${stage >= 1 ? "is-shown" : ""}`}>
        {PLAN.map((p, i) => {
          const state = i < done ? "is-done" : i === done && stage >= 1 && stage < 6 ? "is-run" : "";
          return (
            <li key={p.text} className={`rlp-plan-row ${state}`} style={{ "--i": i } as CSSProperties} data-dept={p.dept}>
              <span className="rlp-plan-check">{i < done ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
              <span className="rlp-plan-body">
                <b>{p.text}</b>
                <small>
                  <em>{DEPTS.find((d) => d.id === p.dept)!.short}</em>
                  {p.tool}
                </small>
              </span>
              <span className="rlp-plan-bar">
                <i />
              </span>
            </li>
          );
        })}
      </ol>
      <div className="rlp-console-foot">
        <span>
          {done}/{PLAN.length} 件
        </span>
        <span className="rlp-meter">
          <i style={{ transform: `scaleX(${done / PLAN.length})` }} />
        </span>
      </div>
    </div>
  );
}

function Hero({ toolCount }: { toolCount: number }) {
  return (
    <header className="rlp-hero">
      <div className="rlp-aurora" aria-hidden="true">
        <i className="a1" />
        <i className="a2" />
        <i className="a3" />
        <i className="a4" />
      </div>
      <div className="rlp-grid-bg" aria-hidden="true" />
      <div className="rlp-hero-inner">
        <div className="rlp-hero-copy">
          <p className="rlp-eyebrow">
            <Sparkles size={16} />
            マーケ・営業・人事・管理の{toolCount}のAIツール
          </p>
          <h1 className="rlp-hero-title">
            <span>目的を書けば、</span>
            <span className="rlp-grad-text">ドヤくんが段取りして</span>
            <span className="rlp-grad-text">進めます。</span>
          </h1>
          <p className="rlp-hero-sub">
            部署ごとのAIツールを、1つの契約で使えます。
            <br className="rlp-br-pc" />
            ドヤくんが作戦を立て、必要なツールを順に動かします。
          </p>
          <div className="rlp-hero-cta">
            <Link href="/auth/signin" className="rlp-btn rlp-btn-lg">
              無料で始める <ArrowRight size={20} />
            </Link>
            <a href="#depts" className="rlp-link">
              4つの入口を見る <ChevronDown size={18} />
            </a>
          </div>
          <ul className="rlp-proof">
            <li>
              <Check size={16} /> 無料プランは Google アカウントで登録
            </li>
            <li>
              <Check size={16} /> 有料は全ツール込みで1つの料金
            </li>
          </ul>
        </div>
        <div className="rlp-hero-visual">
          <div className="rlp-orbit" aria-hidden="true">
            {DEPTS.map((d, i) => (
              <span key={d.id} className="rlp-orbit-chip" data-dept={d.id} style={{ "--i": i } as CSSProperties}>
                {d.icon}
                {d.name}
              </span>
            ))}
          </div>
          <Image className="rlp-hero-bear" src="/renewal-lp/hero.webp" alt="やることの一覧を映したタブレットを持ち、前を指さすドヤくん" width={480} height={480} priority />
          <AgentConsole />
        </div>
      </div>
    </header>
  );
}

/* ---------- 数字の帯 ---------- */

function StatBand({ toolCount, proPrice }: { toolCount: number; proPrice: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.4);
  const price = Number(proPrice.replace(/[^\d]/g, ""));
  return (
    <div ref={ref} className="rlp-stats">
      <div>
        <CountUp to={4} run={inView} />
        <span>部署の入口</span>
      </div>
      <div>
        <CountUp to={toolCount} run={inView} />
        <span>のAIツール</span>
      </div>
      <div>
        <CountUp to={1} run={inView} />
        <span>つの契約</span>
      </div>
      <div>
        <span className="rlp-num">
          ¥<CountUp to={price} run={inView} />
        </span>
        <span>月額で全ツール</span>
      </div>
    </div>
  );
}

/* ---------- 課題 ---------- */

function Problems() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <section className="rlp-section" aria-labelledby="rlp-problem-h">
      <div className="rlp-wrap">
        <Reveal>
          <p className="rlp-kicker">よくある悩み</p>
          <h2 id="rlp-problem-h" className="rlp-h2">
            AIのツールは増えたのに、
            <br />
            仕事はあまり減っていない。
          </h2>
        </Reveal>
        <div ref={ref} className={`rlp-problems ${inView ? "is-in" : ""}`}>
          <div className="rlp-problem">
            <div className="rlp-viz rlp-viz-scatter" aria-hidden="true">
              {["seo", "banner", "sfa", "hr", "quote", "doyaslide"].map((id, i) => (
                <Image key={id} src={`/renewal-lp/tools/${id}.webp`} alt="" width={48} height={48} style={{ "--i": i } as CSSProperties} />
              ))}
            </div>
            <h3>ツールと契約がばらばら</h3>
            <p>部署ごとに別のサービスを契約し、ログインも請求もばらばらになっています。</p>
          </div>
          <div className="rlp-problem">
            <div className="rlp-viz rlp-viz-bars" aria-hidden="true">
              <span>
                <em>やりたい仕事</em>
                <i className="b1" />
              </span>
              <span>
                <em>手の空いた人</em>
                <i className="b2" />
              </span>
            </div>
            <h3>頼める人が足りない</h3>
            <p>やりたい施策はあるのに、手を動かせる人が足りず、後回しになっています。</p>
          </div>
          <div className="rlp-problem">
            <div className="rlp-viz rlp-viz-prompt" aria-hidden="true">
              <span className="rlp-q">何て書けばいい？</span>
              <span className="rlp-prompt-box">
                <i className="rlp-caret" />
              </span>
            </div>
            <h3>何をどう頼むか分からない</h3>
            <p>AIに何を入れればよいか分からず、試しただけで終わってしまいます。</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 4つの入口 ---------- */

function Departments() {
  return (
    <section id="depts" className="rlp-section rlp-depts-sec" aria-labelledby="rlp-depts-h">
      <div className="rlp-wrap">
        <Reveal>
          <p className="rlp-kicker">4つの入口</p>
          <h2 id="rlp-depts-h" className="rlp-h2">
            部署を選ぶと、
            <br />
            その仕事のAIがそろいます。
          </h2>
          <p className="rlp-lead">契約は1つです。ほかの部署のツールも、同じアカウントで使えます。</p>
        </Reveal>
        <div className="rlp-dept-grid">
          {DEPTS.map((d, i) => (
            <Reveal key={d.id} className="rlp-dept" delay={i * 80}>
              <article data-dept={d.id}>
                <div className="rlp-dept-top">
                  <div>
                    <span className="rlp-dept-icon">{d.icon}</span>
                    <h3>{d.name}</h3>
                    <p>{d.lead}</p>
                  </div>
                  <Image src={d.mascot} alt="" width={150} height={150} className="rlp-dept-bear" />
                </div>
                <div className="rlp-ask">
                  <span>頼み方の例</span>「{d.ask}」
                </div>
                <ul className="rlp-chips">
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
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- エージェントの体験 ---------- */

function AgentFlow() {
  const steps = [
    { icon: <Target size={22} />, title: "目的を書く", desc: "「展示会で商談を30件」のように、やりたいことを1行で書きます。", img: "/character/thinking-512.webp" },
    { icon: <ListChecks size={22} />, title: "作戦を確かめる", desc: "ドヤくんが作業を分け、使うツールと順番を出します。直してから進められます。", img: "/character/working-512.webp" },
    { icon: <Layers size={22} />, title: "進み具合を見る", desc: "ツールが順に動き、できた物がそろいます。出す前に、人が確かめます。", img: "/character/jump-512.webp" },
  ];
  const { ref, inView } = useInView<HTMLDivElement>(0.25);
  return (
    <section id="agent" className="rlp-section rlp-dark" aria-labelledby="rlp-agent-h">
      <div className="rlp-dark-glow" aria-hidden="true" />
      <div className="rlp-wrap">
        <Reveal>
          <p className="rlp-kicker">ドヤくんの進め方</p>
          <h2 id="rlp-agent-h" className="rlp-h2">
            ツールを選ぶのは、
            <br />
            ドヤくんの仕事です。
          </h2>
          <p className="rlp-lead">どのツールを、どの順で使うかをドヤくんが考えます。あなたは目的と確認に集中できます。</p>
        </Reveal>
        <div ref={ref} className={`rlp-flow ${inView ? "is-in" : ""}`}>
          <div className="rlp-flow-line" aria-hidden="true">
            <i />
            <b className="p1" />
            <b className="p2" />
          </div>
          {steps.map((s, i) => (
            <div key={s.title} className="rlp-flow-step" style={{ "--i": i } as CSSProperties}>
              <div className="rlp-flow-img">
                <Image src={s.img} alt="" width={180} height={180} />
              </div>
              <span className="rlp-flow-no">
                {s.icon}
                <em>STEP {i + 1}</em>
              </span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
        <GoalTree />
      </div>
    </section>
  );
}

/** 目的 → 部署の目標 → やること の分け方を見せる図。 */
function GoalTree() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const branches = [
    { dept: "marketing" as const, label: "来場者を集める", todos: ["ペルソナを決める", "告知バナーを作る"], pct: 100 },
    { dept: "sales" as const, label: "商談につなげる", todos: ["リストを絞る", "商談の資料をそろえる"], pct: 64 },
    { dept: "admin" as const, label: "費用をまとめる", todos: ["ブースの見積もりを比べる"], pct: 30 },
  ];
  return (
    <div ref={ref} className={`rlp-tree ${inView ? "is-in" : ""}`} aria-label="目的を部署ごとの目標とやることに分けた図の例">
      <div className="rlp-tree-root">
        <Target size={18} />
        {GOAL}
      </div>
      <div className="rlp-tree-branches">
        {branches.map((b, i) => (
          <div key={b.label} className="rlp-tree-branch" data-dept={b.dept} style={{ "--i": i, "--pct": b.pct } as CSSProperties}>
            <div className="rlp-tree-head">
              <span className="rlp-ring" aria-hidden="true">
                <svg viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" pathLength={100} className="bg" />
                  <circle cx="18" cy="18" r="15" pathLength={100} className="fg" />
                </svg>
                <em>{b.pct}%</em>
              </span>
              <b>{b.label}</b>
            </div>
            <ul>
              {b.todos.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- ひとことの見出し（単語ごとに色がつく） ---------- */

function Tagline() {
  const words = ["ツールを", "探す", "時間を、", "仕事を", "進める", "時間に。"];
  const ref = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      setLit(words.length);
      return;
    }
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        // 見出しの上端が画面の80%から35%まで動くあいだに、順に色をつける
        const k = (vh * 0.8 - r.top) / (vh * 0.45);
        setLit(Math.max(0, Math.min(words.length, Math.floor(k * words.length))));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduced, words.length]);
  return (
    <section className="rlp-tagline" aria-label="ドヤAIで変わること">
      <div ref={ref} className="rlp-tagline-text">
        <span className="rlp-tl-line">
          {words.slice(0, 3).map((w, i) => (
            <span key={w} className={i < lit ? "is-lit" : ""}>
              {w}
            </span>
          ))}
        </span>
        <span className="rlp-tl-line">
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

/* ---------- 使い方の例（前と後の時間の比較） ---------- */

function UseCases() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const cases = [
    { dept: "marketing" as const, title: "記事を月に4本出す", ai: ["キーワードから構成を作る", "下書きを書く", "見出しの図をバナーで作る"], human: ["内容を確かめて公開する"] },
    { dept: "sales" as const, title: "来週の商談5件を準備する", ai: ["相手の会社を調べる", "提案の資料をスライドで作る", "聞くことの一覧を作る"], human: ["資料を直して商談に出る"] },
    { dept: "hr" as const, title: "面接の質問と評価表を作る", ai: ["求人の内容を読む", "質問を作る", "評価の表を作る"], human: ["面接をして評価をつける"] },
  ];
  return (
    <section className="rlp-section" aria-labelledby="rlp-case-h">
      <div className="rlp-wrap">
        <Reveal>
          <p className="rlp-kicker">使い方の例</p>
          <h2 id="rlp-case-h" className="rlp-h2">
            手を動かす作業は、
            <br />
            ドヤくんが引き受けます。
          </h2>
          <p className="rlp-lead">人がするのは、決めることと確かめることです。</p>
        </Reveal>
        <div ref={ref} className={`rlp-cases ${inView ? "is-in" : ""}`}>
          {cases.map((c, i) => (
            <div key={c.title} className="rlp-case" data-dept={c.dept} style={{ "--i": i } as CSSProperties}>
              <span className="rlp-case-dept">{DEPTS.find((d) => d.id === c.dept)!.name}</span>
              <h3>{c.title}</h3>
              <p className="rlp-case-label is-ai">ドヤくんがすること</p>
              <ul className="rlp-case-list is-ai">
                {c.ai.map((t, j) => (
                  <li key={t} style={{ "--j": j } as CSSProperties}>
                    <Check size={14} strokeWidth={3} />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="rlp-case-label">あなたがすること</p>
              <ul className="rlp-case-list is-human">
                {c.human.map((t, j) => (
                  <li key={t} style={{ "--j": j + c.ai.length } as CSSProperties}>
                    <Users size={14} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 料金 ---------- */

function Pricing({ proPrice, toolCount }: { proPrice: string; toolCount: number }) {
  return (
    <section id="pricing" className="rlp-section rlp-pricing-sec" aria-labelledby="rlp-price-h">
      <div className="rlp-wrap">
        <Reveal>
          <p className="rlp-kicker">料金</p>
          <h2 id="rlp-price-h" className="rlp-h2">
            全部の部署のツールが、
            <br />
            1つの料金で使えます。
          </h2>
        </Reveal>
        <div className="rlp-prices">
          <Reveal className="rlp-price">
            <h3>無料</h3>
            <p className="rlp-price-num">
              ¥0<small>/月</small>
            </p>
            <p className="rlp-price-desc">まず試したい方に。各ツールを決まった回数まで使えます。</p>
            <ul>
              <li>
                <Check size={16} />
                {toolCount}のツールを試せる
              </li>
              <li>
                <Check size={16} />
                Google アカウントで登録
              </li>
            </ul>
            <Link href="/auth/signin" className="rlp-btn rlp-btn-ghost">
              無料で始める
            </Link>
          </Reveal>
          <Reveal className="rlp-price is-pro" delay={100}>
            <span className="rlp-price-tag">おすすめ</span>
            <h3>プロ</h3>
            <p className="rlp-price-num">
              {proPrice}
              <small>/月（税込）</small>
            </p>
            <p className="rlp-price-desc">仕事で毎日使う方に。全部の部署のツールを、多い回数まで使えます。</p>
            <ul>
              <li>
                <Check size={16} />
                全ツールのプロ版
              </li>
              <li>
                <Check size={16} />
                ドヤくんの作戦づくり
              </li>
              <li>
                <Check size={16} />
                いつでも解約できる
              </li>
            </ul>
            <Link href="/pricing" className="rlp-btn">
              料金をくわしく見る <ArrowRight size={18} />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- よくある質問 ---------- */

const FAQ = [
  { q: "4つの入口は、別々に契約するのですか。", a: "いいえ。ドヤAIの契約は1つです。どの入口から入っても、ほかの部署のツールを同じアカウントで使えます。" },
  { q: "無料プランでは何ができますか。", a: "各ツールを決まった回数まで試せます。Google アカウントで登録でき、そのまま使い始められます。" },
  { q: "ドヤくんは、勝手に外へ送ったり公開したりしますか。", a: "しません。メールの送信や公開など外に出る操作は、人が確かめてから進めます。" },
  { q: "AIが作った物は、そのまま使えますか。", a: "下書きとして使い、内容は人が確かめてください。画面で直してから使えます。" },
  { q: "社員を招待して、部署ごとに分けられますか。", a: "会社のアカウントにメンバーを招待できます。部署ごとに先に出すツールを変える機能は、順に使えるようにしています。" },
  { q: "解約はいつでもできますか。", a: "できます。解約したあとも、いまの契約の期間が終わるまでプロ版を使えます。" },
];

function Faq() {
  return (
    <section id="faq" className="rlp-section" aria-labelledby="rlp-faq-h">
      <div className="rlp-wrap rlp-faq-wrap">
        <Reveal>
          <p className="rlp-kicker">よくある質問</p>
          <h2 id="rlp-faq-h" className="rlp-h2">はじめる前に、よく聞かれること。</h2>
        </Reveal>
        <div className="rlp-faq">
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

/* ---------- 最後の CTA・フッター ---------- */

function FinalCta() {
  return (
    <section className="rlp-final" aria-labelledby="rlp-final-h">
      <div className="rlp-aurora" aria-hidden="true">
        <i className="a1" />
        <i className="a2" />
        <i className="a3" />
      </div>
      <div className="rlp-final-inner">
        <Image src="/renewal-lp/cta.webp" alt="" width={200} height={200} className="rlp-final-bear" />
        <h2 id="rlp-final-h">
          まずは1つ、
          <br />
          目的を書いてみてください。
        </h2>
        <p>無料プランから始められます。</p>
        <Link href="/auth/signin" className="rlp-btn rlp-btn-lg rlp-btn-white">
          無料で始める <ArrowRight size={20} />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="rlp-footer">
      <div className="rlp-wrap rlp-footer-inner">
        <div>
          <Link href="/" className="rlp-logo">
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
    const s = document.getElementById("rlp-hero-end");
    const f = document.querySelector(".rlp-final");
    if (!s) return;
    let pastHero = false;
    let atFinal = false;
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (e.target === s) pastHero = !e.isIntersecting && e.boundingClientRect.top < 0;
        else atFinal = e.isIntersecting;
      }
      setShow(pastHero && !atFinal);
    });
    io.observe(s);
    if (f) io.observe(f);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`rlp-mcta ${show ? "is-shown" : ""}`} aria-hidden={!show}>
      <Link href="/auth/signin" className="rlp-btn" tabIndex={show ? 0 : -1}>
        無料で始める <ArrowRight size={18} />
      </Link>
    </div>
  );
}

export function RenewalLp({ toolCount, proPrice }: { toolCount: number; proPrice: string }) {
  return (
    <div className="rlp">
      <a href="#rlp-main" className="rlp-skip">
        本文へ移動
      </a>
      <div id="rlp-top-sentinel" aria-hidden="true" />
      <Nav />
      <Hero toolCount={toolCount} />
      <div id="rlp-hero-end" aria-hidden="true" />
      <main id="rlp-main">
        <StatBand toolCount={toolCount} proPrice={proPrice} />
        <Problems />
        <Departments />
        <AgentFlow />
        <Tagline />
        <UseCases />
        <Pricing proPrice={proPrice} toolCount={toolCount} />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <MobileCta />
    </div>
  );
}
