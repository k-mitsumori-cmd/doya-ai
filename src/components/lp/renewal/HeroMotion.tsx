"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Image from "next/image";
import { DemoScreen, DEMOS } from "./OperationDemo";
import { ProductPreview } from "./ProductPreview";
import { ArrowUpRight, Check, Play, Sparkles } from "lucide-react";

export const MotionContext = createContext(false);
const PERIOD = 4200;

/** Stop work when the scene is offscreen, the tab is hidden, or motion is disabled. */
function useScene(length: number, suspended = false) {
  const paused = useContext(MotionContext);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [manual, setManual] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    const visibility = () => setHidden(document.hidden);
    update();
    visibility();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    if (ref.current)
      observer.observe(ref.current.closest(".doya-hero-stage") || ref.current);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
      observer.disconnect();
    };
  }, []);
  const running =
    visible && !paused && !reduced && !hidden && !manual && !suspended;
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(
      () => setActive((n) => (n + 1) % length),
      PERIOD,
    );
    return () => clearTimeout(timer);
  }, [running, active, length]);
  const choose = (index: number) => {
    setActive(index);
    setManual(true);
  };
  const replay = () => {
    setActive(0);
    setManual(false);
  };
  return { ref, active, running, choose, replay, manual };
}

const featured = [
  {
    id: "banner",
    name: "ドヤバナーAI",
    task: "伝わるバナーを、形に。",
    category: "CREATE",
    color: "#0066ff",
  },
  {
    id: "shodan",
    name: "ドヤ商談準備",
    task: "次の商談に、準備を。",
    category: "SALES",
    color: "#7c3aed",
  },
  {
    id: "doyaslide",
    name: "ドヤスライド",
    task: "アイデアを、提案資料に。",
    category: "PRESENT",
    color: "#087b69",
  },
];

export function HomeMotionScene() {
  const scene = useScene(featured.length * 3);
  const serviceIndex = Math.floor(scene.active / 3);
  const current = featured[serviceIndex];
  return (
    <div
      ref={scene.ref}
      className={`doya-motion-scene ${scene.running ? "is-running" : "is-resting"}`}
      data-scene="home"
      data-frame={scene.active}
    >
      <div className="doya-orbit-field" aria-hidden="true">
        <div className="doya-orbit doya-orbit-one" />
        <div className="doya-orbit doya-orbit-two" />
        <div className="doya-orbit doya-orbit-three" />
        {Array.from({ length: 8 }, (_, i) => (
          <i
            key={i}
            className="doya-spark"
            style={{ "--i": i } as CSSProperties}
          />
        ))}
      </div>
      <div className="doya-scene-heading">
        <span /> YOUR AI TEAM <span className="doya-scene-count">17 TOOLS</span>
      </div>
      <div className="doya-flying-tool doya-flying-tool-one" aria-hidden="true">
        <Image
          src="/renewal/icons/seo.webp"
          alt=""
          width={52}
          height={52}
          unoptimized
        />
        <span>記事づくり</span>
      </div>
      <div className="doya-flying-tool doya-flying-tool-two" aria-hidden="true">
        <Image
          src="/renewal/icons/persona.webp"
          alt=""
          width={52}
          height={52}
          unoptimized
        />
        <span>顧客理解</span>
      </div>
      <div
        className="doya-flying-tool doya-flying-tool-three"
        aria-hidden="true"
      >
        <Image
          src="/renewal/icons/sfa.webp"
          alt=""
          width={52}
          height={52}
          unoptimized
        />
        <span>営業管理</span>
      </div>
      <div
        className="doya-scene-output"
        style={{ "--scene-color": current.color } as CSSProperties}
      >
        <div className="doya-output-label">
          <Sparkles size={14} /> {current.category}
          <span>操作イメージ</span>
        </div>
        <div className="doya-output-title">
          <span>{current.task}</span>
          <Check size={16} />
        </div>
        <DemoScreen
          id={current.id}
          active={scene.active % 3}
          running={scene.running}
        />
      </div>
      <div className="doya-team-arrival">
        <Image
          className="doya-scene-bears"
          src="/renewal/bear-teamwork.webp"
          alt="制作・営業・チームの仕事を手伝うドヤくんたち"
          width={660}
          height={440}
          unoptimized
          priority
        />
      </div>
      <div className="doya-scene-message">
        <Sparkles size={16} /> 得意なAIと、仕事が動き出す。
      </div>
      <div className="doya-scene-selector" aria-label="サービス紹介デモ">
        {featured.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={serviceIndex === i}
            onClick={() => scene.choose(i * 3)}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            {item.name}
          </button>
        ))}
        {scene.manual && (
          <button
            type="button"
            className="doya-scene-replay"
            aria-label="サービス紹介デモを自動再生"
            onClick={scene.replay}
          >
            <Play size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

export function ServiceMotion({ id, name }: { id: string; name: string }) {
  const [expanded, setExpanded] = useState(false);
  const scene = useScene(3, expanded);
  const labels = DEMOS[id].labels;
  return (
    <div
      ref={scene.ref}
      className={`doya-service-presentation ${scene.running ? "is-running" : "is-resting"}`}
      data-scene={id}
      data-frame={scene.active}
    >
      <ProductPreview
        className="doya-product-display"
        alt={`${name}：${labels[scene.active]}`}
        onOpenChange={setExpanded}
        expandedContent={
          <DemoScreen id={id} active={scene.active} running={false} expanded />
        }
      >
        <DemoScreen id={id} active={scene.active} running={scene.running} />
      </ProductPreview>
      <div className="doya-service-motion">
        <div className="doya-motion-steps" aria-label="操作の流れのデモ">
          {labels.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => scene.choose(i)}
              aria-pressed={scene.active === i}
            >
              <span className="doya-motion-step-number">
                {scene.active > i ? <Check size={12} /> : `0${i + 1}`}
              </span>
              <span>{label}</span>
              {scene.active === i && (
                <i key={scene.active} className="doya-step-timer" />
              )}
            </button>
          ))}
        </div>
        <div className="doya-motion-note">
          <span>
            <Sparkles size={13} /> カーソルと画面で使い方を紹介
          </span>
          {scene.manual ? (
            <button type="button" onClick={scene.replay}>
              <Play size={12} /> 再生
            </button>
          ) : (
            <a href="#doya-how">
              詳しい使い方 <ArrowUpRight size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
