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
import { SERVICES, HIDDEN_SERVICE_IDS } from "@/lib/services";
import { UNIFIED_PRO_PRICE } from "@/lib/unified-plan";
import type { Step } from "../sections";
import "./renewal.css";

export const RenewalContext = createContext("");
export function RenewalFrame({
  serviceName,
  children,
}: {
  serviceName: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [consult, setConsult] = useState(false);
  useEffect(() => {
    const root = ref.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("doya-visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.07 },
    );
    root
      .querySelectorAll("main > section, .doya-feature-row, .doya-resource")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return (
    <RenewalContext.Provider value={serviceName}>
      <div
        ref={ref}
        className={`doya-renewal ${paused ? "doya-motion-paused" : ""} ${consult ? "doya-consult-open" : ""}`}
        data-renewal="2026-09"
      >
        {children}
        <button
          className="doya-consult-toggle"
          onClick={() => setConsult(!consult)}
          aria-expanded={consult}
        >
          {consult ? "相談案内を閉じる" : "無料相談のご案内"}
        </button>
        <button
          className="doya-motion-toggle"
          onClick={() => setPaused(!paused)}
          aria-pressed={paused}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
          {paused ? "動きを再開" : "動きを止める"}
        </button>
      </div>
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
  return (
    <section className="doya-hero">
      <div className="doya-hero-inner">
        <div className="doya-hero-copy">
          <span className="doya-eyebrow">
            <Sparkles size={16} />
            {service?.name || props.eyebrow || "ドヤマーケAI"}
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
            <Check size={15} />
            無料プランからお試しいただけます
            {props.subCtaHref && (
              <Link href={props.subCtaHref}>
                {props.subCtaLabel || "詳しく見る"} <ArrowRight size={13} />
              </Link>
            )}
          </p>
        </div>
        <div className="doya-hero-stage">
          <div className="doya-stage-label">
            <span />
            {service?.shortName || "あなたの仕事"}の頼れるパートナー
          </div>
          <div className="doya-product-display">
            {props.visual ||
              (props.image && (
                <Image
                  src={props.image.src}
                  alt={props.image.alt}
                  width={1600}
                  height={1000}
                  priority
                  sizes="(max-width: 800px) 100vw, 650px"
                />
              ))}
          </div>
          <div className="doya-status-chip">
            <Check size={17} />
            次の作業が、見えてきます。
          </div>
          <Image
            className="doya-hero-bear"
            src="/renewal/bear-hero.webp"
            alt="作業をお手伝いするドヤくん"
            width={420}
            height={420}
            priority
          />
          <span className="doya-demo-label">画面は操作イメージです</span>
        </div>
      </div>
      <div className="doya-value-strip">
        <span>
          <MousePointer2 size={18} />
          使いたい業務から始める
        </span>
        <span>
          <Layers size={18} />
          1つのアカウントで使える
        </span>
        <span>
          <ShieldCheck size={18} />
          確認・判断はあなたの手で
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
          {service ? (
            <div className="doya-step-image" key={`${service.id}-${active}`}>
              <Image
                src={`/${service.id}/shots/${["1-input", "2-process", "3-output"][Math.min(active, 2)]}.webp`}
                alt={`${steps[active].title}の操作イメージ`}
                width={1280}
                height={800}
                sizes="(max-width: 800px) 95vw, 640px"
              />
              <span>操作イメージ</span>
            </div>
          ) : (
            <div className="doya-workflow-partner">
              <Image
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
              {service?.name || "ドヤマーケAI"}
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
                  <span>DOYA MARKE AI</span>
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

const groups = [
  { name: "すべて", ids: [] },
  {
    name: "制作・マーケティング",
    ids: [
      "banner",
      "seo",
      "interview",
      "persona",
      "doyaslide",
      "aio",
      "adimage",
    ],
  },
  {
    name: "営業",
    ids: ["doyalist", "sfa", "shodan", "cunning", "quote", "aishodan"],
  },
  { name: "人事・業務管理", ids: ["hr", "kintai", "promane", "mensetsu"] },
];
export function ServiceDirectory({ compact = false }: { compact?: boolean }) {
  const [filter, setFilter] = useState(0);
  const all = SERVICES.filter(
    (s) =>
      !HIDDEN_SERVICE_IDS.has(s.id) && ["active", "beta"].includes(s.status),
  ).sort((a, b) => a.order - b.order);
  const shown =
    filter === 0 ? all : all.filter((s) => groups[filter].ids.includes(s.id));
  return (
    <section id="doya-services" className="doya-directory">
      <div className="doya-section-inner">
        <span className="doya-eyebrow">YOUR AI TEAM</span>
        <h2>
          {compact
            ? "ほかの仕事にも、ドヤマーケAI。"
            : "今日の「やりたい」に、\nぴったりの仲間を。"}
        </h2>
        <p>作る、伝える、チームで進める。必要な業務からお選びください。</p>
        <div className="doya-filter" aria-label="業務で絞り込み">
          {groups.map((g, i) => (
            <button
              key={g.name}
              aria-pressed={filter === i}
              onClick={() => setFilter(i)}
            >
              {g.name}
            </button>
          ))}
        </div>
        <p className="doya-result-count" aria-live="polite">
          {shown.length}サービス
        </p>
        <div className="doya-service-grid">
          {shown.map((s) => (
            <Link href={s.href} key={s.id} className="doya-service-card">
              <Image
                src={`/renewal/icons/${s.id}.webp`}
                alt=""
                width={52}
                height={52}
              />
              <h3>{s.name}</h3>
              <p>{s.description}</p>
              <span>
                詳しく見る <ArrowRight size={18} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PriceSummary() {
  return (
    <section className="doya-pricing">
      <div className="doya-section-inner">
        <div>
          <span className="doya-eyebrow">ONE ACCOUNT, ONE PLAN</span>
          <h2>ひとつの契約で、 仕事の可能性が広がります。</h2>
          <p>
            まずは無料プランで。継続して使うなら、
            全サービス共通のプロプランをご利用ください。
          </p>
        </div>
        <div className="doya-price-card">
          <span>プロプラン / 月額（税込）</span>
          <strong>¥{UNIFIED_PRO_PRICE.toLocaleString("ja-JP")}</strong>
          <p>各サービスの利用上限があります。</p>
          <Link className="doya-button" href="/pricing">
            料金・利用枠を確認する <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
