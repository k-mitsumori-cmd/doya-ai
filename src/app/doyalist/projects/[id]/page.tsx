'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

interface Company {
  id: string
  companyName: string
  industry: string | null
  address: string | null
  matchScore: number | null
  contactStatus: string
  website?: string | null
}

interface Project {
  id: string
  title: string
  status: 'draft' | 'collecting' | 'analyzing' | 'completed' | 'archived'
  companyCount: number
  createdAt: string
  companies: Company[]
  targetCriteria?: Record<string, unknown>
}

const STATUS_CONFIG: Record<string, { label: string; icon: string; dotColor: string; chipBg: string; chipText: string }> = {
  draft: { label: '下書き', icon: 'edit_note', dotColor: 'bg-slate-400', chipBg: 'bg-slate-100', chipText: 'text-slate-600' },
  collecting: { label: '収集中', icon: 'sync', dotColor: 'bg-blue-500', chipBg: 'bg-blue-50', chipText: 'text-blue-700' },
  analyzing: { label: '分析中', icon: 'psychology', dotColor: 'bg-amber-500', chipBg: 'bg-amber-50', chipText: 'text-amber-700' },
  completed: { label: '完了', icon: 'check_circle', dotColor: 'bg-green-500', chipBg: 'bg-green-50', chipText: 'text-green-700' },
  archived: { label: 'アーカイブ', icon: 'inventory_2', dotColor: 'bg-slate-400', chipBg: 'bg-slate-50', chipText: 'text-slate-500' },
}

const COMPANY_STATUSES = [
  { value: '未着手', label: '未着手', color: 'bg-slate-400' },
  { value: '連絡済', label: '連絡済', color: 'bg-blue-500' },
  { value: '返信あり', label: '返信あり', color: 'bg-amber-500' },
  { value: '商談中', label: '商談中', color: 'bg-purple-500' },
  { value: '成約', label: '成約', color: 'bg-green-500' },
  { value: '見送り', label: '見送り', color: 'bg-red-400' },
]

function getStatusDotColor(status: string): string {
  const found = COMPANY_STATUSES.find((s) => s.value === status)
  return found?.color || 'bg-slate-400'
}

function ScoreBar({ score }: { score: number }) {
  const barColor = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-400' : 'bg-red-400'
  const glowColor = score >= 70 ? 'bg-emerald-300' : score >= 40 ? 'bg-amber-300' : 'bg-red-300'
  const textColor = score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-500'
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-24 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor} relative`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          {/* Glowing tip dot */}
          <motion.div
            className={`absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${glowColor}`}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0.6, 1], scale: [0, 1.4, 1, 1.2] }}
            transition={{ delay: 0.7, duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
            style={{ filter: 'blur(1px)' }}
          />
        </motion.div>
      </div>
      <span className={`text-sm font-semibold tabular-nums ${textColor}`}>{score}%</span>
      {score >= 70 && (
        <motion.span
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: [0, 1.3, 1], rotate: [-30, 10, 0] }}
          transition={{ delay: 0.8, type: "spring", bounce: 0.6 }}
          className="text-amber-400 text-xs"
        >⭐</motion.span>
      )}
    </div>
  )
}

/* ── CountUp Animation Component ── */
function CountUp({ target, duration = 1.2, suffix = '' }: { target: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (target === 0) { setCount(0); return }
    let start = 0
    const step = target / (duration * 60)
    let raf: number
    const animate = () => {
      start += step
      if (start >= target) { setCount(target); return }
      setCount(Math.round(start))
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return <><span ref={ref}>{count}</span>{suffix && <span className="text-sm font-medium text-slate-400">{suffix}</span>}</>
}

/* ── Confetti Mini Burst ── */
function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null
  const particles = Array.from({ length: 12 }, (_, i) => i)
  const colors = ['bg-green-400', 'bg-emerald-400', 'bg-yellow-400', 'bg-blue-400', 'bg-pink-400', 'bg-purple-400']
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {particles.map((i) => (
        <motion.div
          key={i}
          className={`absolute w-1.5 h-1.5 rounded-full ${colors[i % colors.length]}`}
          initial={{
            x: '50%',
            y: '50%',
            opacity: 1,
            scale: 1,
          }}
          animate={{
            x: `${50 + (Math.random() - 0.5) * 120}%`,
            y: `${50 + (Math.random() - 0.5) * 120}%`,
            opacity: 0,
            scale: 0,
          }}
          transition={{ duration: 0.8 + Math.random() * 0.4, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id: projectId } = useParams<{ id: string }>()

  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'matchScore' | 'name' | 'status'>('matchScore')
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [justChanged, setJustChanged] = useState<string | null>(null)
  const [csvDone, setCsvDone] = useState(false)
  const [showCsvToast, setShowCsvToast] = useState(false)

  useEffect(() => {
    fetchProject()
  }, [projectId])

  const fetchProject = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/doyalist/projects/${projectId}`)
      if (res.ok) {
        const data = await res.json()
        // API returns project directly (not wrapped in { project: ... })
        // Map company fields to match frontend interface
        const mappedCompanies = (data.companies || []).map((c: any) => ({
          ...c,
          matchScore: c.matchScore ?? 0,
          contactStatus: c.contactStatus || '未着手',
        }))
        setProject({
          ...data,
          companyCount: data._count?.companies ?? mappedCompanies.length,
          companies: mappedCompanies,
        })
      }
    } catch (err) {
      console.error('プロジェクト取得エラー:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const sortedCompanies = useMemo(() => {
    if (!project?.companies) return []
    const sorted = [...project.companies]
    switch (sortBy) {
      case 'matchScore':
        sorted.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
        break
      case 'name':
        sorted.sort((a, b) => a.companyName.localeCompare(b.companyName, 'ja'))
        break
      case 'status':
        sorted.sort((a, b) => a.contactStatus.localeCompare(b.contactStatus))
        break
    }
    return sorted
  }, [project?.companies, sortBy])

  const avgScore = useMemo(() => {
    if (!project?.companies || project.companies.length === 0) return 0
    const total = project.companies.reduce((sum, c) => sum + (c.matchScore ?? 0), 0)
    return Math.round(total / project.companies.length)
  }, [project?.companies])

  const contactedCount = useMemo(() => {
    if (!project?.companies) return 0
    return project.companies.filter((c) => c.contactStatus !== '未着手').length
  }, [project?.companies])

  const handleStatusChange = async (companyId: string, newStatus: string) => {
    setUpdatingStatus(companyId)
    try {
      await fetch(`/api/doyalist/companies/${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactStatus: newStatus }),
      })
      setProject((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          companies: prev.companies.map((c) =>
            c.id === companyId ? { ...c, contactStatus: newStatus } : c
          ),
        }
      })
      // Trigger celebration animation on status change (especially 成約)
      if (newStatus === '成約' || newStatus === '返信あり' || newStatus === '商談中') {
        setJustChanged(companyId)
        setTimeout(() => setJustChanged(null), 1500)
      }
    } catch (err) {
      console.error('ステータス更新エラー:', err)
    } finally {
      setUpdatingStatus(null)
    }
  }

  const handleCollect = async () => {
    try {
      const res = await fetch('/api/doyalist/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, criteria: project?.targetCriteria || {} }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        alert(errData.error || '企業収集に失敗しました')
      }
      fetchProject()
    } catch (err) {
      console.error('収集開始エラー:', err)
      alert('企業収集中にエラーが発生しました')
    }
  }

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/doyalist/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        alert(errData.error || 'AI分析に失敗しました')
      }
      fetchProject()
    } catch (err) {
      console.error('AI分析エラー:', err)
      alert('AI分析中にエラーが発生しました')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleExportCSV = async () => {
    try {
      const res = await fetch('/api/doyalist/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${project?.title || 'doyalist'}_export.csv`
        a.click()
        URL.revokeObjectURL(url)
        setCsvDone(true)
        setShowCsvToast(true)
        setTimeout(() => setCsvDone(false), 2000)
        setTimeout(() => setShowCsvToast(false), 3000)
      } else {
        alert('CSV出力に失敗しました')
      }
    } catch (err) {
      console.error('CSV出力エラー:', err)
      alert('CSV出力中にエラーが発生しました')
    }
  }

  /* ── Loading Skeleton ── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/60 p-6 lg:p-10 max-w-7xl mx-auto">
        <div className="flex flex-col items-center pt-8 mb-4">
          <motion.img
            src="/characters/working_作業中.png"
            alt="読み込み中"
            className="w-16 h-16 object-contain"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <p className="text-xs text-slate-400 mt-2">読み込み中...</p>
        </div>
        <div className="animate-pulse space-y-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-slate-200/80 rounded-full" />
            <div className="h-4 bg-slate-200/80 rounded-full w-20" />
          </div>
          <div className="space-y-3">
            <div className="h-8 bg-slate-200/80 rounded-2xl w-72" />
            <div className="h-8 bg-slate-200/80 rounded-full w-24" />
          </div>
          <div className="grid grid-cols-3 gap-5">
            <div className="h-28 bg-white rounded-3xl border border-slate-200/80" />
            <div className="h-28 bg-white rounded-3xl border border-slate-200/80" />
            <div className="h-28 bg-white rounded-3xl border border-slate-200/80" />
          </div>
          <div className="h-96 bg-white rounded-3xl border border-slate-200/80" />
        </div>
      </div>
    )
  }

  /* ── Not Found State ── */
  if (!project) {
    return (
      <div className="min-h-screen bg-slate-50/60 p-6 lg:p-10 max-w-7xl mx-auto flex flex-col items-center justify-center py-32">
        <motion.img
          src="/characters/error_泣き.png"
          alt="見つかりません"
          className="w-24 h-24 object-contain mb-6"
          animate={{ rotate: [-3, 3, -3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <h3 className="text-xl font-bold text-slate-800 mb-2">プロジェクトが見つかりません</h3>
        <p className="text-sm text-slate-500 mb-8">IDが無効か、削除された可能性があります。</p>
        <Link
          href="/doyalist/projects"
          className="inline-flex items-center gap-2 px-8 py-3 bg-blue-500 text-white font-semibold text-sm rounded-full shadow-sm hover:bg-blue-600 hover:shadow-md active:scale-[0.97] transition-all"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          リスト一覧に戻る
        </Link>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG.draft

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">

        {/* ── Header Section ── */}
        <div className="space-y-5">
          {/* Back link */}
          <Link
            href="/doyalist/projects"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-600 rounded-full hover:bg-blue-50 p-2 -ml-2 transition-all"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            リスト一覧
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            {/* Title + status chip */}
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{project.title}</h1>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium ${statusConfig.chipBg} ${statusConfig.chipText}`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
                  {statusConfig.label}
                </span>
                {(project.status === 'collecting' || project.status === 'analyzing') && (
                  <div className="relative">
                    {/* Rotating ring around the bear */}
                    <motion.div
                      className="absolute inset-[-6px] border-2 border-blue-400/40 border-t-blue-500 rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.img
                      src="/characters/focus_集中.png"
                      alt="集中中"
                      className="w-12 h-12 object-contain"
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                )}
              </div>
              {/* Collecting status dramatic overlay */}
              {project.status === 'collecting' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-2xl border border-blue-100"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"
                  />
                  <motion.span
                    className="text-sm font-medium text-blue-600"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    AIが最適な企業を探しています...
                  </motion.span>
                </motion.div>
              )}
              {project.status === 'analyzing' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-2xl border border-amber-100"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full"
                  />
                  <motion.span
                    className="text-sm font-medium text-amber-600"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    企業データを分析しています...
                  </motion.span>
                </motion.div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
              {project.status === 'draft' && (
                <button
                  onClick={handleCollect}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white font-semibold text-sm rounded-full shadow-sm hover:bg-blue-600 hover:shadow-md active:scale-[0.97] transition-all"
                >
                  <span className="material-symbols-outlined text-lg">search</span>
                  企業を収集
                </button>
              )}
              {project.companies && project.companies.length > 0 && (
                <>
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-blue-200 text-blue-600 font-semibold text-sm rounded-full hover:bg-blue-50 hover:border-blue-300 active:scale-[0.97] transition-all disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-lg ${isAnalyzing ? 'animate-spin' : ''}`}>
                      {isAnalyzing ? 'progress_activity' : 'analytics'}
                    </span>
                    {isAnalyzing ? '分析中...' : 'AI分析'}
                  </button>
                  <motion.button
                    onClick={handleExportCSV}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 font-semibold text-sm rounded-full active:scale-[0.97] transition-all ${
                      csvDone
                        ? 'bg-emerald-50 border-2 border-emerald-300 text-emerald-600'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                    animate={csvDone ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.span
                      className="material-symbols-outlined text-lg"
                      animate={csvDone ? { rotate: [0, 360] } : {}}
                      transition={{ duration: 0.4 }}
                    >
                      {csvDone ? 'check_circle' : 'download'}
                    </motion.span>
                    {csvDone ? 'ダウンロード完了!' : 'CSV出力'}
                  </motion.button>
                  <button
                    onClick={() => router.push(`/doyalist/projects/${projectId}/approach`)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-emerald-200 text-emerald-600 font-semibold text-sm rounded-full hover:bg-emerald-50 hover:border-emerald-300 active:scale-[0.97] transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">mail</span>
                    アプローチ
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            {
              icon: 'apartment',
              label: '企業数',
              value: project.companies?.length || 0,
              unit: '社',
              iconColor: 'text-blue-500',
              iconBg: 'bg-blue-50',
              valueColor: 'text-blue-600',
            },
            {
              icon: 'analytics',
              label: '平均マッチ度',
              value: avgScore,
              unit: '%',
              iconColor: 'text-emerald-500',
              iconBg: 'bg-emerald-50',
              valueColor: 'text-emerald-600',
            },
            {
              icon: 'call',
              label: '連絡済',
              value: contactedCount,
              unit: '社',
              iconColor: 'text-amber-500',
              iconBg: 'bg-amber-50',
              valueColor: 'text-amber-600',
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${stat.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <span className={`material-symbols-outlined text-2xl ${stat.iconColor}`}>{stat.icon}</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-0.5">{stat.label}</p>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-bold tabular-nums ${stat.valueColor}`}>
                      <CountUp target={stat.value} duration={1.2} />
                    </span>
                    <span className="text-sm font-medium text-slate-400">{stat.unit}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Empty State ── */}
        {(!project.companies || project.companies.length === 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-28 bg-white rounded-3xl border border-slate-200/80 shadow-sm"
          >
            <motion.img
              src="/characters/thinking_考え中.png"
              alt="考え中"
              className="w-28 h-28 object-contain mb-6"
              animate={{ rotate: [-4, 4, -4] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <h3 className="text-xl font-bold text-slate-800 mb-2">まだ企業がいないよ！</h3>
            <p className="text-sm text-slate-500 mb-10 text-center max-w-sm leading-relaxed">
              {project.status === 'draft'
                ? '「企業を収集する」ボタンで営業先を見つけよう'
                : '企業データの収集が完了するまで、しばらくお待ちください。'}
            </p>
            {project.status === 'draft' && (
              <button
                onClick={handleCollect}
                className="inline-flex items-center gap-2 px-10 py-3.5 bg-blue-500 text-white font-semibold text-base rounded-full shadow-sm hover:bg-blue-600 hover:shadow-md active:scale-[0.97] transition-all"
              >
                <span className="material-symbols-outlined text-xl">search</span>
                企業を収集する
              </button>
            )}
          </motion.div>
        )}

        {/* ── Company Table ── */}
        {project.companies && project.companies.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-5"
          >
            {/* Sort Controls - Google-style chip group */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">並び替え</span>
              <div className="flex gap-2">
                {([
                  { value: 'matchScore', label: 'マッチ度', icon: 'speed' },
                  { value: 'name', label: '企業名', icon: 'sort_by_alpha' },
                  { value: 'status', label: 'ステータス', icon: 'swap_vert' },
                ] as { value: typeof sortBy; label: string; icon: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full border transition-all ${
                      sortBy === opt.value
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="text-left px-5 py-3.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                        企業名
                      </th>
                      <th className="text-left px-5 py-3.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                        業種
                      </th>
                      <th className="text-left px-5 py-3.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                        所在地
                      </th>
                      <th className="text-left px-5 py-3.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                        マッチ度
                      </th>
                      <th className="text-left px-5 py-3.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                        ステータス
                      </th>
                      <th className="text-left px-5 py-3.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <AnimatePresence>
                      {sortedCompanies.map((company, index) => (
                        <motion.tr
                          key={company.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{
                            opacity: 1,
                            x: 0,
                            backgroundColor: justChanged === company.id ? ['rgba(220,252,231,0.8)', 'rgba(220,252,231,0)', 'rgba(220,252,231,0)'] : 'rgba(0,0,0,0)',
                          }}
                          transition={{
                            delay: index * 0.05,
                            type: "spring",
                            stiffness: 200,
                            damping: 20,
                            backgroundColor: { duration: 1.5, ease: 'easeOut' },
                          }}
                          className="hover:bg-blue-50/30 transition-colors group relative"
                        >
                          {/* Company Name */}
                          <td className="px-5 py-4">
                            <Link href={`/doyalist/projects/${projectId}/company/${company.id}`} className="font-medium text-sm text-slate-800 hover:text-blue-600 transition-colors">{company.companyName}</Link>
                            {company.website && (
                              <a
                                href={company.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-600 hover:underline mt-0.5 transition-colors"
                              >
                                <span className="material-symbols-outlined text-xs">open_in_new</span>
                                {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                              </a>
                            )}
                          </td>

                          {/* Industry */}
                          <td className="px-5 py-4">
                            <span className="text-sm text-slate-500">{company.industry || '-'}</span>
                          </td>

                          {/* Location */}
                          <td className="px-5 py-4">
                            <span className="text-sm text-slate-500">{company.address || '-'}</span>
                          </td>

                          {/* Match Score */}
                          <td className="px-5 py-4">
                            <ScoreBar score={company.matchScore ?? 0} />
                          </td>

                          {/* Status Dropdown */}
                          <td className="px-5 py-4">
                            <div className="relative inline-flex items-center">
                              <span
                                className={`absolute left-3 w-2 h-2 rounded-full ${getStatusDotColor(company.contactStatus)} pointer-events-none z-10`}
                              />
                              <select
                                value={company.contactStatus}
                                onChange={(e) => handleStatusChange(company.id, e.target.value)}
                                disabled={updatingStatus === company.id}
                                className="text-xs font-medium pl-7 pr-8 py-2 border border-slate-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50 transition-all appearance-none cursor-pointer hover:border-slate-300"
                                style={{
                                  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2394a3b8\' d=\'M3 5l3 3 3-3\'/%3E%3C/svg%3E")',
                                  backgroundPosition: 'right 10px center',
                                  backgroundRepeat: 'no-repeat',
                                }}
                              >
                                {COMPANY_STATUSES.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  router.push(`/doyalist/projects/${projectId}/company/${company.id}`)
                                }
                                className="w-8 h-8 inline-flex items-center justify-center rounded-full text-blue-500 bg-blue-50 hover:bg-blue-100 active:scale-90 transition-all"
                                title="企業詳細"
                              >
                                <span className="material-symbols-outlined text-lg">analytics</span>
                              </button>
                              <button
                                onClick={() =>
                                  router.push(`/doyalist/projects/${projectId}/approach`)
                                }
                                className="w-8 h-8 inline-flex items-center justify-center rounded-full text-emerald-500 bg-emerald-50 hover:bg-emerald-100 active:scale-90 transition-all"
                                title="アプローチ文面生成"
                              >
                                <span className="material-symbols-outlined text-lg">mail</span>
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── CSV Download Toast ── */}
      <AnimatePresence>
        {showCsvToast && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3.5 bg-emerald-600 text-white rounded-2xl shadow-2xl shadow-emerald-200/60"
          >
            <motion.span
              className="material-symbols-outlined text-xl"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.4 }}
            >
              check_circle
            </motion.span>
            <span className="font-bold text-sm">ダウンロード完了!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 成約 Bear Popup + Confetti ── */}
      <AnimatePresence>
        {justChanged && project?.companies?.find(c => c.id === justChanged)?.contactStatus === '成約' && (
          <motion.div
            initial={{ opacity: 0, scale: 0, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="fixed bottom-24 right-8 z-50 flex flex-col items-center"
          >
            <ConfettiBurst active={true} />
            <motion.img
              src="/characters/good_いいね.png"
              alt="成約おめでとう!"
              className="w-20 h-20 object-contain"
              animate={{ rotate: [-5, 5, -5], y: [0, -5, 0] }}
              transition={{ duration: 0.6, repeat: 2 }}
            />
            <motion.span
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-1 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow-lg"
            >
              成約おめでとう!
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
