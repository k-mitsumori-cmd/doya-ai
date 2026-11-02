"use client";

// 5製品の LP の見本（2026-11-02）。トップ LP の v3（RenewalLpV3.tsx）の部品と CSS を土台にして、見た目をそろえた。
// 製品ごとに変わるのは products.ts の中身（見出し・困りごと・ツール・絵）だけ。色は theme（light / dark）で差し替える。
// 世界は v3 と同じ朝の事務所。グラデーション・光・流れ続ける動きは使わない。絵文字は使わない。

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, ChevronDown, ListChecks, Layers, Menu, Target, X } from "lucide-react";
import { Footer, LOGO, MARK, MobileCta, Reveal, useReducedMotion, useScrollProgress } from "./RenewalLpV3";
import { PRODUCTS, PRODUCT_ORDER, type Product } from "./products";

export type Theme = "light" | "dark";

type Plan = { proPrice: string; proPriceJa: string; freeStart: number; freeDaily: number };

const base = "/renewal-preview/lp";

/* ---------- ヘッダー ---------- */

function Nav({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "#tools", label: "使えるツール" },
    { href: "#story", label: "進め方" },
    { href: "#products", label: "5つの製品" },
    { href: "#pricing", label: "料金" },
    { href: "#faq", label: "よくある質問" },
  ];
  return (
    <>
      <nav className="u-nav" aria-label="メイン">
        <Link href="/" className="u-logo" aria-label="ドヤバディ（旧ドヤAI）のトップへ">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="ドヤバディ" width={132} height={43} />
          <span className="u-former">{product.name}</span>
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

/* ---------- ファーストビュー ---------- */

function Hero({ product, plan }: { product: Product; plan: Plan }) {
  const lines = product.title.split("\n");
  return (
    <header className="u-hero">
      <div className="u-hero-bg">
        <Image src={product.image} alt={product.imageAlt} fill priority sizes="100vw" />
      </div>
      <div className="u-hero-inner">
        <p className="u-prod-kicker">ドヤバディ {product.name}</p>
        <h1 className="u-hero-title">
          {lines.map((l, i) => (
            <span key={l}>
              {l}
              {i < lines.length - 1 && <br />}
            </span>
          ))}
        </h1>
        <p className="u-hero-sub">{product.sub}</p>
        <div className="u-hero-cta">
          <Link href="/auth/signin" className="u-btn u-btn-lg">
            無料で始める <ArrowRight size={18} strokeWidth={1.5} />
          </Link>
          <a href="#story" className="u-link">
            進め方を見る
          </a>
        </div>
        <p className="u-hero-facts">
          <span>無料で始められます</span>
          <span>プロ1つ（月{plan.proPriceJa}）で5つの製品が全部使えます</span>
        </p>
      </div>
    </header>
  );
}

/* ---------- 困りごと ---------- */

function Pains({ product }: { product: Product }) {
  return (
    <section className="u-section" aria-labelledby="u-pain-h">
      <div className="u-wrap u-split">
        <Reveal>
          <p className="u-kicker">{product.who}の困りごと</p>
          <h2 id="u-pain-h" className="u-h2">
            仕事の中で、
            <br />
            こんなことはありませんか
          </h2>
        </Reveal>
        <ul className="u-rows">
          {product.pains.map((it, i) => (
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

/* ---------- 使えるツール（罫線の表） ---------- */

function Tools({ product }: { product: Product }) {
  return (
    <section id="tools" className="u-section u-depts" aria-labelledby="u-tools-h">
      <div className="u-wrap">
        <Reveal>
          <p className="u-kicker">使えるツール</p>
          <h2 id="u-tools-h" className="u-h2">
            {product.toolsHead}
          </h2>
          <p className="u-lead">{product.toolsLead}</p>
        </Reveal>
        <ul className="u-tool-list">
          {product.tools.map((t) => (
            <li key={t.id}>
              <Reveal className="u-tool">
                <div className="u-tool-name">
                  <h3>{t.name}</h3>
                  {t.soon && <span className="u-soon">準備中</span>}
                </div>
                <div className="u-tool-body">
                  <p>{t.desc}</p>
                  {t.shared && <small>{t.shared}</small>}
                </div>
                <div className="u-tool-go">
                  {t.soon ? null : (
                    <Link href={t.href ?? `/${t.id}`} aria-label={`${t.name}を開く`}>
                      開く <ArrowRight size={16} strokeWidth={1.5} />
                    </Link>
                  )}
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- スクロールで進む場面（書く → 作戦 → 完了） ---------- */

function Story({ product }: { product: Product }) {
  const reduced = useReducedMotion();
  const { ref, p: raw } = useScrollProgress<HTMLElement>();
  const p = reduced ? 1 : raw;
  const { goal, plan } = product.story;
  const typed = Math.round(goal.length * Math.min(1, p / 0.28));
  const planShown = p > 0.3;
  const done = Math.max(0, Math.min(plan.length, Math.floor((p - 0.36) / 0.13) + 1));
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
          <div className="u-console" aria-label={`ドヤくんが${product.name}の目的から作戦を立てて進める様子の例`}>
            <div className="u-console-head">
              <span>ドヤくんに頼む</span>
              <span className="u-console-state">{done >= plan.length ? "完了" : planShown ? "進行中" : "入力中"}</span>
            </div>
            <div className="u-goal">
              <Target size={16} strokeWidth={1.5} />
              <span>
                {goal.slice(0, typed)}
                {!planShown && <i className="u-caret" />}
              </span>
            </div>
            <ol className={`u-plan ${planShown ? "is-shown" : ""}`}>
              {plan.map((row, i) => {
                const state = i < done ? "is-done" : i === done && planShown ? "is-run" : "";
                return (
                  <li key={row.text} className={`u-plan-row ${state}`}>
                    <span className="u-plan-no">{i < done ? <Check size={14} strokeWidth={2} /> : i + 1}</span>
                    <span className="u-plan-body">
                      <b>{row.text}</b>
                      <small>{row.tool}</small>
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="u-plan-stamp" src={MARK} alt="" width={22} height={22} />
                  </li>
                );
              })}
            </ol>
            <div className="u-console-foot">
              <span>
                {done}/{plan.length} 件
              </span>
              <span className="u-meter">
                <i style={{ transform: `scaleX(${done / plan.length})` }} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 5つの製品（今の製品に印をつけた罫線の表） ---------- */

function OtherProducts({ product, theme }: { product: Product; theme: Theme }) {
  const q = theme === "dark" ? "?theme=dark" : "";
  return (
    <section id="products" className="u-section" aria-labelledby="u-prods-h">
      <div className="u-wrap">
        <Reveal>
          <p className="u-kicker">5つの製品</p>
          <h2 id="u-prods-h" className="u-h2">
            ほかの製品も、
            <br />
            同じ契約で使えます
          </h2>
          <p className="u-lead">部門ごとに入口を分けています。担当でない製品のツールも、いつでも開けます。</p>
        </Reveal>
        <ul className="u-prod-list">
          {PRODUCT_ORDER.map((id) => {
            const p = PRODUCTS[id];
            const here = id === product.id;
            return (
              <li key={id}>
                <Link href={`${base}/${id}${q}`} className={`u-prod-row ${here ? "is-here" : ""}`} aria-current={here ? "page" : undefined}>
                  <span className="u-prod-name">ドヤバディ {p.name}</span>
                  <span className="u-prod-one">{p.oneLine}</span>
                  <span className="u-prod-go">{here ? "いま見ている製品" : <ArrowRight size={16} strokeWidth={1.5} />}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---------- 料金（5ページ共通の言い切り） ---------- */

function Pricing({ plan }: { plan: Plan }) {
  return (
    <section id="pricing" className="u-section u-pricing" aria-labelledby="u-price-h">
      <div className="u-wrap">
        <Reveal>
          <p className="u-kicker">料金</p>
          <h2 id="u-price-h" className="u-h2">
            まず無料で始めて、
            <br />
            使いたくなったらプロへ
          </h2>
        </Reveal>
        <div className="u-prices">
          <Reveal className="u-price">
            <h3>無料で始められます</h3>
            <p className="u-price-num">
              ¥0<small>/月</small>
            </p>
            <p className="u-price-desc">登録するだけで、すぐに使えます。</p>
            <ul>
              <li>
                <Check size={16} strokeWidth={2} />
                最初にドヤパワー {plan.freeStart}
              </li>
              <li>
                <Check size={16} strokeWidth={2} />
                毎日 {plan.freeDaily} ずつ回復（上限 {plan.freeStart}）
              </li>
            </ul>
            <Link href="/auth/signin" className="u-btn u-btn-ghost">
              無料で始める
            </Link>
          </Reveal>
          <Reveal className="u-price is-team" delay={80}>
            <h3>プロ1つで、5つの製品が全部使えます</h3>
            <p className="u-price-num">
              {plan.proPrice}
              <small>/月</small>
            </p>
            <p className="u-price-desc">セールス・マーケティング・人事・予実管理・経営管理を、1つの契約で使えます。</p>
            <ul>
              <li>
                <Check size={16} strokeWidth={2} />
                製品ごとの契約は要りません
              </li>
              <li>
                <Check size={16} strokeWidth={2} />
                全部のツールを使えます
              </li>
            </ul>
            <Link href="/pricing" className="u-btn">
              料金をくわしく見る <ArrowRight size={18} strokeWidth={1.5} />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- よくある質問 ---------- */

function faqFor(product: Product, plan: Plan) {
  return [
    { q: "製品ごとに契約が要りますか", a: `要りません。プロ1つ（月${plan.proPriceJa}）で、5つの製品が全部使えます。` },
    { q: "無料で何ができますか", a: `最初にドヤパワーを${plan.freeStart}受け取れて、試せます。ドヤパワーは毎日${plan.freeDaily}ずつ回復します（上限${plan.freeStart}）。Google アカウントで登録できます。` },
    { q: `${product.name}の担当でなくても、ほかの製品のツールを使えますか`, a: "使えます。製品は、見える順番を分けるものです。担当でない製品のツールも、すべてのツールの一覧から開けます。" },
    { q: "ドヤくんは、勝手に外へ送ったり公開したりしますか", a: "しません。メールの送信や公開など、外に出る操作は、人が確かめてから進めます。" },
    { q: "AIが作った物は、そのまま使えますか", a: "下書きとして使い、内容は人が確かめてください。画面で直してから使えます。" },
    { q: "ドヤAIとは別のサービスですか", a: "同じサービスです。名前を「ドヤバディ」に変えました。URL とツールの名前は、そのままです。" },
  ];
}

function Faq({ product, plan }: { product: Product; plan: Plan }) {
  const items = faqFor(product, plan);
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
          {items.map((f) => (
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

function FinalCta({ product, plan }: { product: Product; plan: Plan }) {
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
          <p>
            無料で始められます。プロ1つ（月{plan.proPriceJa}）で、{product.name}を含む5つの製品が全部使えます。
          </p>
        </div>
        <Link href="/auth/signin" className="u-btn u-btn-lg">
          無料で始める <ArrowRight size={18} strokeWidth={1.5} />
        </Link>
      </div>
    </section>
  );
}

export function ProductLp({ product, plan, theme }: { product: Product; plan: Plan; theme: Theme }) {
  return (
    <div className="u u-product" data-theme={theme}>
      <a href="#u-main" className="u-skip">
        本文へ移動
      </a>
      <Nav product={product} />
      <Hero product={product} plan={plan} />
      <div id="u-hero-end" aria-hidden="true" />
      <main id="u-main">
        <Pains product={product} />
        <Tools product={product} />
        <Story product={product} />
        <OtherProducts product={product} theme={theme} />
        <Pricing plan={plan} />
        <Faq product={product} plan={plan} />
        <FinalCta product={product} plan={plan} />
      </main>
      <Footer />
      <MobileCta />
    </div>
  );
}
