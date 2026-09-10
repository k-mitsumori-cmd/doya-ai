"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import "./opening-curtain.css";

// Read from right to left. Keep each column short enough for a phone in landscape.
export const OPENING_COPY: Record<string, readonly [string, string]> = {
  banner: ["そのひらめきに、", "目を奪う表現を。"],
  seo: ["伝えたい想いを、", "届く記事へ。"],
  interview: ["語られた言葉に、", "物語の輪郭を。"],
  persona: ["届けたい人を、", "もっと深く。"],
  hr: ["人の可能性を、", "組織の力へ。"],
  kintai: ["日々の時間を、", "働くゆとりへ。"],
  doyalist: ["次の出会いを、", "事業の一歩に。"],
  promane: ["チームの想いを、", "進む力へ。"],
  doyaslide: ["その考えに、", "伝わるかたちを。"],
  cunning: ["大切な対話に、", "知識の支えを。"],
  sfa: ["ひとつの商談を、", "次の可能性へ。"],
  shodan: ["会う前の準備が、", "対話を変える。"],
  aio: ["新しい検索に、", "見つかる一歩を。"],
  mensetsu: ["ひとりの言葉に、", "向き合う採用を。"],
  quote: ["仕事の価値を、", "伝わる見積へ。"],
  aishodan: ["いつもの対話を、", "商談の一歩へ。"],
  adimage: ["届けたい価値に、", "目を引く一枚を。"],
};

type Phase = "waiting" | "writing" | "opening" | "done";

export function OpeningCurtain({
  serviceId,
  serviceName,
  paused,
  onCoverChange,
  contentRef,
}: {
  serviceId: string;
  serviceName: string;
  paused: boolean;
  onCoverChange: (covered: boolean) => void;
  contentRef: React.RefObject<HTMLDivElement>;
}) {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [run, setRun] = useState(0);
  const [reduced, setReduced] = useState(false);
  const skipRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const cancelled = useRef(false);
  const finish = useCallback(() => {
    cancelled.current = true;
    if (!returnFocus.current && document.activeElement === skipRef.current) {
      returnFocus.current =
        contentRef.current?.querySelector<HTMLElement>("main") ?? null;
    }
    setPhase("done");
    onCoverChange(false);
  }, [onCoverChange, contentRef]);

  useEffect(() => {
    cancelled.current = false;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const preference = () => {
      setReduced(media.matches);
      if (media.matches) finish();
    };
    preference();
    media.addEventListener("change", preference);
    if (
      media.matches ||
      (run === 0 && (window.scrollY > 80 || window.location.hash))
    ) {
      finish();
    } else {
      setPhase("waiting");
      onCoverChange(true);
      // The subset is tiny; never hold the page hostage to a font/network failure.
      const timeout = new Promise<void>((resolve) =>
        timers.push(setTimeout(resolve, 350)),
      );
      void Promise.race([
        document.fonts.load('48px "Doya Opening Brush"').catch(() => []),
        timeout,
      ]).then(() => {
        if (!alive || cancelled.current) return;
        setPhase("writing");
        timers.push(
          setTimeout(() => {
            if (cancelled.current) return;
            setPhase("opening");
            onCoverChange(false);
          }, 2200),
        );
        timers.push(setTimeout(finish, 3150));
      });
    }
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      media.removeEventListener("change", preference);
    };
  }, [run, serviceId, finish, onCoverChange]);

  useEffect(() => {
    if (paused) finish();
  }, [paused, finish]);

  const blocking = phase !== "done";
  useEffect(() => {
    if (!blocking) return;
    const content = contentRef.current;
    const skipButton = skipRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousInert = content?.inert ?? false;
    if (content) content.inert = true;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "Tab") {
        event.preventDefault();
        skipRef.current?.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      const focusedSkip = document.activeElement === skipButton;
      if (content) content.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keydown);
      if (returnFocus.current?.isConnected)
        returnFocus.current.focus({ preventScroll: true });
      else if (focusedSkip)
        content
          ?.querySelector<HTMLElement>("main")
          ?.focus({ preventScroll: true });
      returnFocus.current = null;
    };
  }, [blocking, contentRef, finish]);

  return (
    <>
      <noscript>
        <style>{`.doya-opening,.doya-opening-replay{display:none!important}.doya-intro-covered *,.doya-intro-covered *::before,.doya-intro-covered *::after{animation-play-state:running!important}`}</style>
      </noscript>
      {blocking && (
        <div
          className="doya-opening"
          data-phase={phase}
          data-service={serviceId}
          key={run}
        >
          <div
            className="doya-opening-panel doya-opening-left"
            aria-hidden="true"
          />
          <div
            className="doya-opening-panel doya-opening-right"
            aria-hidden="true"
          />
          <div className="doya-opening-composition" aria-hidden="true">
            <div className="doya-opening-brand">
              <span className="doya-opening-brand-line" />
              DOYA / {serviceId.toUpperCase()}
            </div>
            <div className="doya-opening-words">
              {OPENING_COPY[serviceId].map((line, i) => (
                <span
                  className="doya-opening-column"
                  key={line}
                  style={{ "--column": i } as React.CSSProperties}
                >
                  {line}
                </span>
              ))}
            </div>
            <div className="doya-opening-signature">
              <span>{serviceName}</span>
              <span>その仕事に、ひらめきを。</span>
            </div>
            <div className="doya-opening-progress">
              <i />
            </div>
          </div>
          <button
            ref={skipRef}
            type="button"
            className="doya-opening-skip"
            onClick={finish}
            aria-label="オープニングをスキップして本文へ"
          >
            スキップ <ArrowRight size={17} />
          </button>
        </div>
      )}
      <button
        className="doya-opening-replay"
        type="button"
        disabled={paused || reduced || blocking}
        onClick={(event) => {
          returnFocus.current = event.currentTarget;
          window.scrollTo({ top: 0, behavior: "instant" });
          setRun((value) => value + 1);
        }}
      >
        <RotateCcw size={13} />
        オープニング
      </button>
    </>
  );
}
