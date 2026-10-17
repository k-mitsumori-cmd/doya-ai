"use client";

// ツール画面の型（画像系）: 見本を選ぶ → 入力 → AIの処理を見せる → 案を比べて選ぶ → 書き出す
// 見本のため生成APIは呼ばない。処理はタイマーで再現する。
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  Check,
  Download,
  Link2,
  RotateCcw,
  Sparkles,
  Star,
} from "lucide-react";
import s from "./renewal.module.css";
import { Ring } from "./motion";
import {
  GALLERY,
  INDUSTRIES,
  PIPELINE,
  PURPOSES,
  RESULTS,
  SIZES,
} from "./data";
import { ToolHeader, Stepper } from "./ToolChrome";
import { BannerGallery } from "./BannerGallery";

type Phase = "gallery" | "input" | "running" | "pick" | "export";

const STEP_OF: Record<Phase, number> = {
  gallery: 0,
  input: 1,
  running: 2,
  pick: 3,
  export: 3,
};
const STEPS = [
  "見本を選ぶ",
  "情報を入れる",
  "AIが考える",
  "案を選んで書き出す",
];

export function BannerTool() {
  const [phase, setPhase] = useState<Phase>("gallery");
  const [refs, setRefs] = useState<string[]>([]);
  const [url, setUrl] = useState("https://example.com/cafe-summer");
  const [industry, setIndustry] = useState("飲食");
  const [purpose, setPurpose] = useState("SNS広告");
  const [sizes, setSizes] = useState<string[]>(["1080x1080", "1200x628"]);
  const [count, setCount] = useState(4);
  const [picked, setPicked] = useState(0);

  return (
    <div className={s.tool}>
      <ToolHeader
        serviceId="banner"
        stageLabel="集める"
        note="見本の画面です。生成は行いません"
      />
      <Stepper steps={STEPS} current={STEP_OF[phase]} />

      {phase === "gallery" ? (
        <BannerGallery
          selected={refs}
          onChange={setRefs}
          onNext={() => setPhase("input")}
        />
      ) : (
        <div className={s.toolBody}>
          <form
            className={`${s.toolInput} ${phase !== "input" ? s.toolInputDim : ""}`}
            onSubmit={(e) => {
              e.preventDefault();
              setPhase("running");
            }}
          >
            <div className={s.refRow}>
              <p className={s.fieldLabel}>
                参考にする見本<small>この雰囲気に寄せます</small>
              </p>
              <div className={s.refThumbs}>
                {refs.map((id, i) => {
                  const g = GALLERY.find((x) => x.id === id);
                  return g ? (
                    <span key={id} style={{ "--i": i } as CSSProperties}>
                      <img src={g.src} alt={g.title} />
                      <i>{i + 1}</i>
                    </span>
                  ) : null;
                })}
                <button
                  type="button"
                  className={s.refChange}
                  onClick={() => setPhase("gallery")}
                  data-cursor="選び直す"
                >
                  変更
                </button>
              </div>
            </div>
            <Field
              label="宣伝したいページのURL"
              hint="ページから商品名・色・雰囲気を読み取ります"
            >
              <span className={s.urlBox}>
                <Link2 size={16} strokeWidth={1.75} />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  aria-label="URL"
                />
              </span>
            </Field>
            <Field label="業種">
              <Chips
                items={INDUSTRIES}
                value={industry}
                onChange={setIndustry}
              />
            </Field>
            <Field label="使う場所">
              <Chips items={PURPOSES} value={purpose} onChange={setPurpose} />
            </Field>
            <Field label="サイズ" hint="複数選べます">
              <div className={s.sizeRow}>
                {SIZES.map((sz) => {
                  const on = sizes.includes(sz.id);
                  const scale = 30 / Math.max(sz.w, sz.h);
                  return (
                    <button
                      key={sz.id}
                      type="button"
                      className={`${s.sizeChip} ${on ? s.chipOn : ""}`}
                      aria-pressed={on}
                      onClick={() =>
                        setSizes(
                          on
                            ? sizes.filter((x) => x !== sz.id)
                            : [...sizes, sz.id],
                        )
                      }
                    >
                      <span
                        className={s.sizeShape}
                        style={{ width: sz.w * scale, height: sz.h * scale }}
                      />
                      <span>
                        {sz.label}
                        <small>{sz.id}</small>
                      </span>
                      {on && (
                        <Check
                          size={14}
                          strokeWidth={2.5}
                          className={s.sizeCheck}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="案の数">
              <div className={s.segment}>
                {[2, 4, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={count === n}
                    onClick={() => setCount(n)}
                  >
                    {n}案
                  </button>
                ))}
              </div>
            </Field>
            <div className={s.costLine}>
              <span>今回つかう回数</span>
              <b>{count}回</b>
              <span className={s.costRest}>残り 37 → {37 - count}回</span>
            </div>
            <button
              type="submit"
              className={s.btnPrimary}
              data-magnetic
              disabled={phase === "running"}
            >
              <span>{count}案つくる</span>
              <span className={s.arw}>
                <Sparkles size={15} strokeWidth={2} />
              </span>
            </button>
          </form>

          <section className={s.toolCanvas} aria-live="polite">
            {phase === "input" && <IdleCanvas />}
            {phase === "running" && (
              <Pipeline onDone={() => setPhase("pick")} />
            )}
            {(phase === "pick" || phase === "export") && (
              <Results
                picked={picked}
                onPick={setPicked}
                onExport={() => setPhase("export")}
                onRetry={() => setPhase("running")}
              />
            )}
            {phase === "export" && (
              <ExportSheet
                sizes={sizes}
                onClose={() => setPhase("pick")}
                onRestart={() => setPhase("gallery")}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={s.field}>
      <p className={s.fieldLabel}>
        {label}
        {hint && <small>{hint}</small>}
      </p>
      {children}
    </div>
  );
}

function Chips({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={s.chips}>
      {items.map((it) => (
        <button
          key={it}
          type="button"
          className={`${s.chip} ${value === it ? s.chipOn : ""}`}
          aria-pressed={value === it}
          onClick={() => onChange(it)}
        >
          {it}
        </button>
      ))}
    </div>
  );
}

function IdleCanvas() {
  return (
    <div className={s.idle}>
      <img
        src="/ui-renewal/work-idle.webp"
        alt=""
        className={s.idleImg}
        onError={(e) => {
          e.currentTarget.src = "/character/thinking-512.webp";
        }}
      />
      <p className={s.idleTitle}>左の内容で、ここに案が並びます</p>
      <ol className={s.idleSteps}>
        {PIPELINE.map((p, i) => (
          <li key={p.id} style={{ "--i": i } as CSSProperties}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            {p.label}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---- 処理中：4工程のノードが順に点き、線が伸び、ログが流れる ----
function Pipeline({ onDone }: { onDone: () => void }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [pct, setPct] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const allLogs = PIPELINE.flatMap((p, i) => p.log.map((l) => ({ l, i })));
    const total = 5200;
    const t0 = performance.now();
    let raf = 0;
    let shown = 0;
    const tick = (now: number) => {
      // rAF の時刻は t0 より前になることがあるので 0 で止める
      const t = Math.min(1, Math.max(0, (now - t0) / total));
      setPct(Math.round(t * 100));
      setStepIdx(
        Math.min(PIPELINE.length - 1, Math.floor(t * PIPELINE.length)),
      );
      const should = Math.floor(t * allLogs.length);
      if (should > shown) {
        shown = should;
        setLogs(allLogs.slice(0, shown).map((x) => x.l));
      }
      if (t < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => doneRef.current(), 450);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={s.pipe}>
      <div className={s.pipeTop}>
        <img
          src="/character/working-256.webp"
          alt=""
          width={96}
          height={96}
          className={s.pipeMascot}
        />
        <div>
          <p className={s.pipeNow}>{PIPELINE[stepIdx].label}…</p>
          <p className={s.pipePct}>
            <b className={s.num}>{pct}</b>%
          </p>
        </div>
      </div>
      <ol className={s.pipeNodes} style={{ "--p": pct / 100 } as CSSProperties}>
        <span className={s.pipeRail} aria-hidden="true">
          <span />
        </span>
        {PIPELINE.map((p, i) => (
          <li
            key={p.id}
            data-state={i < stepIdx ? "done" : i === stepIdx ? "now" : "wait"}
          >
            <span className={s.pipeNode}>
              {i < stepIdx ? (
                <Check size={16} strokeWidth={2.5} />
              ) : (
                String(i + 1).padStart(2, "0")
              )}
            </span>
            <span className={s.pipeLabel}>{p.label}</span>
          </li>
        ))}
      </ol>
      <ul className={s.pipeLog}>
        {logs.slice(-5).map((l, i, arr) => (
          <li key={`${l}-${logs.length - arr.length + i}`}>
            <Check size={13} strokeWidth={2.5} />
            {l}
          </li>
        ))}
        <li className={s.pipeCaret}>
          <span />
        </li>
      </ul>
      <div className={s.pipeSkeleton}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}

// ---- 結果：clip-pathで開く4案＋採点リング、選ぶと内訳が動く ----
function Results({
  picked,
  onPick,
  onExport,
  onRetry,
}: {
  picked: number;
  onPick: (i: number) => void;
  onExport: () => void;
  onRetry: () => void;
}) {
  const r = RESULTS[picked];
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className={`${s.results} ${shown ? s.on : ""}`}>
      <div className={s.resultsHead}>
        <div>
          <p className={s.resultsTitle}>4案できました</p>
          <p className={s.cardNote}>クリックされやすさの予測順に並べています</p>
        </div>
        <button type="button" className={s.btnGhost} onClick={onRetry}>
          <RotateCcw size={14} strokeWidth={2} /> 別の4案
        </button>
      </div>
      <div className={s.resultGrid}>
        {RESULTS.map((res, i) => (
          <button
            key={res.src}
            type="button"
            className={`${s.resultCard} ${picked === i ? s.resultOn : ""}`}
            data-spot
            style={{ "--i": i } as CSSProperties}
            onClick={() => onPick(i)}
            aria-pressed={picked === i}
          >
            <span className={s.resultImg}>
              <img src={res.src} alt={res.copy} />
            </span>
            {i === 0 && (
              <span className={s.bestTag}>
                <Star size={11} strokeWidth={2.5} /> おすすめ
              </span>
            )}
            <span className={s.resultMeta}>
              <Ring
                value={res.score}
                size={44}
                stroke={5}
                start={shown}
                color={i === 0 ? "#0066ff" : "#5b6b94"}
              >
                <b className={s.ringSmall}>{res.score}</b>
              </Ring>
              <span className={s.resultCopy}>{res.copy}</span>
            </span>
          </button>
        ))}
      </div>
      <div className={s.inspector}>
        <div className={s.inspectorHead}>
          <p>
            <small>案 {picked + 1} の採点</small>
            {r.copy}
          </p>
          <button
            type="button"
            className={s.btnPrimary}
            data-magnetic
            onClick={onExport}
          >
            <span>この案で書き出す</span>
            <span className={s.arw}>
              <ArrowRight size={15} strokeWidth={2} />
            </span>
          </button>
        </div>
        <ul className={s.scoreBars}>
          {r.breakdown.map((b, i) => (
            <li key={b.label}>
              <span>{b.label}</span>
              <span className={s.scoreTrack}>
                <span
                  style={{ "--w": b.value / 100, "--i": i } as CSSProperties}
                  key={`${picked}-${b.label}`}
                />
              </span>
              <b className={s.num}>{b.value}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ExportSheet({
  sizes,
  onClose,
  onRestart,
}: {
  sizes: string[];
  onClose: () => void;
  onRestart: () => void;
}) {
  return (
    <div className={s.sheetBackdrop} onClick={onClose}>
      <div
        className={s.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="書き出し"
      >
        <img
          src="/character/success-256.webp"
          alt=""
          width={84}
          height={84}
          className={s.sheetMascot}
        />
        <p className={s.sheetTitle}>書き出す準備ができました</p>
        <ul className={s.sheetList}>
          {sizes.map((id, i) => (
            <li key={id} style={{ "--i": i } as CSSProperties}>
              <Check size={14} strokeWidth={2.5} />
              <span>{SIZES.find((x) => x.id === id)?.label}</span>
              <small>{id}・PNG</small>
            </li>
          ))}
        </ul>
        <div className={s.sheetActions}>
          <button
            type="button"
            className={s.btnPrimary}
            data-magnetic
            disabled
            title="見本の画面のため無効です"
          >
            <span>まとめてダウンロード</span>
            <span className={s.arw}>
              <Download size={15} strokeWidth={2} />
            </span>
          </button>
          <button type="button" className={s.btnGhost} onClick={onRestart}>
            最初からつくる
          </button>
        </div>
      </div>
    </div>
  );
}
