'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Zap, Brain, Lightbulb, Rocket, Coffee } from 'lucide-react';
import { GenerationProgress } from '@/components/ds/feedback';

interface LoadingProgressProps {
  isLoading: boolean;
  estimatedSeconds?: number;
  /** 平均時間を学習するためのキー（例: banner-from-url / banner-generate / banner-refine） */
  operationKey?: string;
  /**
   * 画面に大きく出す見出し（例: 「サービスを解析しています」）。
   * ⚠️ 何をしているのか分からないまま待たせないための表示。
   *    省略時は従来どおり汎用のステップ文言だけを出す。
   */
  title?: string;
  /** 見出しの下に出す一文（何を作っているかの補足） */
  subtitle?: string;
  /** Tips を差し替える（サービス固有の使いこなしを出したいとき） */
  tips?: string[];
}

// 待ち時間中に表示するTips
const loadingTips = [
  { icon: Lightbulb, text: 'Tip: 具体的な情報を入れるほど、質の高い出力が得られます！', color: 'text-yellow-400' },
  { icon: Zap, text: 'Tip: 生成結果は編集して、あなた流にアレンジしましょう！', color: 'text-blue-400' },
  { icon: Brain, text: 'Tip: 複数回生成して、一番良いものを選ぶのがコツ！', color: 'text-purple-400' },
  { icon: Rocket, text: 'Tip: コピーボタンで一発コピー、すぐに使えます！', color: 'text-pink-400' },
  { icon: Coffee, text: 'Tip: 生成中にコーヒーでも飲んでリラックス☕', color: 'text-orange-400' },
  { icon: Sparkles, text: 'ドヤバナーAIで仕事をもっとスマートに！', color: 'text-green-400' },
];

// 処理ステップ
const processingSteps = [
  { progress: 0, text: 'リクエストを受け付けました...' },
  { progress: 15, text: '入力内容を解析中...' },
  { progress: 30, text: 'AIが考え中...' },
  { progress: 50, text: 'コンテンツを生成中...' },
  { progress: 70, text: '文章を最適化中...' },
  { progress: 82, text: '最終チェック中...' },
  { progress: 85, text: '仕上げ中...' },
];

const DEFAULT_ESTIMATES: Record<string, number> = {
  'banner-from-url': 75,
  'banner-generate': 55,
  'banner-refine': 40,
  'banner-chat': 18,
};

type TimingStats = { v: 1; samplesMs: number[] };

function statsStorageKey(operationKey?: string) {
  return `doya_loading_stats:${operationKey || 'default'}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function formatSeconds(sec: number) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}分${r.toString().padStart(2, '0')}秒`;
}

/** 新しい見た目で出す段階（API は段階を返さないので、時間の経過から目安で進め、最後の段で止まる） */
const NEXT_STAGES = ['内容を読み取っています', 'AIが作っています', '仕上げています'];

/**
 * 新しい見た目の生成中の表示（UX 点検 FIX-PLAN 13）。
 * 全面の暗幕を出さず、置いた場所（枠の中身の先頭）に、今の段階と残り時間の目安だけを出す。
 * ほかの操作（タブの移動・入力の確認）は止めない。
 */
function LoadingProgressNext({ title, subtitle, estimateSec }: { title?: string; subtitle?: string; estimateSec: number }) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ratio = (now - startedAt) / 1000 / Math.max(estimateSec, 1);
  const current = Math.min(NEXT_STAGES.length - 1, Math.floor(ratio * NEXT_STAGES.length));
  return (
    <div className="sticky top-[76px] z-30 my-3 md:top-4" aria-label={title || '作成中'}>
      {title ? (
        <div className="mb-2 px-1">
          <p className="text-sm font-bold text-slate-900">{title}</p>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
      ) : null}
      <GenerationProgress stages={NEXT_STAGES} current={current} startedAt={startedAt} estimateSec={estimateSec} />
    </div>
  );
}

export default function LoadingProgress({ isLoading, estimatedSeconds = 15, operationKey, title, subtitle, tips }: LoadingProgressProps) {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [avgSec, setAvgSec] = useState<number | null>(null);
  const [sampleCount, setSampleCount] = useState<number>(0);
  const startedAtRef = useRef<number | null>(null);

  const baseEstimateSec = useMemo(() => {
    const byKey = operationKey ? DEFAULT_ESTIMATES[operationKey] : undefined;
    return Number.isFinite(estimatedSeconds) ? estimatedSeconds : (byKey || 15);
  }, [estimatedSeconds, operationKey]);

  // 過去の平均を読み出し（操作キーごと）
  useEffect(() => {
    try {
      const key = statsStorageKey(operationKey);
      const parsed = safeParseJson<TimingStats>(localStorage.getItem(key));
      const samples = Array.isArray(parsed?.samplesMs) ? parsed!.samplesMs.filter((n) => Number.isFinite(n) && n > 500) : [];
      const last = samples.slice(-12);
      if (last.length > 0) {
        const avg = last.reduce((a, b) => a + b, 0) / last.length;
        setAvgSec(Math.round(avg / 1000));
        setSampleCount(last.length);
      } else {
        setAvgSec(null);
        setSampleCount(0);
      }
    } catch {
      setAvgSec(null);
      setSampleCount(0);
    }
  }, [operationKey]);

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
      setCurrentStep(0);
      // 計測を終了して保存
      const start = startedAtRef.current;
      if (start) {
        const durationMs = Date.now() - start;
        startedAtRef.current = null;
        try {
          const key = statsStorageKey(operationKey);
          const parsed = safeParseJson<TimingStats>(localStorage.getItem(key));
          const prev = Array.isArray(parsed?.samplesMs) ? parsed!.samplesMs : [];
          const merged = [...prev, durationMs].slice(-30);
          localStorage.setItem(key, JSON.stringify({ v: 1, samplesMs: merged } satisfies TimingStats));
          const last = merged.slice(-12);
          const avg = last.reduce((a, b) => a + b, 0) / Math.max(1, last.length);
          setAvgSec(Math.round(avg / 1000));
          setSampleCount(last.length);
        } catch {
          // ignore
        }
      }
      setElapsedSec(0);
      return;
    }

    // 計測開始
    startedAtRef.current = Date.now();
    setElapsedSec(0);

    // プログレスバーのアニメーション
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        // 進捗は“目安”。過度に早く進みすぎないように調整。
        if (prev >= 85) return prev;
        const base = Math.max(0.35, (85 - prev) / 30);
        const jitter = Math.random() * 0.9;
        return Math.min(85, prev + base + jitter);
      });
    }, 380);

    // 経過時間カウンタ
    const elapsedInterval = setInterval(() => {
      const start = startedAtRef.current;
      if (!start) return;
      const sec = Math.floor((Date.now() - start) / 1000);
      setElapsedSec(sec);
    }, 1000);

    // Tipのローテーション
    const tipInterval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % loadingTips.length);
    }, 3000);

    // ステップの更新
    const stepInterval = setInterval(() => {
      setProgress(prev => {
        const nextStep = processingSteps.findIndex(step => step.progress > prev);
        if (nextStep !== -1 && nextStep !== currentStep) {
          setCurrentStep(nextStep);
        }
        return prev;
      });
    }, 500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(elapsedInterval);
      clearInterval(tipInterval);
      clearInterval(stepInterval);
    };
  }, [isLoading, estimatedSeconds, currentStep, operationKey]);

  if (!isLoading) return null;

  // 新しい見た目では、全面の読み込みを出さない（決まり: 全面の読み込み・暗幕を出さない）
  return <LoadingProgressNext title={title} subtitle={subtitle} estimateSec={avgSec ?? baseEstimateSec} />;
}


