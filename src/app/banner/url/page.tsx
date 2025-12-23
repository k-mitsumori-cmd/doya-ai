'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowRight, Link2, Loader2, LogIn, Download, Sparkles } from 'lucide-react'
import { Toaster, toast } from 'react-hot-toast'
import DashboardSidebar from '@/components/DashboardSidebar'

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

export default function BannerUrlAutoPage() {
  const { data: session } = useSession()
  const isGuest = !session

  const [targetUrl, setTargetUrl] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string>('')
  const [banners, setBanners] = useState<string[]>([])
  const [bannerAnalysis, setBannerAnalysis] = useState<string>('')
  const [analysisJson, setAnalysisJson] = useState<ApiResponse['analysisJson']>(null)
  const [usedModelDisplay, setUsedModelDisplay] = useState<string>('')

  const canGenerate = useMemo(() => targetUrl.trim().length > 8 && !isGenerating, [targetUrl, isGenerating])

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
    setAnalysisJson(null)
    setUsedModelDisplay('')

    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 290_000)

      const res = await fetch('/api/banner/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ targetUrl: url }),
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
        <Toaster position="top-center" />

        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8 sm:py-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                URL Auto Banner
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">URLだけでバナー自動生成</h1>
              <p className="text-sm text-slate-500 font-bold mt-2">
                URLを入力するだけ。サイト内容をAIが解析し、コピー/デザイン/配色/CTAを自動で判断して生成します。
              </p>
            </div>

            <Link
              href="/banner/dashboard"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-800 font-black hover:bg-slate-50 transition-colors"
            >
              手動で作る
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="mt-6 grid lg:grid-cols-[520px,1fr] gap-6 sm:gap-10">
            {/* Left */}
            <div className="space-y-4">
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

                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
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

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
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
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 space-y-2">
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
            </div>

            {/* Right */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              {banners.length === 0 ? (
                <div className="h-[420px] flex items-center justify-center text-center text-slate-500 font-bold">
                  生成結果がここに表示されます
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-900">生成結果</p>
                    <p className="text-[11px] text-slate-500 font-bold">{banners.length}枚</p>
                  </div>
                  <div className={`grid gap-4 ${banners.length >= 4 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    {banners
                      .filter((b) => typeof b === 'string' && b.startsWith('data:image/'))
                      .map((img, idx) => (
                        <div key={idx} className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50">
                          <img src={img} alt={`banner-${idx + 1}`} className="w-full h-auto object-contain bg-white" />
                          <div className="p-3 flex items-center justify-between gap-2">
                            <p className="text-xs font-black text-slate-700">No.{idx + 1}</p>
                            <button
                              type="button"
                              onClick={() => downloadImage(img, idx)}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              DL
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


