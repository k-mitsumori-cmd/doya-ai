'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

/* ───────────────────────── types ───────────────────────── */

interface CompanyDetail {
  id: string
  companyName: string
  corporateNumber?: string | null
  industry: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  foundedYear?: number | null
  employeeCount?: string | null
  capital?: string | null
  representative?: string | null
  matchScore?: number | null
  contactStatus: string
  notes?: string | null
  needsAnalysis?: string | null
  approachAdvice?: string | null
  riskFlags?: string | null
}

interface Approach {
  id: string
  type: string
  tone: string | null
  subject?: string | null
  body: string
  createdAt: string
}

/* ───────────────────────── constants ───────────────────── */

const CONTACT_STATUSES = [
  {
    value: '未着手',
    label: '未着手',
    description: 'まだ連絡を取っていない',
    dot: 'bg-slate-400',
    activeBg: 'bg-slate-100',
    activeText: 'text-slate-700',
    activeRing: 'ring-slate-400',
  },
  {
    value: '連絡済',
    label: '連絡済',
    description: '初回連絡を送付済み',
    dot: 'bg-blue-500',
    activeBg: 'bg-blue-50',
    activeText: 'text-blue-700',
    activeRing: 'ring-blue-400',
  },
  {
    value: '返信あり',
    label: '返信あり',
    description: '先方から返信を受領',
    dot: 'bg-sky-500',
    activeBg: 'bg-sky-50',
    activeText: 'text-sky-700',
    activeRing: 'ring-sky-400',
  },
  {
    value: '商談中',
    label: '商談中',
    description: '具体的な商談フェーズ',
    dot: 'bg-amber-500',
    activeBg: 'bg-amber-50',
    activeText: 'text-amber-700',
    activeRing: 'ring-amber-400',
  },
  {
    value: '成約',
    label: '成約',
    description: '契約・受注完了',
    dot: 'bg-green-500',
    activeBg: 'bg-green-50',
    activeText: 'text-green-700',
    activeRing: 'ring-green-400',
  },
  {
    value: '見送り',
    label: '見送り',
    description: '今回は対象外',
    dot: 'bg-red-400',
    activeBg: 'bg-red-50',
    activeText: 'text-red-600',
    activeRing: 'ring-red-400',
  },
]

const APPROACH_TYPE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  email: { label: 'メール', bg: 'bg-sky-100', text: 'text-sky-700' },
  form: { label: '問合せフォーム', bg: 'bg-indigo-100', text: 'text-indigo-700' },
  letter: { label: '手紙・DM', bg: 'bg-amber-100', text: 'text-amber-700' },
  phone_script: { label: '電話スクリプト', bg: 'bg-emerald-100', text: 'text-emerald-700' },
}

/* ───────────────────────── Score Ring ────────────────────── */

function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const radius = (size - 20) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  const bgColor = score >= 70 ? '#dcfce7' : score >= 40 ? '#fef3c7' : '#fee2e2'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth="12"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-4xl font-black text-slate-900">{score}</span>
        <span className="text-xs font-medium text-slate-400 block -mt-1">/ 100</span>
      </div>
    </div>
  )
}

/* ───────────────────────── Page Component ────────────────── */

export default function CompanyDetailPage() {
  const { id: projectId, companyId } = useParams<{ id: string; companyId: string }>()

  const router = useRouter()
  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [projectName, setProjectName] = useState<string>('')
  const [approaches, setApproaches] = useState<Approach[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [contactStatus, setContactStatus] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchCompanyDetail = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/doyalist/companies/${companyId}`)
      if (res.ok) {
        const data = await res.json()
        // API returns company directly with approaches included
        setCompany(data || null)
        setNotes(data?.notes || '')
        setContactStatus(data?.contactStatus || '未着手')
        setApproaches(data?.approaches || [])
      }
    } catch (err) {
      console.error('企業詳細取得エラー:', err)
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  const fetchProjectName = useCallback(async () => {
    try {
      const res = await fetch(`/api/doyalist/projects/${projectId}`)
      if (res.ok) {
        const data = await res.json()
        // API returns project directly
        setProjectName(data.title || 'プロジェクト')
      }
    } catch {
      setProjectName('プロジェクト')
    }
  }, [projectId])

  useEffect(() => {
    fetchCompanyDetail()
    fetchProjectName()
  }, [fetchCompanyDetail, fetchProjectName])

  /* ── actions ── */

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/doyalist/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, companyIds: [companyId] }),
      })
      if (res.ok) {
        await fetchCompanyDetail()
      }
    } catch (err) {
      console.error('AI分析エラー:', err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleEnrich = async () => {
    setIsEnriching(true)
    try {
      const res = await fetch(`/api/doyalist/companies/${companyId}/enrich`, {
        method: 'POST',
      })
      if (res.ok) {
        await fetchCompanyDetail()
      }
    } catch (err) {
      console.error('情報補完エラー:', err)
    } finally {
      setIsEnriching(false)
    }
  }

  const handleSaveNotes = async () => {
    setIsSavingNotes(true)
    try {
      const res = await fetch(`/api/doyalist/companies/${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, contactStatus }),
      })
      if (res.ok) {
        setSavedMessage('保存しました')
        setTimeout(() => setSavedMessage(''), 2500)
      }
    } catch (err) {
      console.error('保存エラー:', err)
    } finally {
      setIsSavingNotes(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    setContactStatus(newStatus)
    try {
      await fetch(`/api/doyalist/companies/${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactStatus: newStatus }),
      })
    } catch (err) {
      console.error('ステータス更新エラー:', err)
    }
  }

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // noop
    }
  }

  /* ── loading skeleton ── */

  if (isLoading) {
    return (
      <div className="min-h-screen bg-blue-50/30 p-6 lg:p-10 max-w-6xl mx-auto">
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
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-2">
            <div className="h-4 bg-slate-200 rounded w-16" />
            <div className="h-4 bg-slate-200 rounded w-4" />
            <div className="h-4 bg-slate-200 rounded w-24" />
            <div className="h-4 bg-slate-200 rounded w-4" />
            <div className="h-4 bg-slate-200 rounded w-20" />
          </div>
          <div className="h-10 bg-slate-200 rounded w-1/3" />
          <div className="h-56 bg-white rounded-3xl border border-slate-100" />
          <div className="h-48 bg-white rounded-3xl border border-slate-100" />
          <div className="h-40 bg-white rounded-3xl border border-slate-100" />
        </div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-blue-50/30 p-6 lg:p-10 max-w-6xl mx-auto flex flex-col items-center justify-center py-24">
        <motion.img
          src="/characters/error_泣き.png"
          alt="見つかりません"
          className="w-24 h-24 object-contain mb-6"
          animate={{ rotate: [-3, 3, -3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <p className="text-lg font-bold text-slate-800">企業情報が見つかりません</p>
        <Link
          href={`/doyalist/projects/${projectId}`}
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-200/50 hover:bg-blue-600 transition-all"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          プロジェクトに戻る
        </Link>
      </div>
    )
  }

  /* ── main render ── */

  return (
    <div className="min-h-screen bg-blue-50/30 p-6 lg:p-10 max-w-6xl mx-auto space-y-8">

      {/* ━━━ 1. Breadcrumb ━━━ */}
      <nav className="flex items-center gap-1.5 text-sm flex-wrap">
        <Link
          href="/doyalist/projects"
          className="text-slate-400 hover:text-slate-600 transition-colors font-medium"
        >
          リスト一覧
        </Link>
        <span className="material-symbols-outlined text-sm text-slate-300">chevron_right</span>
        <Link
          href={`/doyalist/projects/${projectId}`}
          className="text-slate-400 hover:text-slate-600 transition-colors font-medium max-w-[200px] truncate"
          title={projectName}
        >
          {projectName || 'プロジェクト'}
        </Link>
        <span className="material-symbols-outlined text-sm text-slate-300">chevron_right</span>
        <span className="text-slate-800 font-bold max-w-[220px] truncate" title={company.companyName}>
          {company.companyName}
        </span>
      </nav>

      {/* ━━━ 2. Company Info Card ━━━ */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              {company.companyName}
            </h1>
            <div className="flex items-center gap-3 mt-1.5">
              {company.industry && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600">
                  {company.industry}
                </span>
              )}
              {company.corporateNumber && (
                <span className="text-xs text-slate-400 font-mono">
                  法人番号 {company.corporateNumber}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleEnrich}
            disabled={isEnriching}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-blue-200 text-blue-600 text-sm font-bold rounded-full hover:bg-blue-50 hover:border-blue-300 active:scale-[0.97] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isEnriching ? (
              <>
                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                補完中...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">auto_fix_high</span>
                情報を補完する
              </>
            )}
          </button>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 p-6">
          <InfoField icon="badge" label="法人番号" value={company.corporateNumber} />
          <InfoField icon="category" label="業種" value={company.industry} />
          <InfoField icon="location_on" label="住所" value={company.address} />
          <InfoField icon="call" label="電話番号" value={company.phone} />
          <InfoField icon="mail" label="メール" value={company.email} />
          <InfoField icon="language" label="Webサイト" value={company.website} isLink />
          <InfoField icon="person" label="代表者名" value={company.representative} />
          <InfoField icon="group" label="従業員数" value={company.employeeCount ? `${company.employeeCount}名` : undefined} />
          <InfoField icon="payments" label="資本金" value={company.capital} />
          <InfoField icon="calendar_month" label="設立年" value={company.foundedYear ? `${company.foundedYear}年` : undefined} />
        </div>
      </motion.section>

      {/* ━━━ 3. AI Analysis ━━━ */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
      >
        <h2 className="text-lg font-extrabold text-slate-900 mb-5 flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-500">psychology</span>
          AI分析
        </h2>

        {company.matchScore != null ? (
          <div className="space-y-6">
            {/* Score + description */}
            <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-slate-100">
              <ScoreRing score={company.matchScore} />
              <div className="text-center sm:text-left">
                <p className="text-base font-bold text-slate-800">マッチ度スコア</p>
                <p className="text-sm text-slate-500 mt-1 max-w-sm">
                  プロジェクト条件と企業情報をもとに、AIが総合的な相性を評価しました。
                </p>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  {isAnalyzing ? '再分析中...' : '再分析する'}
                </button>
              </div>
            </div>

            {/* Three analysis cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AnalysisCard
                icon="lightbulb"
                title="ニーズ分析"
                content={company.needsAnalysis || '分析データなし'}
                colorScheme="sky"
              />
              <AnalysisCard
                icon="handshake"
                title="推奨アプローチ"
                content={company.approachAdvice || '分析データなし'}
                colorScheme="emerald"
              />
              <AnalysisCard
                icon="warning"
                title="リスク・注意事項"
                content={company.riskFlags || 'なし'}
                colorScheme="amber"
              />
            </div>
          </div>
        ) : (
          /* CTA when no analysis */
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-5">
              <span className="material-symbols-outlined text-3xl text-indigo-400">auto_awesome</span>
            </div>
            <p className="text-base font-semibold text-slate-600 mb-2">AI分析がまだ実行されていません</p>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              企業情報とプロジェクト条件をもとに、マッチ度・ニーズ・推奨アプローチをAIが分析します。
            </p>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-bold text-base rounded-2xl shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isAnalyzing ? (
                <>
                  <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                  分析中...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">psychology</span>
                  AI分析を実行
                </>
              )}
            </button>
          </div>
        )}
      </motion.section>

      {/* ━━━ 4. Status & Notes ━━━ */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.16 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
      >
        <h2 className="text-lg font-extrabold text-slate-900 mb-5 flex items-center gap-2">
          <span className="material-symbols-outlined text-sky-500">flag</span>
          ステータス・メモ
        </h2>

        {/* Status pills */}
        <div className="mb-6">
          <p className="text-sm font-bold text-slate-700 mb-3">コンタクトステータス</p>
          <div className="flex flex-wrap gap-2">
            {CONTACT_STATUSES.map((status) => {
              const isActive = contactStatus === status.value
              return (
                <button
                  key={status.value}
                  onClick={() => handleStatusChange(status.value)}
                  className={`
                    group relative flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all
                    ${isActive
                      ? `${status.activeBg} ${status.activeText} ring-2 ${status.activeRing} shadow-sm`
                      : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                    }
                  `}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${isActive ? status.dot : 'bg-slate-300 group-hover:bg-slate-400'} transition-colors`} />
                  {status.label}
                  {/* Tooltip */}
                  <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs bg-slate-800 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {status.description}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-indigo-400">sticky_note_2</span>
            メモ
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="企業に関するメモを入力..."
            className="w-full px-4 py-3 min-h-[120px] border border-slate-200 rounded-xl text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all placeholder:text-slate-300"
          />
          <div className="flex items-center justify-between mt-3">
            <AnimatePresence>
              {savedMessage && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-green-600 font-semibold flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  {savedMessage}
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={handleSaveNotes}
              disabled={isSavingNotes}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-sky-500 text-white text-sm font-bold rounded-xl hover:bg-sky-600 active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {isSavingNotes ? (
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-base">save</span>
              )}
              保存
            </button>
          </div>
        </div>
      </motion.section>

      {/* ━━━ 5. Approach History ━━━ */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.24 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-sky-500">history</span>
            アプローチ履歴
          </h2>
          <Link
            href={`/doyalist/projects/${projectId}/approach`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-lg">edit_note</span>
            アプローチ文面を生成
          </Link>
        </div>

        {approaches.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-4xl text-slate-200 mb-3 block">inbox</span>
            <p className="text-sm text-slate-400 font-medium">まだアプローチ履歴がありません</p>
            <p className="text-xs text-slate-300 mt-1">
              上のボタンからアプローチ文面を生成できます
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {approaches.map((approach, index) => {
              const typeConfig = APPROACH_TYPE_LABELS[approach.type] || {
                label: approach.type,
                bg: 'bg-slate-100',
                text: 'text-slate-600',
              }
              return (
                <motion.div
                  key={approach.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${typeConfig.bg} ${typeConfig.text}`}>
                          {typeConfig.label}
                        </span>
                        {approach.tone && (
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-600">
                            {approach.tone}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 ml-auto flex-shrink-0">
                          {new Date(approach.createdAt).toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      {approach.subject && (
                        <p className="text-sm font-bold text-slate-700 mb-1">{approach.subject}</p>
                      )}
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                        {approach.body}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCopy(approach.body, approach.id)}
                      className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition-all"
                      title="コピー"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {copiedId === approach.id ? 'check' : 'content_copy'}
                      </span>
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.section>
    </div>
  )
}

/* ═══════════════════════════ Sub-Components ═══════════════════════════ */

/** Single info field row with icon, bold label, and value. */
function InfoField({
  icon,
  label,
  value,
  isLink,
}: {
  icon: string
  label: string
  value?: string | null
  isLink?: boolean
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="material-symbols-outlined text-lg text-slate-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
        {!value ? (
          <p className="text-sm text-slate-300 italic">未取得</p>
        ) : isLink ? (
          <a
            href={value.startsWith('http') ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-sky-600 hover:text-sky-700 hover:underline break-all font-medium inline-flex items-center gap-1"
          >
            {value}
            <span className="material-symbols-outlined text-xs">open_in_new</span>
          </a>
        ) : (
          <p className="text-sm text-slate-800 font-medium">{value}</p>
        )}
      </div>
    </div>
  )
}

/** Analysis card for needs / approach / risks. */
function AnalysisCard({
  icon,
  title,
  content,
  colorScheme,
}: {
  icon: string
  title: string
  content: string
  colorScheme: 'sky' | 'emerald' | 'amber'
}) {
  const colors = {
    sky: {
      bg: 'bg-sky-50',
      border: 'border-sky-100',
      icon: 'text-sky-500',
      title: 'text-sky-800',
    },
    emerald: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      icon: 'text-emerald-500',
      title: 'text-emerald-800',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      icon: 'text-amber-500',
      title: 'text-amber-800',
    },
  }
  const c = colors[colorScheme]

  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4 flex flex-col`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`material-symbols-outlined text-xl ${c.icon}`}>{icon}</span>
        <h4 className={`text-sm font-extrabold ${c.title}`}>{title}</h4>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed flex-1">{content}</p>
    </div>
  )
}
