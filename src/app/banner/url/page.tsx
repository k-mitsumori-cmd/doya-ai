'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowRight, Link2, Loader2, LogIn, Download, Sparkles, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { Toaster, toast } from 'react-hot-toast'
import DashboardSidebar from '@/components/DashboardSidebar'
import LoadingProgress from '@/components/LoadingProgress'
import UpgradeSuccessModal from '@/components/UpgradeSuccessModal'
import BannerCancelScheduleNotice from '@/components/BannerCancelScheduleNotice'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'

const DEFAULT_FREE_SIZE = '1080x1080'
const SIZE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Instagram正方形（1080×1080）', value: '1080x1080' },
  { label: 'Facebook/OG（1200×628）', value: '1200x628' },
  { label: 'ストーリー（1080×1920）', value: '1080x1920' },
  { label: 'YouTubeサムネ（1280×720）', value: '1280x720' },
  { label: 'GDN横長（728×90）', value: '728x90' },
  { label: 'GDNレクタングル（300×250）', value: '300x250' },
  { label: 'GDNラージ（336×280）', value: '336x280' },
]

type ApiResponse = {
  banners?: string[]
  bannerAnalysis?: string
  analysisJson?: { key_message?: string; cta?: string; tone?: string }
  usedModelDisplay?: string
  warning?: string
  error?: string
}

async function safeReadJson(res: Response): Promise<{ ok: boolean; status: number; data: any; text: string }> {
  const status = res.status
  const text = await res.text().catch(() => '')
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  return { ok: res.ok, status, data, text }
}

function normalizeNonJsonApiError(status: number, text: string): string {
  const t = String(text || '').trim()
  if (status === 413 || /Request Entity Too Large/i.test(t) || /^Request En/i.test(t)) {
    return '送信データが大きすぎます（画像を小さめにして再試行してください）'
  }
  if (status === 502 || status === 503) return 'サーバが混雑しています。少し待って再試行してください。'
  if (t) return t.slice(0, 180)
  return '生成に失敗しました'
}

// Next.jsのprerender時に useSearchParams() を使う場合、Suspense境界が必要
export default function BannerUrlAutoPage() {
  return (
    <Suspense fallback={null}>
      <BannerUrlAutoPageInner />
    </Suspense>
  )
}

function BannerUrlAutoPageInner() {
  const { data: session, update: updateSession } = useSession()
  const isGuest = !session
  const bannerPlan = !isGuest
    ? String((session?.user as any)?.bannerPlan || (session?.user as any)?.plan || 'FREE').toUpperCase()
    : 'GUEST'
  const bannerPlanTier = (() => {
    const p = bannerPlan
    if (!p || p === 'GUEST') return 'GUEST' as const
    if (p.includes('ENTERPRISE')) return 'ENTERPRISE' as const
    if (p.includes('PRO') || p.includes('BASIC') || p.includes('STARTER') || p.includes('BUSINESS')) return 'PRO' as const
    if (p.includes('FREE')) return 'FREE' as const
    return 'FREE' as const
  })()
  const isPaidUser = bannerPlanTier === 'PRO' || bannerPlanTier === 'ENTERPRISE'

  const [targetUrl, setTargetUrl] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string>('')
  const [banners, setBanners] = useState<string[]>([])
  const [bannerAnalysis, setBannerAnalysis] = useState<string>('')
  const [analysisJson, setAnalysisJson] = useState<ApiResponse['analysisJson'] | undefined>(undefined)
  const [usedModelDisplay, setUsedModelDisplay] = useState<string>('')
  const [count, setCount] = useState<number>(3)
  const [size, setSize] = useState<string>(DEFAULT_FREE_SIZE)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradedPlan, setUpgradedPlan] = useState<'PRO' | 'ENTERPRISE'>('PRO')

  const searchParams = useSearchParams()
  const router = useRouter()

  // Stripe決済成功後のリダイレクトを検出してお祝いモーダルを表示
  useEffect(() => {
    const success = searchParams.get('success')
    const plan = searchParams.get('plan')
    const sessionId = searchParams.get('session_id')
    
    if (success === 'true') {
      // プラン名を判定
      const nextPlanTier = plan?.toLowerCase().includes('enterprise') ? 'ENTERPRISE' : 'PRO'
      if (nextPlanTier === 'ENTERPRISE') {
        setUpgradedPlan('ENTERPRISE')
      } else {
        setUpgradedPlan('PRO')
      }

      // まずStripe→DB同期を試みて、プラン反映を即時化する（Webhook遅延/不達の保険）
      ;(async () => {
        try {
          if (sessionId) {
            toast.loading('決済を確認中…（プラン反映中）', { id: 'stripe-sync' })
            const res = await fetch('/api/stripe/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.error || 'プラン反映に失敗しました')
            toast.success('プロプランが有効になりました！', { id: 'stripe-sync' })

            // ここで「プラン更新イベント」を発火（他画面/コンポーネントへ即通知）
            try {
              window.dispatchEvent(
                new CustomEvent('doya:plan-updated', {
                  detail: { serviceId: 'banner', planTier: nextPlanTier, source: 'stripe-sync', at: Date.now() },
                })
              )
            } catch {}
          }

          // NextAuthセッションを更新してUIへ即反映
          await updateSession?.()
        } catch (e: any) {
          toast.error(e?.message || 'プラン反映に失敗しました（少し待って再読み込みしてください）', { id: 'stripe-sync' })
        } finally {
          setShowUpgradeModal(true)
        }
      })()
      
      // URLからクエリパラメータを削除（履歴に残さない）
      const url = new URL(window.location.href)
      url.searchParams.delete('success')
      url.searchParams.delete('plan')
      url.searchParams.delete('session_id')
      router.replace(url.pathname, { scroll: false })
    }
  }, [searchParams, router, updateSession])

  const canGenerate = useMemo(() => targetUrl.trim().length > 8 && !isGenerating, [targetUrl, isGenerating])

  // 無料/有料別に枚数上限を制限（UI改ざん防止）
  useEffect(() => {
    const maxCount = isPaidUser ? 10 : 3
    if (count < 1) setCount(1)
    if (count > maxCount) setCount(maxCount)
    if (!isPaidUser && size !== DEFAULT_FREE_SIZE) setSize(DEFAULT_FREE_SIZE)
    if (!size) setSize(DEFAULT_FREE_SIZE)
  }, [isPaidUser, count, size])

  const handleGenerate = async () => {
    const url = targetUrl.trim()
    if (!url) {
      toast.error('サイトURLを入力してください')
      return
    }
    if (!canGenerate) return

    setError('')
    setIsGenerating(true)
    setBanners([])
    setBannerAnalysis('')
    setAnalysisJson(undefined)
    setUsedModelDisplay('')

    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 290_000)

      const res = await fetch('/api/banner/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          targetUrl: url,
          // 詳細設定（API側でも無料/有料の制限を厳密に適用する）
          count,
          size,
        }),
      })

      window.clearTimeout(timeout)

      const parsed = await safeReadJson(res)
      const data = (parsed.data || {}) as ApiResponse
      if (!parsed.ok) {
        const msg = data?.error || normalizeNonJsonApiError(parsed.status, parsed.text) || 'URLからの自動生成に失敗しました'
        throw new Error(msg)
      }

      setBanners(Array.isArray(data.banners) ? data.banners : [])
      setBannerAnalysis(String(data.bannerAnalysis || ''))
      setAnalysisJson((data.analysisJson as any) || null)
      setUsedModelDisplay(String(data.usedModelDisplay || ''))

      if (data.warning) {
        setError(String(data.warning))
        toast.error('一部のバナー生成に失敗しました', { icon: '⚠️', duration: 5000 })
      } else {
        toast.success('URLからバナーを生成しました！', { icon: '🎉' })
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setError('生成に時間がかかっています。タブは開いたまま、しばらく待つか再試行してください。')
        toast.error('タイムアウト：サーバが混雑している可能性があります', { duration: 6000 })
      } else {
        setError(e?.message || 'URLからの自動生成に失敗しました')
        toast.error('生成に失敗しました', { icon: '❌', duration: 5000 })
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadImage = (dataUrl: string, index: number) => {
    try {
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `doya-banner-url-${index + 1}-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch {
      toast.error('ダウンロードに失敗しました')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      <DashboardSidebar />
      <div className="pl-[72px] md:pl-[240px] transition-all duration-200">
        {/* 生成中に飽きさせない：他ページと同様の待機アニメ（Tips/進捗） */}
        <LoadingProgress isLoading={isGenerating} operationKey="banner-from-url" estimatedSeconds={75} />
        <Toaster position="top-center" />

        <div className="max-w-[1600px] mx-auto px-3 sm:px-8 py-6 sm:py-10">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider mb-3 sm:mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                URL Auto Banner
              </div>
              <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">URLだけでバナー自動生成</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-bold mt-2 leading-relaxed">
                URLを入力するだけ。サイト内容をAIが解析し、コピー/デザイン/配色/CTAを自動で判断して生成します。
              </p>
            </div>

            <Link
              href="/banner/dashboard"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-white border border-slate-200 text-slate-800 text-sm font-black hover:bg-slate-50 transition-colors whitespace-nowrap flex-shrink-0"
            >
              手動で作る
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* 縦レイアウト：上=URL入力 / 下=生成結果 */}
          <div className="mt-6 space-y-6">
            {/* URL入力 */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-900">サイトURL</p>
                {isGuest ? (
                  <Link
                    href={`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent('/banner')}`}
                    className="inline-flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-800"
                  >
                    <LogIn className="w-4 h-4" />
                    ログイン
                  </Link>
                ) : (
                  <span className="text-[10px] font-black text-slate-500 rounded-full bg-slate-100 px-3 py-1">ログイン済み</span>
                )}
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" data-tour="url-input">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-slate-400" />
                  <input
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://example.com/..."
                    className="w-full bg-transparent outline-none text-sm font-bold text-slate-800 placeholder-slate-300"
                  />
                </div>
              </div>

              {/* 詳細設定 */}
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden" data-tour="advanced-settings">
                {/* collapsed header */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                      <SlidersHorizontal className="w-4 h-4 text-slate-700" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-slate-900">詳細設定</p>
                      <p className="text-[11px] text-slate-500 font-bold">
                        作成枚数：<span className="text-slate-900">{count}枚{!isPaidUser && count > 3 ? '（無料上限3枚）' : ''}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-500 rounded-full bg-slate-100 px-3 py-1">
                      {isPaidUser ? '有料' : isGuest ? 'ゲスト' : '無料'}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {showAdvanced && (
                  <div className="px-4 pb-4">
                    <p className="text-[11px] text-slate-500 font-bold mt-1 leading-relaxed">
                      無料：<span className="text-slate-800">1〜3枚 / 1080×1080のみ</span>　
                      有料：<span className="text-slate-800">1〜10枚 / サイズ指定OK</span>
                    </p>

                    <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {/* 枚数 */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-black text-slate-700">生成枚数</p>
                          <p className="text-xs font-black text-slate-900 tabular-nums">{count}枚</p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                            const maxFree = 3
                            const disabled = !isPaidUser && n > maxFree
                            return (
                              <button
                                key={n}
                                type="button"
                                disabled={disabled}
                                onClick={() => setCount(n)}
                                className={`px-3 py-2 rounded-xl text-xs font-black border transition-colors ${
                                  disabled
                                    ? 'bg-white text-slate-300 border-slate-200 cursor-not-allowed'
                                    : count === n
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {n}
                              </button>
                            )
                          })}
                        </div>
                        {!isPaidUser && <p className="mt-2 text-[10px] text-slate-500 font-bold">※ 無料は3枚まで。有料プランで最大10枚。</p>}
                      </div>

                      {/* サイズ */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-black text-slate-700">サイズ</p>
                          <p className="text-[10px] font-black text-slate-500">{isPaidUser ? '指定OK' : '無料は固定'}</p>
                        </div>
                        <select
                          value={isPaidUser ? size : DEFAULT_FREE_SIZE}
                          onChange={(e) => setSize(e.target.value)}
                          disabled={!isPaidUser}
                          className="mt-2 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-800 disabled:opacity-60"
                        >
                          {SIZE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {!isPaidUser && <p className="mt-2 text-[10px] text-slate-500 font-bold">※ 有料プランでサイズ指定が可能です。</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                data-tour="generate-button"
                className="mt-4 w-full inline-flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-slate-900 text-white font-black hover:bg-black transition-colors disabled:opacity-60"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                URLだけでバナー生成
              </button>

              {usedModelDisplay && (
                <div className="mt-3 text-[11px] text-slate-500 font-bold">
                  使用モデル: <span className="text-slate-700">{usedModelDisplay}</span>
                </div>
              )}

              {(analysisJson?.key_message || bannerAnalysis) && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 space-y-2" data-tour="analysis-result">
                  <div className="text-[11px] font-black text-slate-500">サイト解析結果</div>
                  <div className="text-sm font-black text-slate-900 leading-relaxed">
                    {analysisJson?.key_message ? String(analysisJson.key_message) : bannerAnalysis.slice(0, 220)}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                    {analysisJson?.tone && <span className="px-2 py-0.5 bg-slate-100 rounded-full">{String(analysisJson.tone)}</span>}
                    {analysisJson?.cta && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">CTA: {String(analysisJson.cta)}</span>
                    )}
                  </div>
                </div>
              )}

              {error && <div className="mt-4 text-sm text-red-600 font-bold">{error}</div>}
            </div>

            {/* 生成結果 */}
            <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6" data-tour="generated-results">
              {banners.length === 0 ? (
                <div className="h-[300px] sm:h-[420px] flex items-center justify-center text-center text-slate-500 font-bold">
                  {isGenerating ? '生成中です…（少々お待ちください）' : '生成結果がここに表示されます'}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">GENERATION COMPLETE</p>
                        <p className="text-[11px] text-slate-500 font-bold">{banners.length}枚のバナーを生成しました</p>
                      </div>
                    </div>
                    {usedModelDisplay && (
                      <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full">
                        <Sparkles className="w-3 h-3" />
                        {usedModelDisplay}
                      </span>
                    )}
                  </div>

                  {/* 大きなプレビュー表示 */}
                  <div className={`grid gap-3 sm:gap-4 ${
                    banners.length === 1 ? 'grid-cols-1' :
                    banners.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                    banners.length <= 4 ? 'grid-cols-2' :
                    'grid-cols-2 sm:grid-cols-3'
                  }`}>
                    {banners
                      .filter((b) => typeof b === 'string' && b.startsWith('data:image/'))
                      .map((img, idx) => (
                        <div 
                          key={idx} 
                          className="group relative rounded-xl sm:rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 hover:border-blue-300 hover:shadow-lg transition-all"
                        >
                          <div className="aspect-square bg-white flex items-center justify-center p-2">
                            <img 
                              src={img} 
                              alt={`banner-${idx + 1}`} 
                              className="max-w-full max-h-full object-contain rounded-lg" 
                            />
                          </div>
                          {/* ホバー時のオーバーレイ */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 sm:p-4">
                            <div className="flex items-center justify-between">
                              <span className="text-white text-xs sm:text-sm font-black">No.{idx + 1}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  downloadImage(img, idx)
                                }}
                                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-white text-blue-600 text-xs font-black hover:bg-blue-50 transition-colors shadow-lg"
                              >
                                <Download className="w-4 h-4" />
                                ダウンロード
                              </button>
                            </div>
                          </div>
                          {/* 番号バッジ（常時表示） */}
                          <div className="absolute top-2 left-2 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/90 backdrop-blur-sm border border-slate-200 flex items-center justify-center text-xs font-black text-slate-700 shadow-sm">
                            {idx + 1}
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* ダウンロードヒント */}
                  <p className="text-center text-[11px] text-slate-400 font-bold">
                    画像にカーソルを合わせてダウンロード
                  </p>
                </div>
              )}
            </div>

            {/* 料金 / プラン表 */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6" data-tour="pricing-plans">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-900">料金プラン</p>
                  <p className="text-[11px] text-slate-500 font-bold mt-1">
                    無料は制限付き。有料は枚数/サイズ指定が可能です。
                  </p>
                </div>
                <Link
                  href="/banner/pricing"
                  className="text-xs font-black text-blue-600 hover:text-blue-800"
                >
                  料金ページへ
                </Link>
              </div>

              {/* 現在プラン表示 */}
              <p className="text-xs font-black text-slate-700 mt-2">
                現在のプラン：{bannerPlanTier === 'GUEST' ? 'ゲスト' : bannerPlanTier === 'FREE' ? '無料' : bannerPlanTier === 'PRO' ? 'PRO' : 'Enterprise'}
                {isPaidUser && (
                  <Link href="/banner/dashboard/plan" className="ml-2 text-blue-600 hover:underline">アカウント画面で変更/解約 →</Link>
                )}
              </p>

              {/* 解約予約中（次回更新日で停止）の場合は停止日時を表示 */}
              <div className="mt-3">
                <BannerCancelScheduleNotice />
              </div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Free */}
                <div className={`rounded-2xl border p-4 ${bannerPlanTier === 'FREE' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                  <p className="text-xs font-black text-slate-500">無料</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{BANNER_PRICING.plans.find((p) => p.id === 'banner-free')?.name || 'おためしプラン'}</p>
                  <p className="mt-2 text-sm font-black text-slate-900">¥0</p>
                  <p className="mt-2 text-[11px] text-slate-600 font-bold leading-relaxed">
                    ログインで1日{BANNER_PRICING.freeLimit}枚まで（ゲストは{BANNER_PRICING.guestLimit}枚まで）
                  </p>
                  <div className="mt-3">
                    {bannerPlanTier === 'FREE' ? (
                      <button disabled className="w-full px-4 py-3 rounded-2xl bg-slate-200 text-slate-600 font-black text-sm cursor-not-allowed">現在のプラン</button>
                    ) : isGuest ? (
                      <Link
                        href={`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent('/banner')}`}
                        className="inline-flex items-center justify-center w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-800 font-black hover:bg-slate-100 transition-colors text-sm"
                      >
                        ログインして試す
                      </Link>
                    ) : (
                      <Link
                        href="/banner/dashboard/plan"
                        className="inline-flex items-center justify-center w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-800 font-black hover:bg-slate-100 transition-colors text-sm"
                      >
                        ダウングレードはアカウント画面へ
                      </Link>
                    )}
                  </div>
                </div>

                {/* Pro */}
                <div className={`rounded-2xl border p-4 ${bannerPlanTier === 'PRO' ? 'border-blue-600 bg-blue-900' : 'border-slate-900 bg-slate-900'} text-white`}>
                  <p className="text-xs font-black text-white/70">PRO</p>
                  <p className="mt-1 text-lg font-black">プロプラン</p>
                  <p className="mt-2 text-sm font-black">月額 ¥9,980</p>
                  <p className="mt-2 text-[11px] text-white/80 font-bold leading-relaxed">
                    1日{BANNER_PRICING.proLimit}枚まで生成 / 最大10枚生成 / サイズ指定OK
                  </p>
                  <div className="mt-3">
                    {bannerPlanTier === 'PRO' ? (
                      <button disabled className="w-full py-3 rounded-2xl bg-slate-200 text-slate-600 font-black text-sm cursor-not-allowed">現在のプラン</button>
                    ) : bannerPlanTier === 'ENTERPRISE' ? (
                      <button disabled className="w-full py-3 rounded-2xl bg-slate-200 text-slate-600 font-black text-sm cursor-not-allowed">プランダウングレード</button>
                    ) : (
                      <CheckoutButton planId="banner-pro" loginCallbackUrl="/banner" className="w-full py-3 rounded-2xl text-sm" variant="secondary">
                        プロプランを始める
                      </CheckoutButton>
                    )}
                  </div>
                </div>

                {/* Enterprise */}
                <div className={`rounded-2xl border p-4 ${bannerPlanTier === 'ENTERPRISE' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                  <p className="text-xs font-black text-slate-500">Enterprise</p>
                  <p className="mt-1 text-lg font-black text-slate-900">エンタープライズ</p>
                  <p className="mt-2 text-sm font-black text-slate-900">月額 ¥49,800</p>
                  <p className="mt-2 text-[11px] text-slate-600 font-bold leading-relaxed">
                    1日{BANNER_PRICING.enterpriseLimit || 500}枚まで生成 / 大量運用向け
                  </p>
                  <div className="mt-3 grid gap-2">
                    {bannerPlanTier === 'ENTERPRISE' ? (
                      <button disabled className="w-full py-3 rounded-2xl bg-slate-200 text-slate-600 font-black text-sm cursor-not-allowed">現在のプラン</button>
                    ) : (
                      <CheckoutButton planId="banner-enterprise" loginCallbackUrl="/banner" className="w-full py-3 rounded-2xl text-sm">
                        {bannerPlanTier === 'PRO' ? 'エンタープライズにアップグレード' : 'エンタープライズを始める'}
                      </CheckoutButton>
                    )}
                    <a
                      href={HIGH_USAGE_CONTACT_URL}
                      target={HIGH_USAGE_CONTACT_URL.startsWith('http') ? '_blank' : undefined}
                      rel={HIGH_USAGE_CONTACT_URL.startsWith('http') ? 'noreferrer' : undefined}
                      className="inline-flex items-center justify-center w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-black hover:bg-slate-100 transition-colors text-sm"
                    >
                      さらに上限UPの相談（マーケティング施策を丸投げする）
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* アップグレード成功モーダル */}
      <UpgradeSuccessModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        planName={upgradedPlan}
      />
    </div>
  )
}


