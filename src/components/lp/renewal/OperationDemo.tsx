"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import { MousePointer2 } from "lucide-react";
import "./operation-demo.css";

type DemoModule = Record<string, ComponentType>;
type Recipe = {
  load: () => Promise<unknown>;
  screens: [string, string, string];
  labels: [string, string, string];
  typing?: string;
};
export const DEMOS: Record<string, Recipe> = {
  banner: {
    load: () => import("@/app/banner/landing/mocks"),
    screens: ["BannerTemplatesMock", "BannerVariantsMock", "BannerSizesMock"],
    labels: ["業種を選ぶ", "バナー案を見る", "サイズを選んで出力"],
  },
  seo: {
    load: () => import("@/app/seo/mocks"),
    screens: ["SeoBriefMock", "SeoOutlineMock", "SeoAuditMock"],
    labels: ["記事の条件を入力", "構成を確認", "公開前にチェック"],
    typing: "BtoB マーケティング AI活用",
  },
  interview: {
    load: () => import("@/app/interview/mocks"),
    screens: [
      "InterviewUploadMock",
      "InterviewTranscriptMock",
      "InterviewArticleMock",
    ],
    labels: ["音声をアップロード", "文字起こしを確認", "記事を確認"],
  },
  persona: {
    load: () => import("@/app/persona/mocks"),
    screens: ["PersonaBriefMock", "PersonaProfileMock", "PersonaPlanMock"],
    labels: ["商材の条件を入力", "顧客像を確認", "施策の要点を見る"],
  },
  hr: {
    load: () => import("@/app/hr/mocks"),
    screens: ["HrEmployeesMock", "HrOrgChartMock", "HrEvalMock"],
    labels: ["従業員を選ぶ", "組織図を見る", "人事評価を確認"],
  },
  kintai: {
    load: () => import("@/app/kintai/mocks"),
    screens: ["KintaiClockMock", "KintaiSummaryMock", "KintaiRequestsMock"],
    labels: ["出勤を打刻", "勤怠を集計", "申請を確認"],
  },
  doyalist: {
    load: () => import("@/app/doyalist/mocks"),
    screens: ["DoyalistFilterMock", "DoyalistTableMock", "DoyalistMessageMock"],
    labels: ["検索条件を指定", "企業リストを見る", "営業文面を確認"],
  },
  promane: {
    load: () => import("@/app/promane/mocks"),
    screens: ["PromaneProjectMock", "PromaneBoardMock", "PromaneProfitMock"],
    labels: ["案件を入力", "タスクを整理", "収支を確認"],
    typing: "新サービスサイト制作",
  },
  doyaslide: {
    load: () => import("@/app/doyaslide/mocks"),
    screens: [
      "DoyaSlideBriefMock",
      "DoyaSlideStructureMock",
      "DoyaSlideDeckMock",
    ],
    labels: ["テーマを入力", "構成を確認", "スライドを見る"],
    typing: "新規事業の社内提案資料",
  },
  cunning: {
    load: () => import("@/app/cunning/mocks"),
    screens: ["CunningKnowledgeMock", "CunningLiveMock", "CunningAnswerMock"],
    labels: ["資料を登録", "会話から質問を検出", "回答と根拠を確認"],
  },
  sfa: {
    load: () => import("@/app/sfa/mocks"),
    screens: ["SfaPipelineMock", "SfaAccountsMock", "SfaDashboardMock"],
    labels: ["商談を選ぶ", "顧客情報を見る", "営業状況を確認"],
  },
  shodan: {
    load: () => import("@/app/shodan/mocks"),
    screens: [
      "ShodanResearchMock",
      "ShodanHypothesisMock",
      "ShodanProposalMock",
    ],
    labels: ["企業情報を見る", "課題仮説を確認", "提案資料を見る"],
  },
  aio: {
    load: () => import("@/app/aio/mocks"),
    screens: ["AioEnginesMock", "AioSovMock", "AioCitationsMock"],
    labels: ["AI別の状況を見る", "競合シェアを比較", "引用元を確認"],
  },
  mensetsu: {
    load: () => import("@/app/mensetsu/mocks"),
    screens: ["MensetsuLiveMock", "MensetsuScoreMock", "MensetsuGuardMock"],
    labels: ["面接を進める", "評価を確認", "質問の基準を見る"],
  },
  quote: {
    load: () => import("@/app/quote/mocks"),
    screens: ["QuoteLinesMock", "QuoteTaxMock", "QuotePdfMock"],
    labels: ["見積明細を確認", "税・値引きを確認", "PDFを書き出す"],
  },
  aishodan: {
    load: () => import("@/app/aishodan/mocks"),
    screens: ["AishodanTalkMock", "AishodanSlotsMock", "AishodanFitMock"],
    labels: ["AIと商談を進める", "ヒアリングを整理", "商談結果を確認"],
  },
  adimage: {
    load: () => import("@/app/adimage/mocks"),
    screens: ["AdImageGridMock", "AdImageVerifyMock", "AdImageRefineMock"],
    labels: ["媒体別の画像を見る", "文字をチェック", "改善点を確認"],
  },
};
const cache = new Map<string, Promise<DemoModule>>();
function loadDemo(id: string) {
  if (!cache.has(id))
    cache.set(
      id,
      DEMOS[id]
        .load()
        .then((m) => m as DemoModule)
        .catch((e) => {
          cache.delete(id);
          throw e;
        }),
    );
  return cache.get(id)!;
}

/** Code-rendered illustrations: no form submissions or product API calls. */
export function DemoScreen({
  id,
  active,
  running,
  expanded = false,
}: {
  id: string;
  active: number;
  running: boolean;
  expanded?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<{
    id: string;
    screenModule: DemoModule;
  } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [scale, setScale] = useState(1);
  const [target, setTarget] = useState({ x: 46, y: 52, w: 20, h: 12 });
  const recipe = DEMOS[id];
  const screenModule = loaded?.id === id ? loaded.screenModule : null;
  useEffect(() => {
    let cancelled = false;
    setError(false);
    loadDemo(id)
      .then((screenModule) => {
        if (!cancelled) setLoaded({ id, screenModule });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, retry]);
  useEffect(() => {
    const canvas =
      root.current?.querySelector<HTMLElement>(".doya-demo-canvas");
    if (!canvas) return;
    const resize = () => setScale(canvas.clientWidth / 560);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const frame = root.current?.querySelector<HTMLElement>(
      `.doya-demo-native[data-stage="${active}"]`,
    );
    if (!frame || !screenModule) return;
    root.current
      ?.querySelectorAll<HTMLElement>(".doya-demo-native")
      .forEach((native) => {
        const content = native.firstElementChild as HTMLElement | null;
        if (content)
          native.style.setProperty(
            "--content-fit",
            String(Math.min(1, 336 / content.scrollHeight)),
          );
      });
    const typed =
      active === 0 && recipe.typing
        ? [...frame.querySelectorAll<HTMLElement>("p,span")].find(
            (e) => e.textContent === recipe.typing,
          )
        : undefined;
    typed?.classList.add("doya-demo-typed");
    const element =
      typed ||
      frame.querySelector<HTMLElement>(
        "button, .grid > div, .rounded-lg, .rounded-xl",
      ) ||
      frame;
    const bounds = frame.getBoundingClientRect(),
      box = element.getBoundingClientRect();
    setTarget({
      x: Math.max(
        8,
        Math.min(
          90,
          ((box.left - bounds.left + box.width * 0.55) / bounds.width) * 100,
        ),
      ),
      y: Math.max(
        10,
        Math.min(
          85,
          ((box.top - bounds.top + box.height * 0.55) / bounds.height) * 100,
        ),
      ),
      w: Math.min(90, (box.width / bounds.width) * 100),
      h: Math.min(70, (box.height / bounds.height) * 100),
    });
    return () => typed?.classList.remove("doya-demo-typed");
  }, [active, screenModule, recipe, scale]);
  return (
    <div
      ref={root}
      className={`doya-operation-demo ${running ? "is-playing" : "is-held"} ${expanded ? "is-expanded" : ""}`}
      data-service={id}
      data-operation-step={active}
      data-demo-ready={!!screenModule}
    >
      <div className="doya-demo-chrome">
        <span />
        <span />
        <span />
        <b>{recipe.labels[active]}</b>
        <small>操作デモ</small>
      </div>
      <div
        className="doya-demo-canvas"
        role="img"
        aria-label={`${recipe.labels[active]}の操作イメージ`}
      >
        {screenModule ? (
          <div
            className="doya-demo-scale"
            style={{ "--demo-scale": scale } as CSSProperties}
            aria-hidden="true"
            inert={"" as unknown as boolean}
          >
            {recipe.screens.map((name, i) => {
              const Screen = screenModule[name];
              return (
                <div
                  key={name}
                  data-stage={i}
                  className={`doya-demo-native ${active === i ? "is-active" : ""}`}
                >
                  <Screen />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="doya-demo-loading">
            {error
              ? "操作デモを読み込めませんでした。"
              : "操作デモを準備しています…"}
          </div>
        )}
        {screenModule && !expanded && (
          <div
            key={`${id}-${active}`}
            className="doya-demo-gesture"
            aria-hidden="true"
            style={
              {
                "--target-x": `${target.x}%`,
                "--target-y": `${target.y}%`,
                "--target-w": `${target.w}%`,
                "--target-h": `${target.h}%`,
              } as CSSProperties
            }
          >
            <i className="doya-demo-focus" />
            <i className="doya-demo-click" />
            <MousePointer2
              className="doya-demo-pointer"
              size={28}
              fill="#fff"
              strokeWidth={1.7}
            />
          </div>
        )}
      </div>
      {error && (
        <button
          type="button"
          className="doya-demo-retry"
          onClick={() => setRetry((n) => n + 1)}
        >
          デモを再読み込み
        </button>
      )}
    </div>
  );
}
