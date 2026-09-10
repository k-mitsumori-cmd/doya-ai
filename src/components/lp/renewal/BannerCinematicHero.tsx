"use client";

import { useContext, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, Play, RotateCcw } from "lucide-react";
import { MotionContext, ServiceMotion } from "./HeroMotion";
import "./banner-cinematic.css";

export function BannerCinematicHero({
  ctaHref,
  ctaLabel,
  subCtaHref,
  freeLimit,
}: {
  ctaHref: string;
  ctaLabel?: string;
  subCtaHref?: string;
  freeLimit: string;
}) {
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
      className="doya-hero doya-banner-cinema"
      data-cinematic-fv="2026-09-10"
    >
      <div ref={scene} className="doya-atelier" key={replay}>
        <div className="doya-atelier-parallax" aria-hidden="true">
          <div className="doya-atelier-camera">
            <Image
              unoptimized
              priority
              src="/renewal/banner-atelier-20260910-v1.webp"
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
              ドヤバナーAI{" "}
              <span className="doya-atelier-en">CREATIVE STUDIO</span>
            </p>
            <h1>
              そのアイデアを、
              <br />
              <em>
                目を引く
                <br className="doya-atelier-break" />
                バナーに。
              </em>
            </h1>
            <p className="doya-atelier-lead">
              つくりたい想いに、AIの表現力を。
              <br />
              業種を選ぶだけで、訴求の異なる3案を提案。
              <br className="doya-atelier-desktop" />
              選んで、比べて、あなたの広告へ。
            </p>
            <div className="doya-actions">
              <Link className="doya-button" href={ctaHref}>
                {ctaLabel || "無料で作る"}
                <ArrowRight size={20} />
              </Link>
              <a className="doya-atelier-demo-link" href="#banner-live-demo">
                <Play size={15} />
                操作デモを見る
              </a>
            </div>
            <p className="doya-atelier-free">
              <Check size={14} />
              無料プラン：{freeLimit}
              {subCtaHref && <Link href={subCtaHref}>料金を見る</Link>}
            </p>
          </div>
        </div>
        <div className="doya-atelier-caption">
          <span>CREATIVE POSSIBILITIES</span>
          <span>AIで制作したコンセプトビジュアル</span>
        </div>
        <div className="doya-atelier-bottom">
          <a href="#banner-live-demo">
            <ArrowDown size={16} />
            アイデアが、かたちになるまで
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
      <div className="doya-atelier-benefits" aria-label="ドヤバナーAIの特長">
        <span>
          <b>01</b>業種に合わせて選ぶ
        </span>
        <span>
          <b>02</b>A/B/Cの3案を比較
        </span>
        <span>
          <b>03</b>選んでPNGで書き出し
        </span>
      </div>
      <div id="banner-live-demo" className="doya-atelier-operation">
        <div className="doya-atelier-operation-copy">
          <span className="doya-eyebrow">FROM IDEA TO BANNER</span>
          <h2>
            つくる時間まで、
            <br />
            軽やかに。
          </h2>
          <p>
            テンプレートを選んで、AIが3案を提案。
            <br />
            気に入ったバナーを書き出すまでの流れを、
            <br className="doya-atelier-desktop" />
            操作イメージでご覧ください。
          </p>
          <a href="#doya-how">
            3ステップで使い方を知る
            <ArrowRight size={16} />
          </a>
        </div>
        <div className="doya-atelier-demo">
          <ServiceMotion id="banner" name="ドヤバナーAI" />
        </div>
      </div>
    </section>
  );
}
