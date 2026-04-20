'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowLeft, Loader2, CheckCircle2, Lock } from 'lucide-react'
import { Suspense } from 'react'

interface Theme {
  id: string
  name: string
  description: string
  industries: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
  }
  tailwindClasses: {
    hero: string
    heading: string
    button: string
    accent: string
  }
}

const FREE_THEME_IDS = ['corporate', 'minimal', 'warm']

function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <div className="rounded-lg overflow-hidden border border-slate-700 text-xs" style={{ transform: 'scale(1)', transformOrigin: 'top left' }}>
      {/* Hero mini */}
      <div className={`${theme.tailwindClasses.hero} px-3 py-3`}>
        <div className="font-bold text-xs truncate" style={{ color: 'currentColor' }}>見出しテキスト</div>
        <div className="opacity-70 text-xs mt-0.5 truncate">サブ見出しが入ります</div>
        <div className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${theme.tailwindClasses.button}`} style={{ fontSize: '0.6rem' }}>
          CTAボタン
        </div>
      </div>
      {/* Body mini */}
      <div className="bg-white px-3 py-2">
        <div className={`text-xs font-bold mb-1 ${theme.tailwindClasses.heading}`} style={{ fontSize: '0.6rem' }}>セクション見出し</div>
        <div className="space-y-0.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-1 bg-gray-200 rounded" style={{ width: `${100 - i * 15}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function DesignPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const { data: session } = useSession()

  const [themes, setThemes] = useState<Theme[]>([])
  const [selectedThemeId, setSelectedThemeId] = useState<string>('minimal')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!projectId) return
    try {
      const [themesRes, projRes] = await Promise.all([
        fetch('/api/lp/themes'),
        fetch(`/api/lp/projects/${projectId}`),
      ])
      const themesData = await themesRes.json()
      const projData = await projRes.json()

      if (themesData.themes) setThemes(themesData.themes)
      if (projData.project?.themeId) setSelectedThemeId(projData.project.themeId)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const userPlan = String((session?.user as any)?.plan || (session ? 'FREE' : 'GUEST')).toUpperCase()
  const isFree = userPlan === 'FREE' || userPlan === 'GUEST'
  const isThemeLocked = (themeId: string) => isFree && !FREE_THEME_IDS.includes(themeId)

  const handleNext = async () => {
    if (!projectId) return
    setSaving(true)
    try {
      await fetch(`/api/lp/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId: selectedThemeId, status: 'completed' }),
      })
      router.push(`/lp/${projectId}`)
    } catch (e: any) {
      alert(e.message || 'エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      {/* ステップインジケーター */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-sm">
            {['商品情報入力', '構成案選択', 'コピー確認', 'デザイン選択'].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <div className="w-8 h-px bg-slate-700" />}
                <div className={`flex items-center gap-1.5 ${i === 3 ? 'text-cyan-400' : i < 3 ? 'text-slate-400' : 'text-slate-600'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 3 ? 'bg-cyan-500 text-slate-950' : i < 3 ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-500'}`}>
                    {i < 3 ? '✓' : i + 1}
                  </div>
                  <span className="hidden sm:inline font-medium">{step}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-black text-white mb-2">デザインテーマを選択してください</h1>
        <p className="text-slate-400 text-sm mb-8">
          LPのデザインを選択します。
          {isFree && <span className="text-amber-400"> フリープランでは3テーマをご利用いただけます。</span>}
        </p>

        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {themes.map((theme, i) => {
                const locked = isThemeLocked(theme.id)
                const selected = selectedThemeId === theme.id

                return (
                  <motion.button
                    key={theme.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => !locked && setSelectedThemeId(theme.id)}
                    disabled={locked}
                    className={`text-left rounded-xl border p-3 transition-all relative ${
                      selected
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : locked
                        ? 'border-slate-800 bg-slate-900/50 opacity-60 cursor-not-allowed'
                        : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                    }`}
                  >
                    {locked && (
                      <div className="absolute top-2 right-2 z-10">
                        <div className="bg-amber-500/20 border border-amber-500/40 rounded-full p-1">
                          <Lock className="w-3 h-3 text-amber-400" />
                        </div>
                      </div>
                    )}
                    {selected && (
                      <div className="absolute top-2 right-2 z-10">
                        <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                      </div>
                    )}

                    <ThemePreview theme={theme} />

                    <div className="mt-3">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-bold text-white text-sm">{theme.name}</span>
                      </div>
                      <p className="text-xs text-slate-500">{theme.description}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{theme.industries}</p>
                    </div>

                    {/* カラーパレット */}
                    <div className="flex gap-1 mt-2">
                      {Object.values(theme.colors).slice(0, 4).map((color, j) => (
                        <div
                          key={j}
                          className="w-4 h-4 rounded-full border border-slate-700 flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </motion.button>
                )
              })}
            </div>

            {isFree && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-300 font-bold text-sm">プロプランで全テーマが使えます</p>
                  <p className="text-amber-400/70 text-xs mt-1">Creative、Bold、Elegant、Dark、Medicalテーマはプロプラン以上でご利用いただけます。</p>
                  <button
                    onClick={() => router.push('/lp/pricing')}
                    className="text-xs text-amber-400 hover:text-amber-300 underline mt-2 block"
                  >
                    プランをアップグレードする →
                  </button>
                </div>
              </div>
            )}

            {/* ナビゲーション */}
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> 戻る
              </button>
              <button
                onClick={handleNext}
                disabled={saving}
                className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black px-8 py-4 rounded-xl transition-colors"
              >
                {saving && <Loader2 className="w-5 h-5 animate-spin" />}
                LPを完成させる
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LpDesignPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>}>
      <DesignPage />
    </Suspense>
  )
}
