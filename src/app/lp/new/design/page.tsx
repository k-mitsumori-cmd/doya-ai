'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowLeft, Loader2, CheckCircle2, Lock, LogIn, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { Suspense } from 'react'

interface Theme {
  id: string
  name: string
  description: string
  industries: string
  locked?: boolean
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
    muted: string
  }
  tailwindClasses: {
    hero: string
    section: string
    heading: string
    body: string
    button: string
    accent: string
  }
}

function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <div className="relative aspect-[3/4] rounded-lg overflow-hidden" style={{ backgroundColor: theme.colors.background }}>
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
      {/* Hero mini */}
      <div className={`${theme.tailwindClasses.hero} px-3 py-4 h-2/5`}>
        <div className="font-bold text-xs truncate" style={{ color: 'currentColor' }}>見出しテキスト</div>
        <div className="opacity-70 text-[10px] mt-1 truncate">サブ見出しが入ります</div>
        <div className={`inline-block mt-2 text-[9px] px-2 py-0.5 rounded ${theme.tailwindClasses.button}`}>
          CTAボタン
        </div>
      </div>
      {/* Body mini */}
      <div className="px-3 py-2" style={{ backgroundColor: theme.colors.background === '#ffffff' ? '#f8fafc' : theme.colors.background }}>
        <div className="text-[9px] font-bold mb-1" style={{ color: theme.colors.text }}>セクション</div>
        <div className="space-y-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-1 rounded" style={{ width: `${100 - i * 15}%`, backgroundColor: theme.colors.muted + '30' }} />
          ))}
        </div>
      </div>
      {/* Color swatches */}
      <div className="absolute bottom-3 left-3 flex gap-1 z-20">
        <div className="h-3 w-3 rounded-full border border-white/30" style={{ backgroundColor: theme.colors.primary }} />
        <div className="h-3 w-3 rounded-full border border-white/30" style={{ backgroundColor: theme.colors.background }} />
        <div className="h-3 w-3 rounded-full border border-white/30" style={{ backgroundColor: theme.colors.text }} />
      </div>
    </div>
  )
}

function DesignPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const { data: session, status: sessionStatus } = useSession()

  const [themes, setThemes] = useState<Theme[]>([])
  const [selectedThemeId, setSelectedThemeId] = useState<string>('minimal')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')

  const loadData = useCallback(async () => {
    if (!projectId) return
    setLoadError('')
    try {
      const [themesRes, projRes] = await Promise.all([
        fetch('/api/lp/themes'),
        fetch(`/api/lp/projects/${projectId}`),
      ])
      if (!themesRes.ok) throw new Error('テーマの取得に失敗しました')
      const themesData = await themesRes.json()
      const projData = await projRes.json()

      if (themesData.themes) setThemes(themesData.themes)
      if (projData.project?.themeId) setSelectedThemeId(projData.project.themeId)
    } catch (e: any) {
      setLoadError(e.message || 'データの読み込みに失敗しました')
      toast.error(e.message || 'データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    loadData()
  }, [loadData, sessionStatus])

  const isThemeLocked = (theme: Theme) => theme.locked === true

  const handleNext = async () => {
    if (!projectId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/lp/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId: selectedThemeId, status: 'completed' }),
      })
      if (!res.ok) throw new Error('テーマの保存に失敗しました')
      router.push(`/lp/${projectId}`)
    } catch (e: any) {
      toast.error(e.message || 'エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  if (sessionStatus === 'loading') {
    return <div className="min-h-screen bg-lp-bg flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-lp-primary" /></div>
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-lp-bg flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-lp-primary/20 flex items-center justify-center mb-6">
          <LogIn className="w-8 h-8 text-lp-primary" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">ログインが必要です</h2>
        <p className="text-slate-400 text-sm mb-6">LP作成機能を使うにはログインしてください。</p>
        <button onClick={() => router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/lp/new/design${projectId ? `?projectId=${projectId}` : ''}`)}`)} className="flex items-center gap-2 bg-lp-primary hover:bg-lp-primary/90 text-lp-bg font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-lp-primary/20">
          <LogIn className="w-4 h-4" /> Googleでログイン
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-lp-bg text-white pb-32 relative">
      {/* 背景グラデーションオーブ */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-lp-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-lp-primary/10 blur-[120px] rounded-full" />
      </div>

      {/* ステップインジケーター */}
      <div className="bg-lp-surface/80 backdrop-blur-md border-b border-lp-border px-6 py-4 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <p className="text-xs font-bold text-lp-primary uppercase tracking-widest">Step 4 / 4</p>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-lp-primary/40" />
            <div className="h-2 w-2 rounded-full bg-lp-primary/40" />
            <div className="h-2 w-2 rounded-full bg-lp-primary/40" />
            <div className="h-2.5 w-8 rounded-full bg-lp-primary shadow-[0_0_10px_rgba(5,183,214,0.5)]" />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">デザインテーマを選択してください</h1>
        <p className="text-slate-400 text-sm mb-8">
          LPのデザインを選択します。
          {themes.some(t => t.locked) && <span className="text-amber-400"> 現在のプランでは一部テーマが制限されています。</span>}
        </p>

        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-lp-primary mx-auto" />
          </div>
        ) : loadError ? (
          <div className="text-center py-16">
            <p className="text-red-400 mb-4">{loadError}</p>
            <button onClick={() => { setLoading(true); loadData() }} className="text-lp-primary hover:text-lp-primary/80 font-bold">再読み込み</button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {themes.map((theme, i) => {
                const locked = isThemeLocked(theme)
                const selected = selectedThemeId === theme.id

                return (
                  <motion.button
                    key={theme.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => !locked && setSelectedThemeId(theme.id)}
                    disabled={locked}
                    className={`group relative flex flex-col gap-3 rounded-xl p-2 transition-all text-left ${
                      selected
                        ? 'ring-2 ring-lp-primary bg-lp-primary/10'
                        : locked
                        ? 'ring-1 ring-lp-border bg-lp-surface/50 opacity-80 cursor-not-allowed'
                        : 'ring-1 ring-lp-border bg-lp-surface hover:ring-lp-primary/50'
                    }`}
                  >
                    {/* チェックマーク */}
                    {selected && (
                      <div className="absolute top-2 right-2 z-20 bg-lp-primary text-white rounded-full p-1 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    )}

                    {/* ロックオーバーレイ */}
                    {locked && (
                      <div className="absolute inset-0 rounded-xl bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-10">
                        <Lock className="w-6 h-6 text-white" />
                      </div>
                    )}

                    <ThemePreview theme={theme} />

                    <div className="px-1 pb-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-white text-sm truncate">{theme.name}</span>
                        {locked && (
                          <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 rounded">PRO</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">{theme.description}</p>
                    </div>
                  </motion.button>
                )
              })}
            </div>

            {themes.some(t => t.locked) && (
              <div className="flex items-center justify-between bg-lp-primary/10 rounded-xl p-4 border border-lp-primary/30">
                <div className="flex items-center gap-3">
                  <div className="bg-lp-primary text-white rounded-full p-1.5 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">プロプランで全テーマが使えます</p>
                    <p className="text-slate-400 text-xs mt-0.5">Creative、Bold、Elegant、Dark、Medicalテーマはプロプラン以上でご利用いただけます。</p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/lp/pricing')}
                  className="text-sm text-lp-primary hover:text-lp-primary/80 font-bold bg-lp-primary/20 hover:bg-lp-primary/30 px-4 py-2 rounded-lg transition-all flex-shrink-0"
                >
                  アップグレード
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 固定ボトムナビゲーション */}
      <div className="fixed bottom-0 left-0 right-0 bg-lp-bg border-t border-lp-primary/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> 戻る
          </button>
          <button
            onClick={handleNext}
            disabled={saving}
            className="flex items-center gap-2 bg-lp-primary hover:bg-lp-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-lp-bg font-black px-5 sm:px-8 py-4 rounded-xl transition-all shadow-[0_4px_20px_rgba(5,183,214,0.3)]"
          >
            {saving && <Loader2 className="w-5 h-5 animate-spin" />}
            LPを完成させる
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LpDesignPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-lp-bg flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-lp-primary" /></div>}>
      <DesignPage />
    </Suspense>
  )
}
