'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Zap, Brain, Lightbulb, Rocket, Coffee } from 'lucide-react';

interface LoadingProgressProps {
  isLoading: boolean;
  estimatedSeconds?: number;
}

// 待ち時間中に表示するTips
const loadingTips = [
  { icon: Lightbulb, text: 'Tip: 具体的な情報を入れるほど、質の高い出力が得られます！', color: 'text-yellow-400' },
  { icon: Zap, text: 'Tip: 生成結果は編集して、あなた流にアレンジしましょう！', color: 'text-blue-400' },
  { icon: Brain, text: 'Tip: 複数回生成して、一番良いものを選ぶのがコツ！', color: 'text-purple-400' },
  { icon: Rocket, text: 'Tip: コピーボタンで一発コピー、すぐに使えます！', color: 'text-pink-400' },
  { icon: Coffee, text: 'Tip: 生成中にコーヒーでも飲んでリラックス☕', color: 'text-orange-400' },
  { icon: Sparkles, text: 'DOYA-AIで仕事をもっとスマートに！', color: 'text-green-400' },
];

// 処理ステップ
const processingSteps = [
  { progress: 0, text: 'リクエストを受け付けました...' },
  { progress: 15, text: '入力内容を解析中...' },
  { progress: 30, text: 'AIが考え中...' },
  { progress: 50, text: 'コンテンツを生成中...' },
  { progress: 70, text: '文章を最適化中...' },
  { progress: 85, text: '最終チェック中...' },
  { progress: 95, text: 'まもなく完了...' },
];

export default function LoadingProgress({ isLoading, estimatedSeconds = 15 }: LoadingProgressProps) {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
      setCurrentStep(0);
      return;
    }

    // プログレスバーのアニメーション
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev;
        // 徐々に遅くなる進行
        const increment = Math.max(0.5, (95 - prev) / 20);
        return Math.min(95, prev + increment);
      });
    }, estimatedSeconds * 10); // 推定時間に応じて調整

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
      clearInterval(tipInterval);
      clearInterval(stepInterval);
    };
  }, [isLoading, estimatedSeconds, currentStep]);

  if (!isLoading) return null;

  const CurrentTipIcon = loadingTips[tipIndex].icon;
  const remainingSeconds = Math.max(1, Math.round(estimatedSeconds * (100 - progress) / 100));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
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
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="50%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* 中央のパーセント表示 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white">{Math.round(progress)}%</span>
            <span className="text-sm text-gray-400">残り約{remainingSeconds}秒</span>
          </div>
        </div>

        {/* 処理ステップ */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
            <span className="text-white font-medium">
              {processingSteps[currentStep]?.text || 'AIが生成中...'}
            </span>
          </div>
        </div>

        {/* プログレスバー（サブ） */}
        <div className="w-full h-2 bg-slate-700 rounded-full mb-6 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 rounded-full transition-all duration-500"
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
              className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}


