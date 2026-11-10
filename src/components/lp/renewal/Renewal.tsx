"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Layers,
  Play,
  Pause,
  Sparkles,
  MousePointer2,
  ShieldCheck,
} from "lucide-react";
import { SERVICES, HIDDEN_SERVICE_IDS, getListedServices } from "@/lib/services";
import { SHELL_GROUPS } from "@/components/shell/tools";
import { FREE_LINE, PUBLIC_PRICE, yen } from "@/lib/pricing-v2/public-copy";
import { ProductPreview } from "./ProductPreview";
import { MotionContext, ServiceMotion } from "./HeroMotion";
import { DEMOS } from "./OperationDemo";
import { ServiceCinematicHero } from "./ServiceCinematicHero";
import { CINEMATIC_SCENES } from "./cinematic-scenes";
import { OpeningCurtain, OPENING_COPY } from "./OpeningCurtain";
import type { Step } from "../sections";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "framer-motion";
import { brandNameEn } from "@/lib/brand";
import { CountUp, LP_CARD_IO } from "./TopExtras";
import "./renewal.css";
import "./hero-motion.css";
// 2026-11-10 の直し（表示の動き・画面の外の動きを止める・押したときの動き）。上の2つより後に読む
import "./motion-2026-11.css";

// 操作の3段階の写真（public/<id>/shots/）がまだ無いサービス。写真を置いたら外す
const NO_STEP_SHOTS = new Set(["income", "expense", "tenjikai"]);

export const RenewalContext = createContext("");
export function RenewalFrame({
  serviceName,
  children,
}: {
  serviceName: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const serviceId = SERVICES.find(
    (service) => service.name === serviceName,
  )?.id;
  const hasOpening = Boolean(serviceId && OPENING_COPY[serviceId]);
  const [covered, setCovered] = useState(hasOpening);
  const [paused, setPaused] = useState(false);
  // スマホで下へ送っているあいだは、下に固定した「無料相談のご案内」を引っ込める（カードの「詳しく見る」に重ねないため）
  const [chromeHidden, setChromeHidden] = useState(false);
  useEffect(() => {
    const root = ref.current;
    if (!root || !("IntersectionObserver" in window)) return;
    // ⚠️ 中身は初めから見える状態のまま。動きは、小さなずれと透明度だけ（2026-11-10。速く送ると白い画面が出ていたため）。
    //    画面に入る少し手前（下 25%）で始め、大きな section 全体ではなく、中の見出しやカード単位で動かす。
    const reveal = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("doya-visible");
            reveal.unobserve(entry.target);
          }
        }),
      { rootMargin: "0px 0px 25% 0px", threshold: 0 },
    );
    root
      .querySelectorAll(
        "main > section:not(.doya-home-hero):not(.doya-hero) .doya-section-inner > *, .doya-feature-row, .doya-resource",
      )
      .forEach((el) => {
        el.classList.add("doya-reveal");
        reveal.observe(el);
      });
    // 画面の外にある section の動きは止める（電池と、重い PC での表示のため）。少し手前から動かし始める
    const offscreen = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) =>
          entry.target.toggleAttribute("data-offscreen", !entry.isIntersecting),
        ),
      { rootMargin: "200px 0px 200px 0px", threshold: 0 },
    );
    root.querySelectorAll("main > section, main > div").forEach((el) => offscreen.observe(el));
    return () => {
      reveal.disconnect();
      offscreen.disconnect();
    };
  }, []);
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 160;
        if (nearBottom || y < 120) setChromeHidden(false);
        else if (y - last > 6) setChromeHidden(true);
        else if (last - y > 6) setChromeHidden(false);
        last = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <RenewalContext.Provider value={serviceName}>
      <MotionContext.Provider value={paused || covered}>
        <div
          ref={ref}
          className={`doya-renewal ${paused ? "doya-motion-paused" : ""} ${chromeHidden ? "doya-chrome-hidden" : ""}`}
          data-renewal="2026-09"
          data-fv-motion="2026-09-08"
          data-operation-demo="2026-09-08"
        >
          <div
            ref={contentRef}
            className={`doya-intro-content ${covered ? "doya-intro-covered" : ""}`}
          >
            {children}
            <a
              className="doya-consult-toggle"
              href="https://doyamarke.surisuta.jp/download/base02_doyamarke-free-1"
              target="_blank"
              rel="noreferrer"
            >
              無料相談のご案内
            </a>
            {/* 2026-11-10: 文字をやめてアイコンだけにした（スマホで絵やカードに重なっていたため）。名前は aria-label と title で伝える */}
            <button
              type="button"
              className="doya-motion-toggle"
              onClick={() => setPaused(!paused)}
              aria-pressed={paused}
              aria-label={paused ? "動きを再開" : "動きを止める"}
              title={paused ? "動きを再開" : "動きを止める"}
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          </div>
          {hasOpening && serviceId && (
            <OpeningCurtain
              key={serviceId}
              serviceId={serviceId}
              serviceName={serviceName}
              paused={paused}
              onCoverChange={setCovered}
              contentRef={contentRef}
            />
          )}
        </div>
      </MotionContext.Provider>
    </RenewalContext.Provider>
  );
}

export function RenewalHero(props: {
  eyebrow?: string;
  title: React.ReactNode;
  highlight?: string;
  subtitle: string;
  note?: string;
  ctaHref: string;
  ctaLabel?: string;
  subCtaHref?: string;
  subCtaLabel?: string;
  visual?: React.ReactNode;
  image?: { src: string; alt: string };
}) {
  const name = useContext(RenewalContext);
  const service = SERVICES.find((s) => s.name === name);
  if (service && CINEMATIC_SCENES[service.id]) {
    return (
      <ServiceCinematicHero
        {...props}
        serviceId={service.id}
        serviceName={service.name}
        freeLimit={service.pricing.free.limit}
      />
    );
  }
  return (
    <section className="doya-hero">
      <div className="doya-hero-inner">
        <div className="doya-hero-copy">
          <span className="doya-eyebrow">
            <Sparkles size={16} />
            {props.eyebrow && props.eyebrow !== "ドヤAI"
              ? props.eyebrow
              : service?.name || "ドヤAI"}
          </span>
          <h1>
            {props.title}
            {props.highlight && (
              <>
                <br />
                <em>{props.highlight}</em>
              </>
            )}
          </h1>
          <p className="doya-lead">{props.subtitle}</p>
          <div className="doya-actions">
            <Link className="doya-button" href={props.ctaHref}>
              {props.ctaLabel || "無料ではじめる"}
              <ArrowRight size={20} />
            </Link>
            <a className="doya-button doya-secondary" href="#doya-how">
              <Play size={16} />
              使い方を見る
            </a>
          </div>
          <p className="doya-small">
            <span className="doya-free-limit">
              <Check size={15} aria-hidden="true" />
              <span>
                {service
                  ? `無料プラン：${service.pricing.free.limit}`
                  : "無料プランからお試しいただけます"}
              </span>
            </span>
            {props.subCtaHref && (
              <Link href={props.subCtaHref}>
                {props.subCtaLabel || "詳しく見る"} <ArrowRight size={13} />
              </Link>
            )}
          </p>
        </div>
        <div className="doya-hero-stage">
          <div className="doya-stage-energy" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="doya-stage-label">
            <span />
            {service?.shortName || "あなたの仕事"}の頼れるパートナー
          </div>
          {service && DEMOS[service.id] ? (
            <ServiceMotion id={service.id} name={name} />
          ) : (
            <ProductPreview
              className="doya-product-display"
              src={service ? `/${service.id}/hero.webp` : props.image?.src}
              alt={`${name}の画面`}
            >
              {props.visual ||
                (props.image && (
                  <Image
                    unoptimized
                    src={props.image.src}
                    alt={props.image.alt}
                    width={1600}
                    height={1000}
                    priority
                    sizes="(max-width: 800px) 100vw, 650px"
                  />
                ))}
            </ProductPreview>
          )}
          <Image
            unoptimized
            className="doya-hero-bear"
            src="/renewal/bear-hero.webp"
            alt="作業をお手伝いするドヤくん"
            width={420}
            height={420}
            priority
          />
        </div>
      </div>
      <div className="doya-value-strip">
        <span>
          <MousePointer2 size={18} />
          必要な業務から選ぶ
        </span>
        <span>
          <Layers size={18} />
          1アカウントで利用
        </span>
        <span>
          <ShieldCheck size={18} />
          確認して業務に活用
        </span>
      </div>
    </section>
  );
}

export function Workflow({
  title,
  lead,
  steps,
}: {
  title: React.ReactNode;
  lead?: string;
  steps: Step[];
}) {
  const name = useContext(RenewalContext);
  const service = SERVICES.find((s) => s.name === name);
  const [active, setActive] = useState(0);
  const [failedShot, setFailedShot] = useState<string | null>(null);
  return (
    <section id="doya-how" className="doya-workflow">
      <div className="doya-section-inner">
        <div className="doya-workflow-heading">
          <div>
            <span className="doya-eyebrow">HOW IT WORKS</span>
            <h2>{title}</h2>
            <p>
              {lead ||
                "入力から確認まで。各ステップを押して、進め方をご覧ください。"}
            </p>
          </div>
          <Image
            unoptimized
            src="/renewal/bear-success.webp"
            alt="完成を知らせるドヤくん"
            width={190}
            height={190}
          />
        </div>
        <div
          className="doya-step-tabs"
          role="tablist"
          aria-label="使い方のステップ"
        >
          {steps.map((step, i) => (
            <button
              key={step.title}
              role="tab"
              id={`doya-step-${i}`}
              aria-controls="doya-step-panel"
              aria-selected={i === active}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (
                  ["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)
                ) {
                  e.preventDefault();
                  const next =
                    e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? steps.length - 1
                        : (active +
                            (e.key === "ArrowRight" ? 1 : -1) +
                            steps.length) %
                          steps.length;
                  setActive(next);
                  document.getElementById(`doya-step-${next}`)?.focus();
                }
              }}
            >
              <b>{String(i + 1).padStart(2, "0")}</b>
              <span>{step.title}</span>
              <ArrowRight size={18} />
            </button>
          ))}
        </div>
        <div
          className="doya-step-panel"
          id="doya-step-panel"
          role="tabpanel"
          aria-labelledby={`doya-step-${active}`}
          tabIndex={0}
        >
          <div key={active} className="doya-step-content">
            <span className="doya-step-number">
              STEP {String(active + 1).padStart(2, "0")}
            </span>
            <h3>{steps[active].title}</h3>
            <p>{steps[active].desc}</p>
            <div className="doya-step-indicator">
              {steps.map((_, i) => (
                <span key={i} className={i <= active ? "is-done" : ""} />
              ))}
            </div>
            <p className="doya-step-hint">
              {active === steps.length - 1
                ? "内容を確認し、必要に応じて編集してご活用ください。"
                : service
                  ? "各ステップの画面は、操作イメージです。"
                  : "詳しい使い方は、各サービスのページでご覧いただけます。"}
            </p>
          </div>
          {/* 操作画面の写真が無い・読めないサービスは、ドヤくんの絵を出す（収入管理など） */}
          {service && !NO_STEP_SHOTS.has(service.id) && failedShot !== `${service.id}-${active}` ? (
            <ProductPreview
              className="doya-step-image"
              key={`${service.id}-${active}`}
              src={`/${service.id}/shots/${["1-input", "2-process", "3-output"][Math.min(active, 2)]}.webp`}
              alt={`${steps[active].title}の画面`}
            >
              <Image
                unoptimized
                src={`/${service.id}/shots/${["1-input", "2-process", "3-output"][Math.min(active, 2)]}.webp`}
                alt={`${steps[active].title}の操作イメージ`}
                width={1280}
                height={800}
                sizes="(max-width: 800px) 95vw, 640px"
                onError={() => setFailedShot(`${service.id}-${active}`)}
              />
            </ProductPreview>
          ) : (
            <div className="doya-workflow-partner">
              <Image
                unoptimized
                src="/renewal/bear-hero.webp"
                alt="作業をご案内するドヤくん"
                width={250}
                height={250}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function ResourcePack() {
  const name = useContext(RenewalContext);
  const service = SERVICES.find((s) => s.name === name);
  const cards = [
    {
      title: "まずは、全体像から。",
      label: "サービス紹介",
      text: "できることと活用シーンを、一冊に。",
      file: "overview",
      Icon: Layers,
    },
    {
      title: "使う場面を、具体的に。",
      label: "はじめ方ガイド",
      text: "準備するものと確認のポイント。",
      file: "getting-started",
      Icon: MousePointer2,
    },
    {
      title: "社内での検討を、スムーズに。",
      label: "導入チェックリスト",
      text: "料金・運用・確認事項を整理。",
      file: "checklist",
      Icon: FileText,
    },
  ];
  return (
    <section id="doya-resources" className="doya-resources">
      <div className="doya-section-inner">
        <div className="doya-resource-heading">
          <div>
            <span className="doya-eyebrow">STARTER KIT</span>
            <h2>すぐわかる、3点セット。</h2>
            <p>
              {service?.name || "ドヤAI"}
              を検討するための資料です。登録せずにご覧いただけます。
            </p>
          </div>
          <a
            className="doya-text-link"
            href="/resources/doya-ai/overview.html"
            target="_blank"
            rel="noreferrer"
          >
            資料を開く <ArrowRight size={20} />
          </a>
        </div>
        <div className="doya-resource-grid">
          {cards.map(({ title, label, text, file, Icon }, i) => (
            <a
              className={`doya-resource doya-resource-${i}`}
              href={`/resources/doya-ai/${file}.html${service ? "#" + service.id : ""}`}
              target="_blank"
              rel="noreferrer"
              key={file}
            >
              <div className="doya-book-stage">
                <div className="doya-book">
                  {/* 2026-11-10: 旧名「DOYA MARKE AI」をやめ、今のブランド名（旗に合わせて DOYA AI / DOYA BUDDY）にした */}
                  <span>{brandNameEn()}</span>
                  <Icon size={36} />
                  <strong>{label}</strong>
                  <small>{String(i + 1).padStart(2, "0")} / STARTER KIT</small>
                </div>
              </div>
              <div className="doya-resource-caption">
                <h3>{title}</h3>
                <p>{text}</p>
                <span>
                  資料を見る
                  <ArrowRight size={18} />
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// 分類は、ログイン後のメニュー（src/components/shell/tools.ts の SHELL_GROUPS）と同じ4つにそろえる。
// マーケティング / 営業（セールス） / 採用・人材管理 / 経理・バックオフィス
const groups = [
  { name: "すべて", ids: [] as string[] },
  ...SHELL_GROUPS.filter((g) => g.stage !== "other").map((g) => ({
    name: g.label,
    ids: g.tools.map((t) => t.id),
  })),
];
// 最初に大きく見せる代表のツール（2026-11-10 メインの指摘「18枚が同じ重さで長い」による）
const FEATURED_IDS = ["banner", "seo", "shodan", "doyaslide"];

function CardIO({ id, fallback }: { id: string; fallback: string }) {
  const io = LP_CARD_IO[id];
  if (!io) return <p>{fallback}</p>;
  return (
    <p className="doya-card-io">
      <span>
        <b>入れる</b>
        {io.input}
      </span>
      <span>
        <b>出る</b>
        {io.output}
      </span>
    </p>
  );
}

export function ServiceDirectory({ compact = false }: { compact?: boolean }) {
  const [filter, setFilter] = useState(0);
  const all = getListedServices();
  const featured = FEATURED_IDS.map((id) => all.find((s) => s.id === id)).filter(
    (s): s is (typeof all)[number] => Boolean(s),
  );
  // 「すべて」のときは、上の代表の4つを除いた残りを並べる。部署で絞ったときは、その部署の全部を並べる
  const shown =
    filter === 0
      ? all.filter((s) => !FEATURED_IDS.includes(s.id))
      : all.filter((s) => groups[filter].ids.includes(s.id));
  return (
    <section id="doya-services" className="doya-directory">
      <div className="doya-section-inner">
        <span className="doya-eyebrow">YOUR AI TEAM</span>
        <h2>
          {compact
            ? "ほかの仕事にも、ドヤAI。"
            : "今日の「やりたい」に、\nぴったりの仲間を。"}
        </h2>
        <p>
          作る、伝える、チームで進める。<CountUp to={all.length} />
          のツールから、必要な業務をお選びください。
        </p>
        {!compact && featured.length > 0 && (
          <div className="doya-featured-grid">
            {featured.map((s) => (
              <Link href={s.href} key={s.id} className="doya-featured-card">
                <Image
                  unoptimized
                  src={`/renewal/icons/${s.id}.webp`}
                  alt=""
                  width={64}
                  height={64}
                />
                <h3>{s.name}</h3>
                <CardIO id={s.id} fallback={s.description} />
                <small>
                  <Check size={14} aria-hidden="true" />
                  無料プラン：{s.pricing.free.limit}
                </small>
                <span>
                  詳しく見る <ArrowRight size={18} />
                </span>
              </Link>
            ))}
          </div>
        )}
        <h3 className="doya-directory-sub">ほかのツールを、仕事で探す</h3>
        <div className="doya-filter" role="group" aria-label="業務で絞り込み">
          {groups.map((g, i) => (
            <button
              key={g.name}
              type="button"
              aria-pressed={filter === i}
              onClick={() => setFilter(i)}
            >
              {g.name}
            </button>
          ))}
        </div>
        <p className="doya-result-count" aria-live="polite">
          {shown.length}ツール
        </p>
        <MotionConfig reducedMotion="user">
          <LayoutGroup>
            <motion.div layout className="doya-service-grid doya-service-grid-compact">
              <AnimatePresence initial={false} mode="popLayout">
                {shown.map((s) => (
                  <motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="doya-service-cell"
                  >
                    <Link href={s.href} className="doya-service-card">
                      <Image
                        unoptimized
                        src={`/renewal/icons/${s.id}.webp`}
                        alt=""
                        width={52}
                        height={52}
                      />
                      <h3>{s.name}</h3>
                      <CardIO id={s.id} fallback={s.description} />
                      <span>
                        詳しく見る <ArrowRight size={18} />
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </LayoutGroup>
        </MotionConfig>
      </div>
    </section>
  );
}

// 2026-11-10: 料金の節を /pricing のチームの料金にそろえた（三森さんの決定）。数は public-copy.ts（plans.ts）から出す。
// ⚠️ 前からの契約者の ¥9,980 は、ログイン前のページに出さない（ログイン後の /pricing だけで案内する）
export function PriceSummary() {
  return (
    <section className="doya-pricing">
      <div className="doya-section-inner">
        <div>
          <span className="doya-eyebrow">ONE COMPANY, ONE PLAN</span>
          <h2>料金は会社ごと。全ツールを使えます。</h2>
          <p>
            {PUBLIC_PRICE.isPerSeat
              ? `${PUBLIC_PRICE.freeMembers}人までの会社は、無料のフリーで使えます。ドヤパワーが足りないときや、${PUBLIC_PRICE.freeMembers + 1}人以上で使うときは、有料のチームに切り替えます。`
              : `${PUBLIC_PRICE.freeMembers}人までの会社は、無料のフリーで使えます。人数が増えたら、有料のチームに切り替えます。`}
          </p>
        </div>
        <div className="doya-price-card">
          <span>チーム（{PUBLIC_PRICE.exampleSeats}人の場合）/ 月額（税抜）</span>
          <strong>{yen(PUBLIC_PRICE.exampleMonthly)}</strong>
          <p>
            {PUBLIC_PRICE.isPerSeat
              ? <>税込 {yen(PUBLIC_PRICE.exampleMonthlyWithTax)}。1人 {yen(PUBLIC_PRICE.perSeat)} × {PUBLIC_PRICE.exampleSeats}人。{FREE_LINE}です。</>
              : <>税込 {yen(PUBLIC_PRICE.exampleMonthlyWithTax)}。基本料 {yen(PUBLIC_PRICE.base)}＋1人 {yen(PUBLIC_PRICE.perSeat)} × {PUBLIC_PRICE.exampleSeats}人。{FREE_LINE}です。</>}
          </p>
          <Link className="doya-button" href="/pricing">
            人数ごとの料金を見る <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
