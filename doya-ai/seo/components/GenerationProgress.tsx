'use client'

import { useEffect, useState } from 'react'
import { Sparkles, FileText, Layout, Layers, Wand2, CheckCircle, Clock, Zap, PenTool, Image } from 'lucide-react'

const STEPS = [
  { key: 'queued', label: '待機中', icon: Clock, description: 'ジョブを開始する準備をしています...' },
  { key: 'outline', label: 'アウトライン作成', icon: Layout, description: '記事の構成を設計しています...' },
  { key: 'sections', label: 'セクション執筆', icon: PenTool, description: '各セクションを順番に執筆しています...' },
  { key: 'integrate', label: '統合・調整', icon: Layers, description: '全体を統合して品質を調整しています...' },
  { key: 'media', label: '画像生成', icon: Image, description: 'バナーや図解を生成しています...' },
  { key: 'done', label: '完成', icon: CheckCircle, description: '記事の生成が完了しました！' },
]

const TIPS = [
  '💡 50,000字の記事は、通常5〜15分かかります',
  '📊 アウトラインは記事の骨格。ここで構造が決まります',
  '✍️ 各セクションは個別に生成され、整合性チェックを受けます',
  '🎯 LLMO最適化により、AI検索にも強い記事構造になります',
  '🔄 途中で止まった場合は「生成を開始」で再開できます',
  '📝 生成後は「編集」タブで自由に修正できます',
  '🎨 バナー画像と図解も自動生成されます',
  '✅ 品質監査で弱点を発見し、自動修正できます',
]

const MOTIVATIONAL = [
  '高品質な記事を生成中...',
  'SEO最適化された構造を構築中...',
  'LLMO対応の記事構造を設計中...',
  '読者を惹きつけるコンテンツを作成中...',
  '専門性の高い記事を執筆中...',
]

export function GenerationProgress({
  status,
  step,
  progress,
  sectionsDone = 0,
  sectionsTotal = 0,
}: {
  status: string
  step: string
  progress: number
  sectionsDone?: number
  sectionsTotal?: number
}) {
  const [tipIndex, setTipIndex] = useState(0)
  const [dots, setDots] = useState('')
  const [motivationalIndex, setMotivationalIndex] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // ドットアニメーション
  useEffect(() => {
    const t = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 500)
    return () => clearInterval(t)
  }, [])

  // ヒントのローテーション
  useEffect(() => {
    const t = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length)
    }, 5000)
    return () => clearInterval(t)
  }, [])

  // モチベーションメッセージのローテーション
  useEffect(() => {
    const t = setInterval(() => {
      setMotivationalIndex((i) => (i + 1) % MOTIVATIONAL.length)
    }, 3000)
    return () => clearInterval(t)
  }, [])

  // 経過時間カウンター
  useEffect(() => {
    if (status === 'done' || status === 'error') return
    const t = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(t)
  }, [status])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === step)
  const currentStep = STEPS.find((s) => s.key === step) || STEPS[0]
  const StepIcon = currentStep.icon

  if (status === 'done') {
    return (
      <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-emerald-800">記事の生成が完了しました！ 🎉</h3>
            <p className="text-emerald-600 mt-1">プレビュータブで内容を確認してください</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="p-6 rounded-2xl bg-gradient-to-br from-red-50 to-red-100/50 border border-red-200">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500 flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-red-800">生成中にエラーが発生しました</h3>
            <p className="text-red-600 mt-1">「生成を開始」ボタンで再試行してください</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* メインプログレス */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-50 via-white to-violet-50 border border-blue-200/50 shadow-lg">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-lg shadow-blue-500/30 animate-pulse">
                <StepIcon className="w-8 h-8 text-white" />
              </div>
              {/* パルスリング */}
              <div className="absolute inset-0 rounded-2xl bg-blue-400 animate-ping opacity-20" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">
                {currentStep.label}{dots}
              </h3>
              <p className="text-gray-500 mt-0.5">{currentStep.description}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">{progress}%</div>
            <div className="text-sm text-gray-400">経過時間: {formatTime(elapsedSeconds)}</div>
          </div>
        </div>

        {/* プログレスバー */}
        <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          >
            {/* シマーエフェクト */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
          {/* 輝きドット */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg transition-all duration-500"
            style={{ left: `calc(${Math.min(progress, 98)}% - 6px)` }}
          />
        </div>

        {/* セクション進捗（セクション執筆中のみ） */}
        {step === 'sections' && sectionsTotal > 0 && (
          <div className="mt-4 p-4 rounded-xl bg-white/60 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-600">セクション進捗</span>
              <span className="text-sm text-gray-500">{sectionsDone} / {sectionsTotal}</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: sectionsTotal }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                    i < sectionsDone
                      ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                      : i === sectionsDone
                      ? 'bg-blue-400 animate-pulse'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* ステップインジケーター */}
        <div className="mt-6 flex items-center justify-between">
          {STEPS.slice(0, -1).map((s, i) => {
            const isComplete = i < currentStepIndex
            const isCurrent = i === currentStepIndex
            const Icon = s.icon
            return (
              <div key={s.key} className="flex items-center">
                <div
                  className={`flex flex-col items-center transition-all duration-300 ${
                    isComplete ? 'opacity-100' : isCurrent ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      isComplete
                        ? 'bg-emerald-100 text-emerald-600'
                        : isCurrent
                        ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-300 ring-offset-2'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isComplete ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs mt-1.5 font-medium ${isCurrent ? 'text-blue-600' : 'text-gray-500'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 2 && (
                  <div
                    className={`w-8 h-0.5 mx-2 transition-all duration-300 ${
                      isComplete ? 'bg-emerald-300' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* モチベーションメッセージ */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-amber-800 font-medium animate-fadeIn">
            {MOTIVATIONAL[motivationalIndex]}
          </p>
        </div>
      </div>

      {/* ヒント */}
      <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-600 mb-1">ヒント</p>
            <p className="text-sm text-gray-500 transition-opacity duration-300">
              {TIPS[tipIndex]}
            </p>
          </div>
        </div>
      </div>

      {/* 注意事項 */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
          <div className="text-sm text-gray-500">
            <p className="font-medium text-gray-600 mb-1">⏱️ 生成には時間がかかります</p>
            <ul className="space-y-0.5 text-xs">
              <li>• 10,000字: 約1〜3分</li>
              <li>• 30,000字: 約3〜8分</li>
              <li>• 50,000字: 約5〜15分</li>
            </ul>
            <p className="mt-2 text-xs">このページを開いたまま自動で進行します。別タブで作業しても大丈夫です！</p>
          </div>
        </div>
      </div>
    </div>
  )
}


