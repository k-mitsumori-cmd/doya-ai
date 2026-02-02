'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Zap, Brain, Lightbulb, Rocket, Coffee } from 'lucide-react';

interface LoadingProgressProps {
  isLoading: boolean;
  estimatedSeconds?: number;
  /** 平均時間を学習するためのキー（例: banner-from-url / banner-generate / banner-refine） */
  operationKey?: string;
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

export default function LoadingProgress({ isLoading, estimatedSeconds = 15, operationKey }: LoadingProgressProps) {
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

  const CurrentTipIcon = loadingTips[tipIndex].icon;

  // 平均が無ければ、固定の目安（operationKeyごとのデフォルト）を使用
  const effectiveTotalSec = avgSec ?? baseEstimateSec;
  const remainingSec = clamp(effectiveTotalSec - elapsedSec, 0, 60 * 60);
  const showAvg = avgSec != null && avgSec > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl border border-white/10">
        {/* 円グラフ風プログレス */}
        <div className="relative w-40 h-40 mx-auto mb-6">
          {/* 背景の円 */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              className="text-slate-700"
            />
            {/* 進捗の円 */}
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="url(#progressGradient)"
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 70}`}
              strokeDashoffset={`${2 * Math.PI * 70 * (1 - progress / 100)}`}
              className="transition-all duration-500 ease-out"
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="60%" stopColor="#F97316" />
                <stop offset="100%" stopColor="#FBBF24" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* 中央のパーセント表示 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white">{Math.round(progress)}%</span>
            <span className="text-sm text-gray-400">進捗は目安です（品質優先で前後します）</span>
            <div className="mt-2 text-[11px] text-gray-300 font-bold text-center leading-relaxed">
              {showAvg ? (
                <>
                  平均: {formatSeconds(avgSec!)}（直近{sampleCount}回）
                  <span className="mx-2 text-gray-500">/</span>
                  経過: {formatSeconds(elapsedSec)}
                  <span className="mx-2 text-gray-500">/</span>
                  残り目安: {formatSeconds(remainingSec)}
                </>
              ) : (
                <>
                  目安: {formatSeconds(baseEstimateSec)}
                  <span className="mx-2 text-gray-500">/</span>
                  経過: {formatSeconds(elapsedSec)}
                  <span className="mx-2 text-gray-500">/</span>
                  残り目安: {formatSeconds(remainingSec)}
                </>
              )}
            </div>
          </div>
        </div>

        {/* 処理ステップ */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
            <span className="text-white font-medium">
              {processingSteps[currentStep]?.text || 'AIが生成中...'}
            </span>
          </div>
        </div>

        {/* プログレスバー（サブ） */}
        <div className="w-full h-2 bg-slate-700 rounded-full mb-6 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 via-orange-500 to-amber-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Tips表示 */}
        <div className="bg-slate-700/50 rounded-xl p-4 border border-white/5">
          <div className="flex items-center gap-3">
            <CurrentTipIcon className={`w-6 h-6 ${loadingTips[tipIndex].color} flex-shrink-0`} />
            <p className="text-gray-300 text-sm leading-relaxed">
              {loadingTips[tipIndex].text}
            </p>
          </div>
        </div>

        {/* アニメーションドット */}
        <div className="flex justify-center gap-1 mt-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}


