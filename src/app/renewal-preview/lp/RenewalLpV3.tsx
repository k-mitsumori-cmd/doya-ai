"use client";

// トップ LP の見本 v3（unslop で「AIっぽさ」を直した版、2026-11-01）。
// 方向: 製品は「書くとドヤバディが進める AI」。性格は「気さく・手早い・少しドヤ顔」。世界は朝の事務所の机。
// 見せ場は、机の前のドヤくんの絵と、書く → 作戦 → 完了と進む操作画面。小さな目印は、完了のしるしのドヤ顔バッジ。
// 面は紙の色、アクセントはブランドの青だけ。グラデーション・光・流れ続ける動きは使わない。絵文字は使わない。

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Briefcase, Calculator, Check, ChevronDown, ListChecks, Layers, Megaphone, Menu, Target, Users, X } from "lucide-react";

/* ---------- 共通のフック ---------- */

export function useReducedMotion() {
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

/** 画面に入ったら一度だけ true。 */
export function useInView<T extends HTMLElement>(threshold = 0.25) {
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
export function useScrollProgress<T extends HTMLElement>() {
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

/** 登場は、短い浮き上がりと薄い色から濃い色への変化だけ（一度きり）。 */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);
  return (
    <div ref={ref} className={`u-reveal ${inView ? "is-in" : ""} ${className}`} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

/* ---------- データ ---------- */

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

type DeptId = "marketing" | "sales" | "hr" | "admin";
type Dept = { id: DeptId; name: string; short: string; lead: string; ask: string; icon: ReactNode; tools: { id: string; name: string; soon?: boolean }[] };

const DEPTS: Dept[] = [
  {
    id: "marketing",
    name: "マーケティング",
    short: "マーケ",
    lead: "記事、バナー、広告画像、AI検索の対策まで。",
    ask: "今月の記事を3本と、告知のバナーを進めたい",
    icon: <Megaphone size={18} strokeWidth={1.5} />,
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
    short: "営業",
    lead: "リスト作りから、商談の準備と見積もりまで。",
    ask: "来週の商談5件の準備をまとめて進めたい",
    icon: <Briefcase size={18} strokeWidth={1.5} />,
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
    icon: <Users size={18} strokeWidth={1.5} />,
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
    icon: <Calculator size={18} strokeWidth={1.5} />,
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

export const MARK = "/renewal-lp/brand/doya-buddy-mark-small.svg";
export const LOGO = "/renewal-lp/brand/doya-buddy-logo-horizontal-light.svg";

/* ---------- ヘッダー ---------- */

function Nav() {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "#depts", label: "できること" },
    { href: "#story", label: "進め方" },
    { href: "#pricing", label: "料金" },
    { href: "#faq", label: "よくある質問" },
  ];
  return (
    <>
      <nav className="u-nav" aria-label="メイン">
        <Link href="/" className="u-logo" aria-label="ドヤバディ（旧ドヤAI）のトップへ">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="ドヤバディ" width={132} height={43} />
          <span className="u-former">旧ドヤAI</span>
        </Link>
        <div className="u-nav-links">
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>
        <div className="u-nav-actions">
          <Link href="/auth/signin" className="u-nav-login">
            ログイン
          </Link>
          <Link href="/auth/signin" className="u-btn u-btn-sm">
            無料で始める
          </Link>
          <button className="u-menu-btn" aria-label={open ? "メニューを閉じる" : "メニューを開く"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
          </button>
        </div>
      </nav>
      <div className={`u-sheet ${open ? "is-open" : ""}`} aria-hidden={!open}>
        {links.map((l) => (
          <a key={l.href} href={l.href} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
            {l.label}
          </a>
        ))}
        <Link href="/auth/signin" className="u-btn" tabIndex={open ? 0 : -1}>
          無料で始める <ArrowRight size={18} strokeWidth={1.5} />
        </Link>
      </div>
    </>
  );
}

/* ---------- ファーストビューの背景動画（2026-11-02 本人の承認、MiniMax H3 の 2K・10秒を軽くしたもの） ----------
   絵と同じ構図を静かに動かす。一度だけ流して、最後の1コマで止める（繰り返しの切れ目を作らない）。
   動きを減らす設定の人には出さず、絵のままにする。 */
function HeroVideo() {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return <video className="u-hero-video" src="/renewal-lp/video/desk-hero.mp4" poster="/renewal-lp/desk-hero.webp" autoPlay muted playsInline preload="auto" aria-hidden="true" tabIndex={-1} />;
}

/* ---------- ファーストビュー（机の前のドヤくんの絵） ---------- */

function Hero({ toolCount, pricing }: { toolCount: number; pricing: Pricing }) {
  return (
    <header className="u-hero">
      <div className="u-hero-bg">
        <Image src="/renewal-lp/desk-hero.webp" alt="朝の事務所で、付箋の貼られたボードの前に立つドヤくん" fill priority sizes="100vw" />
        <HeroVideo />
      </div>
      <div className="u-hero-inner">
        <h1 className="u-hero-title">
          やりたいことを書くと、
          <br />
          ドヤバディが進めます
        </h1>
        <p className="u-hero-sub">マーケティング、営業、人事、売上の管理まで。ドヤバディが必要なツールを選び、順番に動かします。</p>
        <div className="u-hero-cta">
          <Link href="/auth/signin" className="u-btn u-btn-lg">
            無料で始める <ArrowRight size={18} strokeWidth={1.5} />
          </Link>
          <a href="#story" className="u-link">
            進め方を見る
          </a>
        </div>
        <p className="u-hero-facts">
          <span>Google アカウントで登録</span>
          <span>{toolCount}のツールが全部入り</span>
          <span>最初にドヤパワー {pricing.freeStart}</span>
        </p>
      </div>
    </header>
  );
}

/* ---------- 数字（箱に入れず、並べるだけ） ---------- */

function Figures({ toolCount, pricing }: { toolCount: number; pricing: Pricing }) {
  const items = [
    { n: String(toolCount), l: "ツール" },
    { n: String(DEPTS.length), l: "部署の仕事" },
    { n: "¥0", l: "から始められる" },
    { n: String(pricing.freeStart), l: "最初に使えるドヤパワー" },
  ];
  return (
    <div className="u-figures">
      {items.map((it) => (
        <div key={it.l}>
          <b>{it.n}</b>
          <span>{it.l}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- 課題 ---------- */

function Problems() {
  const items = [
    { title: "ツールが多すぎる", desc: "マーケ、営業、売上の管理。仕事ごとに別のツールを契約すると、どれを使うか選ぶだけで時間がかかります。" },
    { title: "頼める人が足りない", desc: "やりたい施策はあるのに、手を動かせる人が足りず、後回しになっています。" },
    { title: "何をどう頼むか分からない", desc: "AIに何を入れればよいか分からず、試しただけで終わってしまいます。" },
  ];
  return (
    <section className="u-section" aria-labelledby="u-problem-h">
      <div className="u-wrap u-split">
        <Reveal>
          <p className="u-kicker">よくある悩み</p>
          <h2 id="u-problem-h" className="u-h2">
            ツールは増えたのに、
            <br />
            仕事は思ったほど減らない
          </h2>
        </Reveal>
        <ul className="u-rows">
          {items.map((it, i) => (
            <li key={it.title}>
              <Reveal delay={i * 60}>
                <h3>{it.title}</h3>
                <p>{it.desc}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- スクロールで進む場面（書く → 作戦 → 完了） ---------- */

function Story() {
  const reduced = useReducedMotion();
  const { ref, p: raw } = useScrollProgress<HTMLElement>();
  const p = reduced ? 1 : raw;
  const typed = Math.round(GOAL.length * Math.min(1, p / 0.28));
  const planShown = p > 0.3;
  const done = Math.max(0, Math.min(4, Math.floor((p - 0.36) / 0.13) + 1));
  const step = p < 0.3 ? 0 : p < 0.82 ? 1 : 2;
  const steps = [
    { icon: <Target size={18} strokeWidth={1.5} />, title: "目的を書く", desc: "やりたいことを1行で書きます。" },
    { icon: <ListChecks size={18} strokeWidth={1.5} />, title: "作戦を確かめる", desc: "ドヤくんが作業を分け、使うツールと順番を出します。" },
    { icon: <Layers size={18} strokeWidth={1.5} />, title: "できた物がそろう", desc: "ツールが順に動きます。出す前に、人が確かめます。" },
  ];
  return (
    <section id="story" ref={ref} className="u-story" aria-labelledby="u-story-h">
      <div className="u-story-sticky">
        <div className="u-wrap u-story-grid">
          <div>
            <p className="u-kicker">進め方</p>
            <h2 id="u-story-h" className="u-h2">
              ツールを選ぶのは、
              <br />
              ドヤくんの仕事です
            </h2>
            <ol className="u-steps">
              {steps.map((s, i) => (
                <li key={s.title} className={i === step ? "is-active" : i < step ? "is-done" : ""}>
                  <span className="u-step-icon">{i < step ? <Check size={16} strokeWidth={2} /> : s.icon}</span>
                  <span>
                    <b>{s.title}</b>
                    <small>{s.desc}</small>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="u-console" aria-label="ドヤくんが目的から作戦を立てて進める様子の例">
            <div className="u-console-head">
              <span>ドヤくんに頼む</span>
              <span className="u-console-state">{done >= 4 ? "完了" : planShown ? "進行中" : "入力中"}</span>
            </div>
            <div className="u-goal">
              <Target size={16} strokeWidth={1.5} />
              <span>
                {GOAL.slice(0, typed)}
                {!planShown && <i className="u-caret" />}
              </span>
            </div>
            <ol className={`u-plan ${planShown ? "is-shown" : ""}`}>
              {PLAN.map((row, i) => {
                const state = i < done ? "is-done" : i === done && planShown ? "is-run" : "";
                return (
                  <li key={row.text} className={`u-plan-row ${state}`}>
                    <span className="u-plan-no">{i < done ? <Check size={14} strokeWidth={2} /> : i + 1}</span>
                    <span className="u-plan-body">
                      <b>{row.text}</b>
                      <small>
                        {deptOf(row.dept).short} / {row.tool}
                      </small>
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="u-plan-stamp" src={MARK} alt="" width={22} height={22} />
                  </li>
                );
              })}
            </ol>
            <div className="u-console-foot">
              <span>
                {done}/{PLAN.length} 件
              </span>
              <span className="u-meter">
                <i style={{ transform: `scaleX(${done / PLAN.length})` }} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- できること（部署ごとの表） ---------- */

function Departments() {
  return (
    <section id="depts" className="u-section u-depts" aria-labelledby="u-depts-h">
      <div className="u-wrap">
        <Reveal>
          <p className="u-kicker">できること</p>
          <h2 id="u-depts-h" className="u-h2">
            どの仕事も、同じ入力欄に書くだけ
          </h2>
          <p className="u-lead">部署やツールを選ぶ必要はありません。次のような頼み方ができます。</p>
        </Reveal>
        <ul className="u-dept-list">
          {DEPTS.map((d) => (
            <li key={d.id}>
              <Reveal className="u-dept">
                <div className="u-dept-main">
                  <span className="u-dept-icon">{d.icon}</span>
                  <div>
                    <h3>{d.name}</h3>
                    <p>{d.lead}</p>
                  </div>
                </div>
                <div className="u-dept-side">
                  <p className="u-ask">
                    <small>頼み方の例</small>「{d.ask}」
                  </p>
                  <ul className="u-tags">
                    {d.tools.map((t) =>
                      t.soon ? (
                        <li key={t.id} className="is-soon">
                          {t.name}（準備中）
                        </li>
                      ) : (
                        <li key={t.id}>
                          <Link href={`/${t.id}`}>{t.name}</Link>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 使い方の例（本人が残すと決めた動き：項目が順に入る） ---------- */

function UseCase({ title, dept, ai, human, index }: { title: string; dept: DeptId; ai: string[]; human: string; index: number }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className={`u-case ${inView ? "is-active" : ""}`} style={{ "--k": index } as CSSProperties}>
      <p className="u-case-dept">{deptOf(dept).name}</p>
      <h3>{title}</h3>
      <p className="u-case-label">ドヤくんがすること</p>
      <ul className="u-case-list is-ai">
        {ai.map((t, j) => (
          <li key={t} style={{ "--j": j } as CSSProperties}>
            <Check size={14} strokeWidth={2} />
            {t}
          </li>
        ))}
      </ul>
      <p className="u-case-label">あなたがすること</p>
      <ul className="u-case-list is-human">
        <li style={{ "--j": ai.length } as CSSProperties}>
          <Users size={14} strokeWidth={1.5} />
          {human}
        </li>
      </ul>
    </div>
  );
}

function UseCases() {
  return (
    <section className="u-section" aria-labelledby="u-case-h">
      <div className="u-wrap">
        <Reveal>
          <p className="u-kicker">使い方の例</p>
          <h2 id="u-case-h" className="u-h2">
            手を動かす作業は、
            <br />
            ドヤくんが引き受けます
          </h2>
          <p className="u-lead">人がするのは、決めることと確かめることです。</p>
        </Reveal>
        <div className="u-cases">
          <UseCase index={0} dept="marketing" title="記事を月に4本出す" ai={["キーワードから構成を作る", "下書きを書く", "見出しの図をバナーで作る"]} human="内容を確かめて公開する" />
          <UseCase index={1} dept="sales" title="来週の商談5件を準備する" ai={["相手の会社を調べる", "提案の資料をスライドで作る", "聞くことの一覧を作る"]} human="資料を直して商談に出る" />
          <UseCase index={2} dept="hr" title="面接の質問と評価表を作る" ai={["求人の内容を読む", "質問を作る", "評価の表を作る"]} human="面接をして評価をつける" />
        </div>
      </div>
    </section>
  );
}

/* ---------- 料金 ---------- */

function PricingSection({ pricing: p, toolCount }: { pricing: Pricing; toolCount: number }) {
  const solo = p.teamBase + p.seat;
  return (
    <section id="pricing" className="u-section u-pricing" aria-labelledby="u-price-h">
      <div className="u-wrap">
        <Reveal>
          <p className="u-kicker">料金</p>
          <h2 id="u-price-h" className="u-h2">
            無料で始めて、
            <br />
            使うぶんだけ広げる
          </h2>
          <p className="u-lead">ツールごとの契約は要りません。ドヤくんが動いた量は「ドヤパワー」で数えます。文章なら少なく、画像や長い作業では多く使います。</p>
        </Reveal>
        <div className="u-prices">
          <Reveal className="u-price">
            <h3>フリー</h3>
            <p className="u-price-num">
              ¥0<small>/月</small>
            </p>
            <p className="u-price-desc">まず試したい方に。登録するだけで、すぐに使えます。</p>
            <ul>
              <li>
                <Check size={16} strokeWidth={2} />
                最初にドヤパワー {p.freeStart}
              </li>
              <li>
                <Check size={16} strokeWidth={2} />
                毎日 {p.freeDaily} ずつ回復（上限 {p.freeStart}）
              </li>
              <li>
                <Check size={16} strokeWidth={2} />
                {toolCount}のツールを {p.freeMembers}人まで
              </li>
            </ul>
            <Link href="/auth/signin" className="u-btn u-btn-ghost">
              無料で始める
            </Link>
          </Reveal>
          <Reveal className="u-price is-team" delay={80}>
            <h3>チーム</h3>
            <p className="u-price-num">
              {yen(p.teamBase)}
              <small>/月 ＋ 1人 {yen(p.seat)}（税抜）</small>
            </p>
            <p className="u-price-desc">
              1人で使うなら月 {yen(solo)}（税抜）。{p.seatFrom}人目からは1人 {yen(p.seatLater)}、{p.enterpriseFrom}人以上はお見積りです。
            </p>
            <ul>
              <li>
                <Check size={16} strokeWidth={2} />
                毎月ドヤパワー {p.pointsBase.toLocaleString("ja-JP")} ＋ 1人 {p.pointsPerSeat}
              </li>
              <li>
                <Check size={16} strokeWidth={2} />
                マーケ・営業・人事・管理の全ツール
              </li>
              <li>
                <Check size={16} strokeWidth={2} />
                年払いなら {p.yearlyFreeMonths}か月分おトク
              </li>
            </ul>
            <Link href="/pricing" className="u-btn">
              料金をくわしく見る <ArrowRight size={18} strokeWidth={1.5} />
            </Link>
          </Reveal>
        </div>
        <p className="u-price-note">
          ドヤパワーが足りないときは、{p.packPoints.toLocaleString("ja-JP")} を {yen(p.packPrice)}（税抜）で追加できます。
        </p>
      </div>
    </section>
  );
}

/* ---------- よくある質問 ---------- */

const FAQ = [
  { q: "ドヤAIとは別のサービスですか", a: "同じサービスです。名前を「ドヤバディ」に変えました。URL とツールの名前は、そのままです。" },
  { q: "仕事やツールごとに、別の契約が要りますか", a: "要りません。契約は1つで、マーケ・営業・人事・管理のツールを全部使えます。" },
  { q: "無料プランでは何ができますか", a: "最初にドヤパワーを100受け取れて、全部のツールを試せます。ドヤパワーは毎日10ずつ回復します（上限100）。Google アカウントで登録でき、そのまま使い始められます。" },
  { q: "ドヤパワーとは何ですか", a: "ドヤくんやツールが動いた量を数えるポイントです。文章を作るときは少し、画像や長い作業では多めに使います。" },
  { q: "ドヤくんは、勝手に外へ送ったり公開したりしますか", a: "しません。メールの送信や公開など外に出る操作は、人が確かめてから進めます。" },
  { q: "AIが作った物は、そのまま使えますか", a: "下書きとして使い、内容は人が確かめてください。画面で直してから使えます。" },
  { q: "社員を招待できますか", a: "できます。会社のアカウントにメンバーを招待して、同じツールを使えます。" },
  { q: "解約はいつでもできますか", a: "できます。解約したあとも、いまの契約の期間が終わるまで使えます。" },
];

function Faq() {
  return (
    <section id="faq" className="u-section" aria-labelledby="u-faq-h">
      <div className="u-wrap u-faq-wrap">
        <Reveal>
          <p className="u-kicker">よくある質問</p>
          <h2 id="u-faq-h" className="u-h2">
            はじめる前に、よく聞かれること
          </h2>
        </Reveal>
        <div className="u-faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <ChevronDown size={18} strokeWidth={1.5} />
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
    <section className="u-final u-wrap" aria-labelledby="u-final-h">
      <div className="u-final-box">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/renewal-lp/brand/doya-buddy-mark.svg" alt="" width={72} height={72} />
        <div>
          <h2 id="u-final-h">
            まずは無料で、
            <br />
            ドヤくんに書いてみてください
          </h2>
          <p>Google アカウントで、すぐに始められます。</p>
        </div>
        <Link href="/auth/signin" className="u-btn u-btn-lg">
          無料で始める <ArrowRight size={18} strokeWidth={1.5} />
        </Link>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="u-footer">
      <div className="u-wrap u-footer-inner">
        <div>
          <Link href="/" className="u-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="ドヤバディ" width={120} height={39} />
            <span className="u-former">旧ドヤAI</span>
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

export function MobileCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const end = document.getElementById("u-hero-end");
        const fin = document.querySelector(".u-final");
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
    <div className={`u-mcta ${show ? "is-shown" : ""}`} aria-hidden={!show}>
      <Link href="/auth/signin" className="u-btn" tabIndex={show ? 0 : -1}>
        無料で始める <ArrowRight size={18} strokeWidth={1.5} />
      </Link>
    </div>
  );
}

export function RenewalLpV3({ toolCount, pricing }: { toolCount: number; pricing: Pricing }) {
  return (
    <div className="u">
      <a href="#u-main" className="u-skip">
        本文へ移動
      </a>
      <Nav />
      <Hero toolCount={toolCount} pricing={pricing} />
      <div id="u-hero-end" aria-hidden="true" />
      <main id="u-main">
        <Figures toolCount={toolCount} pricing={pricing} />
        <Problems />
        <Story />
        <Departments />
        <UseCases />
        <PricingSection pricing={pricing} toolCount={toolCount} />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <MobileCta />
    </div>
  );
}
