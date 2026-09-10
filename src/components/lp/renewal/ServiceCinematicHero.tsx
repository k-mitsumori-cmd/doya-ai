"use client";

import { useContext, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, Play, RotateCcw } from "lucide-react";
import { MotionContext, ServiceMotion } from "./HeroMotion";
import { CINEMATIC_SCENES } from "./cinematic-scenes";
import { DEMOS } from "./OperationDemo";
import "./banner-cinematic.css";

export function ServiceCinematicHero({
  serviceId,
  serviceName,
  ctaHref,
  ctaLabel,
  subCtaHref,
  subCtaLabel,
  freeLimit,
}: {
  serviceId: string;
  serviceName: string;
  ctaHref: string;
  ctaLabel?: string;
  subCtaHref?: string;
  subCtaLabel?: string;
  freeLimit: string;
}) {
  const config = CINEMATIC_SCENES[serviceId];
  const demoAnchor = `${serviceId}-live-demo`;
  const paused = useContext(MotionContext);
  const scene = useRef<HTMLDivElement>(null);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    const element = scene.current;
    if (!element) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const offset =
        paused || media.matches
          ? 0
          : Math.min(
              72,
              Math.max(0, -element.getBoundingClientRect().top) * 0.12,
            );
      element.style.setProperty("--atelier-parallax", `${offset}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    media.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      media.removeEventListener("change", update);
    };
  }, [paused, replay]);

  return (
    <section
      className="doya-hero doya-service-cinema"
      data-cinematic-fv="2026-09-10"
      data-cinematic-service={serviceId}
    >
      <div ref={scene} className="doya-atelier" key={replay}>
        <div className="doya-atelier-parallax" aria-hidden="true">
          <div className="doya-atelier-camera">
            <Image
              unoptimized
              priority
              src={config.image}
              alt=""
              fill
              sizes="100vw"
            />
          </div>
        </div>
        <div className="doya-atelier-content">
          <div className="doya-atelier-copy">
            <p className="doya-atelier-eyebrow">
              <span />
              {serviceName}{" "}
              <span className="doya-atelier-en">{config.category}</span>
            </p>
            <h1>
              {config.title[0]}
              <br />
              <em>{config.title[1]}</em>
            </h1>
            <p className="doya-atelier-lead">
              <span>{config.lead[0]}</span>
              <span>{config.lead[1]}</span>
            </p>
            <div className="doya-actions">
              <Link className="doya-button" href={ctaHref}>
                {ctaLabel || "無料ではじめる"}
                <ArrowRight size={20} />
              </Link>
              <a className="doya-atelier-demo-link" href={`#${demoAnchor}`}>
                <Play size={15} />
                操作デモを見る
              </a>
            </div>
            <p className="doya-atelier-free">
              <Check size={14} />
              無料プラン：{freeLimit}
              {subCtaHref && (
                <Link href={subCtaHref}>{subCtaLabel || "詳しく見る"}</Link>
              )}
            </p>
          </div>
        </div>
        <div className="doya-atelier-caption">
          <span>CREATIVE POSSIBILITIES</span>
          <span>AIで制作したコンセプトビジュアル</span>
        </div>
        <div className="doya-atelier-bottom">
          <a href={`#${demoAnchor}`}>
            <ArrowDown size={16} />
            操作の流れを見る
          </a>
          <button
            type="button"
            onClick={() => setReplay((n) => n + 1)}
            disabled={paused}
            aria-label="ファーストビューの演出をもう一度見る"
          >
            <RotateCcw size={14} />
            <span>もう一度見る</span>
          </button>
        </div>
      </div>
      <div
        className="doya-atelier-benefits"
        aria-label={`${serviceName}の操作の流れ`}
      >
        {DEMOS[serviceId].labels.map((label, index) => (
          <span key={label}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            {label}
          </span>
        ))}
      </div>
      <div id={demoAnchor} className="doya-atelier-operation">
        <div className="doya-atelier-operation-copy">
          <span className="doya-eyebrow">HOW IT FEELS</span>
          <h2>
            {config.demoTitle[0]}
            <br />
            {config.demoTitle[1]}
          </h2>
          <p>{config.demoLead}</p>
          <a href="#doya-how">
            3ステップで使い方を知る
            <ArrowRight size={16} />
          </a>
        </div>
        <div className="doya-atelier-demo">
          <ServiceMotion id={serviceId} name={serviceName} />
        </div>
      </div>
    </section>
  );
}
