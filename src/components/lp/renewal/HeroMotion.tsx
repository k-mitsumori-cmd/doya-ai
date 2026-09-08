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
import { ArrowUpRight, Check, Play, Sparkles } from "lucide-react";

export const MotionContext = createContext(false);
const PERIOD = 4200;

/** Stop work when the scene is offscreen, the tab is hidden, or motion is disabled. */
function useScene(length: number) {
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
  const running = visible && !paused && !reduced && !hidden && !manual;
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
  const scene = useScene(featured.length);
  const current = featured[scene.active];
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
        <div className="doya-output-frames">
          {featured.map((item, index) => (
            <div
              key={item.id}
              className={`doya-output-frame ${scene.active === index ? "is-active" : ""}`}
              aria-hidden={scene.active !== index}
            >
              <Image
                src={`/${item.id}/shots/3-output.webp`}
                alt={`${item.name}の出力イメージ`}
                width={1280}
                height={800}
                unoptimized
                priority={index === 0}
              />
            </div>
          ))}
        </div>
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
            aria-pressed={scene.active === i}
            onClick={() => scene.choose(i)}
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

const stages: Record<string, [string, string, string]> = {
  banner: ["訴求を入力", "バナー案を作成", "デザインを確認"],
  seo: ["テーマを入力", "構成・本文を作成", "記事を確認"],
  interview: ["音声をアップロード", "内容を記事に整理", "原稿を確認"],
  persona: ["URLを入力", "顧客像を整理", "訴求を確認"],
  hr: ["募集条件を入力", "求人文を作成", "表現を確認"],
  kintai: ["勤怠を記録", "勤務状況を整理", "集計を確認"],
  doyalist: ["条件を指定", "企業情報を整理", "リストを確認"],
  promane: ["目標を入力", "タスクを整理", "進め方を確認"],
  doyaslide: ["内容を入力", "スライドを作成", "資料を確認"],
  cunning: ["資料を登録", "会話から質問を検出", "根拠を確認"],
  sfa: ["案件を登録", "営業情報を整理", "進捗を確認"],
  shodan: ["企業を指定", "商談情報を整理", "提案の切り口を確認"],
  aio: ["サイトを指定", "AI検索の状況を分析", "改善案を確認"],
  mensetsu: ["面接を設定", "対話を進める", "記録を確認"],
  quote: ["要件を入力", "見積もりを作成", "金額・範囲を確認"],
  aishodan: ["商談を設定", "AIと対話", "内容を確認"],
  adimage: ["商品情報を入力", "広告画像を作成", "仕上がりを確認"],
};

export function ServiceMotion({ id }: { id: string }) {
  const scene = useScene(3);
  const labels = stages[id] || ["条件を入力", "AIと進める", "内容を確認"];
  return (
    <div
      ref={scene.ref}
      className={`doya-service-motion ${scene.running ? "is-running" : "is-resting"}`}
      data-scene={id}
      data-frame={scene.active}
    >
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
          <Sparkles size={13} /> 操作の流れをアニメーションで紹介
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
  );
}
