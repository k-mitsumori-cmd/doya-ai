'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, Download, RotateCcw, Loader2, AlertCircle, CheckCircle,
  Sparkles, Share2, Copy, Heart, Eye, Zap, Trophy, Star, PartyPopper,
  ChevronDown, ExternalLink, Clock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, formatRelativeTime } from '@/lib/utils'

interface Asset {
  id: string
  variant: string
  url: string
}

interface JobData {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  size: string
  inputData: {
    keyword: string
    categorySlug: string
    purpose?: string
    tone?: string
  }
  assets: Asset[]
  templateName?: string
  errorMessage?: string
  createdAt: string
  completedAt?: string
}

// バリエーション情報
const VARIANT_INFO = {
  A: {
    label: 'パターンA',
    type: 'ベネフィット訴求',
    description: 'ユーザーが得られる価値を強調',
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
  },
  B: {
    label: 'パターンB',
    type: '限定・緊急性',
    description: '今すぐ行動を促す訴求',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
  },
  C: {
    label: 'パターンC',
    type: '社会的証明',
    description: '実績や評価で信頼性をアピール',
    color: 'from-emerald-500 to-green-500',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700',
  },
}

// 紙吹雪エフェクト
function Confetti() {
  const [pieces, setPieces] = useState<Array<{ id: number; left: number; color: string; delay: number }>>([])

  useEffect(() => {
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981']
    const newPieces = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 2,
    }))
    setPieces(newPieces)

    const timer = setTimeout(() => setPieces([]), 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
          }}
        />
      ))}
    </div>
  )
}

// ローディングステート
function LoadingState({ status }: { status: string }) {
  const [progress, setProgress] = useState(0)
  const [currentMessage, setCurrentMessage] = useState(0)

  const messages = [
    'AIがクリエイティブを分析中...',
    '最適なレイアウトを計算中...',
    'コピーを最適化中...',
    'カラーバランスを調整中...',
    'A/B/C 3案を生成中...',
    '仕上げ処理中...',
  ]

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.random() * 15, 90))
    }, 800)

    const messageInterval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % messages.length)
    }, 2500)

    return () => {
      clearInterval(progressInterval)
      clearInterval(messageInterval)
    }
  }, [])

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        {/* アニメーションアイコン */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/30 animate-pulse">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          {/* 回転するリング */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          バナーを生成中...
        </h2>
        <p className="text-gray-600 mb-6">
          AIがA/B/Cの3パターンを生成しています
        </p>

        {/* プログレスバー */}
        <div className="progress-bar mb-4">
          <div 
            className="progress-bar-fill transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 処理メッセージ */}
        <p className="text-sm text-blue-600 font-medium animate-fade-in">
          {messages[currentMessage]}
        </p>

        {/* 所要時間目安 */}
        <p className="text-xs text-gray-400 mt-4">
          通常30秒〜1分ほどかかります
        </p>
      </div>
    </div>
  )
}

export default function ResultPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.jobId as string
  
  const [job, setJob] = useState<JobData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // ジョブ状態をポーリング
  useEffect(() => {
    let intervalId: NodeJS.Timeout
    let hasShownConfetti = false

    const fetchJob = async () => {
      try {
        const response = await fetch(`/api/generate/${jobId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('ジョブが見つかりません')
          } else {
            setError('エラーが発生しました')
          }
          setIsLoading(false)
          return
        }
        
        const data: JobData = await response.json()
        setJob(data)
        setIsLoading(false)
        
        // 完了時の演出
        if (data.status === 'completed' && !hasShownConfetti) {
          hasShownConfetti = true
          clearInterval(intervalId)
          setShowConfetti(true)
          setSelectedVariant(data.assets[0]?.variant || 'A')
          toast.success('バナーが完成しました！🎉', {
            duration: 5000,
            icon: '✨',
          })
        }
        
        if (data.status === 'failed') {
          clearInterval(intervalId)
        }
      } catch (err) {
        console.error('Fetch job error:', err)
        setError('エラーが発生しました')
        setIsLoading(false)
      }
    }

    fetchJob()
    intervalId = setInterval(fetchJob, 3000)

    return () => clearInterval(intervalId)
  }, [jobId])

  const handleDownload = useCallback(async (asset: Asset) => {
    setDownloadingId(asset.id)
    try {
      const response = await fetch(asset.url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `doya-banner-${asset.variant}-${jobId.slice(0, 8)}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success(`パターン${asset.variant}をダウンロードしました`, {
        icon: '📥',
      })
    } catch (err) {
      toast.error('ダウンロードに失敗しました')
    } finally {
      setDownloadingId(null)
    }
  }, [jobId])

  const handleDownloadAll = useCallback(async () => {
    if (!job?.assets) return
    for (const asset of job.assets) {
      await handleDownload(asset)
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    toast.success('全パターンをダウンロードしました！', { icon: '🎉' })
  }, [job?.assets, handleDownload])

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('リンクをコピーしました', { icon: '📋' })
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{error}</h2>
          <p className="text-gray-600 mb-6">お手数ですが、もう一度お試しください。</p>
          <Link href="/app" className="btn-primary">
            <ArrowLeft className="w-4 h-4" />
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    )
  }

  if (!job) return null

  const isCompleted = job.status === 'completed'
  const isFailed = job.status === 'failed'
  const isProcessing = job.status === 'pending' || job.status === 'processing'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {showConfetti && <Confetti />}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <Link 
            href="/app" 
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            新しく生成する
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="btn-ghost text-sm"
            >
              <Share2 className="w-4 h-4" />
              共有
            </button>
            <Link href="/app/history" className="btn-ghost text-sm">
              <Clock className="w-4 h-4" />
              履歴
            </Link>
          </div>
        </div>

        {/* 処理中 */}
        {isProcessing && <LoadingState status={job.status} />}

        {/* 失敗時 */}
        {isFailed && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              生成に失敗しました
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {job.errorMessage || 'エラーが発生しました。もう一度お試しください。'}
            </p>
            <button 
              onClick={() => router.push('/app')} 
              className="btn-primary"
            >
              <RotateCcw className="w-5 h-5" />
              もう一度生成する
            </button>
          </div>
        )}

        {/* 成功時 */}
        {isCompleted && (
          <>
            {/* 成功ヘッダー */}
            <div className="card mb-8 bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <Trophy className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                      バナー生成完了！
                      <PartyPopper className="w-5 h-5" />
                    </h2>
                    <p className="text-emerald-700 text-sm">
                      「{job.inputData.keyword}」のバナーが完成しました
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadAll}
                  className="btn-success text-sm whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  全てダウンロード
                </button>
              </div>
            </div>

            {/* メタ情報 */}
            <div className="flex flex-wrap items-center gap-3 mb-6 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatRelativeTime(job.createdAt)}
              </span>
              <span className="w-1 h-1 bg-gray-300 rounded-full" />
              <span>サイズ: {job.size}</span>
              {job.inputData.purpose && (
                <>
                  <span className="w-1 h-1 bg-gray-300 rounded-full" />
                  <span>目的: {job.inputData.purpose}</span>
                </>
              )}
            </div>

            {/* バリエーションカード */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {job.assets.map((asset) => {
                const info = VARIANT_INFO[asset.variant as keyof typeof VARIANT_INFO]
                const isSelected = selectedVariant === asset.variant

                return (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedVariant(asset.variant)}
                    className={cn(
                      "card cursor-pointer transition-all duration-300",
                      isSelected 
                        ? `${info.borderColor} border-2 ring-4 ring-offset-2 shadow-xl scale-[1.02]` 
                        : "hover:shadow-lg hover:-translate-y-1"
                    )}
                    style={{
                      // @ts-ignore
                      '--tw-ring-color': isSelected ? info.borderColor.replace('border-', 'rgb(var(--color-') : 'transparent',
                    }}
                  >
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold",
                          `bg-gradient-to-br ${info.color}`
                        )}>
                          {asset.variant}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{info.label}</p>
                          <p className="text-xs text-gray-500">{info.type}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-6 h-6 text-blue-600" />
                      )}
                    </div>

                    {/* 画像プレビュー */}
                    <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-4 relative group">
                      <img
                        src={asset.url}
                        alt={`パターン ${asset.variant}`}
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                      {/* オーバーレイ */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    {/* 説明 */}
                    <p className={cn("text-sm mb-4 px-3 py-2 rounded-lg", info.bgColor, info.textColor)}>
                      {info.description}
                    </p>

                    {/* ダウンロードボタン */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(asset)
                      }}
                      disabled={downloadingId === asset.id}
                      className="w-full btn-secondary text-sm"
                    >
                      {downloadingId === asset.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      ダウンロード
                    </button>
                  </div>
                )
              })}
            </div>

            {/* アクション */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/app')}
                className="btn-primary"
              >
                <Sparkles className="w-5 h-5" />
                別のバナーを生成
              </button>
              <Link href="/app/history" className="btn-secondary">
                <Clock className="w-5 h-5" />
                履歴を見る
              </Link>
            </div>

            {/* Tips */}
            <div className="mt-12 p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-100">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-amber-900 mb-2">💡 バナー活用のコツ</h3>
                  <ul className="text-sm text-amber-800 space-y-1">
                    <li>• A/B/Cの3パターンを広告セットに入れて<strong>ABテスト</strong>しましょう</li>
                    <li>• パフォーマンスの良いパターンを分析し、次の生成に活かしましょう</li>
                    <li>• 同じキーワードで<strong>再生成</strong>すると、別のクリエイティブが生まれます</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
