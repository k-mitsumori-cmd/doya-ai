'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

interface Company {
  id: string
  companyName: string
  industry: string | null
}

interface Approach {
  id: string
  companyId: string
  companyName?: string
  type: string
  tone: string
  subject?: string
  body: string
  createdAt: string
}

interface ProjectData {
  id: string
  title: string
  companies: Company[]
}

const APPROACH_TYPES = [
  { value: 'email', label: 'メール', icon: 'mail' },
  { value: 'form', label: '問合せフォーム', icon: 'article' },
  { value: 'letter', label: '手紙・DM', icon: 'drafts' },
  { value: 'phone_script', label: '電話スクリプト', icon: 'call' },
]

const TONE_OPTIONS = [
  { value: 'formal', label: 'フォーマル', description: '丁寧・堅め' },
  { value: 'casual', label: 'カジュアル', description: '親しみやすい' },
  { value: 'consultative', label: 'コンサルティング', description: '提案型' },
]

export default function ApproachPage() {
  const { id: projectId } = useParams<{ id: string }>()

  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [type, setType] = useState<string>('email')
  const [tone, setTone] = useState<string>('formal')
  const [generatedSubject, setGeneratedSubject] = useState<string>('')
  const [generatedBody, setGeneratedBody] = useState<string>('')
  const [generatedTips, setGeneratedTips] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isBulkGenerating, setIsBulkGenerating] = useState(false)
  const [approaches, setApproaches] = useState<Approach[]>([])
  const [isLoadingApproaches, setIsLoadingApproaches] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string>('')
  const [bulkProgress, setBulkProgress] = useState(0)
  const [bulkTotal, setBulkTotal] = useState(0)
  const [showTypingDots, setShowTypingDots] = useState(0)

  useEffect(() => {
    fetchProjectData()
  }, [projectId])

  // Typing dots animation while generating
  useEffect(() => {
    if (!isGenerating && !isBulkGenerating) { setShowTypingDots(0); return }
    const interval = setInterval(() => {
      setShowTypingDots((prev) => (prev + 1) % 4)
    }, 400)
    return () => clearInterval(interval)
  }, [isGenerating, isBulkGenerating])

  const fetchProjectData = async () => {
    try {
      setIsLoadingApproaches(true)
      const res = await fetch(`/api/doyalist/projects/${projectId}`)
      if (res.ok) {
        const data = await res.json()
        // API returns project directly with companies included
        setCompanies(data.companies || [])
      } else {
        console.error('プロジェクトデータ取得失敗:', res.status)
      }
    } catch (err) {
      console.error('プロジェクトデータ取得エラー:', err)
    } finally {
      setIsLoadingApproaches(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedCompanyId) {
      setError('企業を選択してください')
      return
    }
    setError('')
    setIsGenerating(true)
    setGeneratedSubject('')
    setGeneratedBody('')
    setGeneratedTips('')
    try {
      const res = await fetch('/api/doyalist/approach/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompanyId, projectId, type, tone }),
      })
      if (res.ok) {
        const data = await res.json()
        setGeneratedSubject(data.subject || '')
        setGeneratedBody(data.body || '')
        setGeneratedTips(data.tips || '')
      } else {
        const errData = await res.json().catch(() => ({}))
        setError(errData.error || '生成に失敗しました')
      }
    } catch (err) {
      setError('通信エラーが発生しました')
      console.error('アプローチ生成エラー:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleBulkGenerate = async () => {
    setError('')
    setIsBulkGenerating(true)
    setBulkTotal(companies.length)
    setBulkProgress(0)
    try {
      const res = await fetch('/api/doyalist/approach/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, type, tone }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setError(errData.error || '一括生成に失敗しました')
      } else {
        // Simulate progress since API may not stream progress
        setBulkProgress(companies.length)
      }
    } catch (err) {
      setError('通信エラーが発生しました')
      console.error('一括生成エラー:', err)
    } finally {
      setIsBulkGenerating(false)
    }
  }

  // Simulate bulk progress ticks while generating
  useEffect(() => {
    if (!isBulkGenerating || bulkTotal === 0) return
    const interval = setInterval(() => {
      setBulkProgress((prev) => {
        if (prev >= bulkTotal - 1) return prev
        return prev + 1
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [isBulkGenerating, bulkTotal])

  const handleCopy = () => {
    const text = [generatedSubject && `件名: ${generatedSubject}`, generatedBody].filter(Boolean).join('\n\n')
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasResult = generatedBody || generatedSubject

  return (
    <div className="min-h-screen bg-blue-50/30">
      {/* ===== Header ===== */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="bg-white px-6 lg:px-8 pt-8 pb-6 border-b border-slate-100"
      >
        <div className="max-w-5xl mx-auto">
          <Link
            href={`/doyalist/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-500 mb-4 transition-colors duration-200"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            プロジェクトに戻る
          </Link>

          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
            className="flex items-center gap-3"
          >
            <motion.div
              className="relative w-16 h-16 shrink-0"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Image
                src="/characters/point_解説.png"
                alt="アプローチ文面生成"
                width={64}
                height={64}
                className="object-contain"
              />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                アプローチ文面生成
              </h1>
              <p className="text-sm font-medium text-slate-500 mt-1">
                AIが企業ごとに最適な営業文面を自動生成します
              </p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ===== Main Content ===== */}
      <div className="px-6 lg:px-8 max-w-5xl mx-auto pt-6 pb-24">
        {/* Generation Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          className="bg-white rounded-3xl border border-slate-100 p-6 lg:p-8 mb-6 shadow-sm"
        >
          {/* Company Selector */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              <span className="material-symbols-outlined text-base align-middle mr-1 text-blue-500">apartment</span>
              対象企業を選択
            </label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200 bg-white"
            >
              <option value="">企業を選択してください</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}{c.industry ? ` (${c.industry})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Type Options */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-3">
              <span className="material-symbols-outlined text-base align-middle mr-1 text-blue-500">category</span>
              アプローチ種別
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {APPROACH_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className={`flex flex-col items-center gap-1.5 px-4 py-3.5 rounded-2xl border text-sm font-bold transition-all duration-200 ${
                    type === opt.value
                      ? 'border-blue-400 bg-blue-50 text-blue-600 shadow-sm shadow-blue-100/50'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tone Options */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-3">
              <span className="material-symbols-outlined text-base align-middle mr-1 text-blue-500">tune</span>
              トーン
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTone(opt.value)}
                  className={`flex flex-col items-start px-4 py-3.5 rounded-2xl border text-sm transition-all duration-200 ${
                    tone === opt.value
                      ? 'border-blue-400 bg-blue-50 text-blue-600 shadow-sm shadow-blue-100/50'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <span className="font-bold">{opt.label}</span>
                  <span className="text-xs font-medium opacity-70 mt-0.5">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-sm font-medium text-red-600 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedCompanyId}
              className="inline-flex items-center gap-2 px-7 py-3 bg-blue-500 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-200/50 hover:bg-blue-600 hover:shadow-blue-300/60 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isGenerating ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                  生成中...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">auto_awesome</span>
                  文面を生成
                </>
              )}
            </button>

            <button
              onClick={handleBulkGenerate}
              disabled={isBulkGenerating || companies.length === 0}
              className="inline-flex items-center gap-2 px-7 py-3 bg-white border border-slate-200 text-slate-600 font-bold text-sm rounded-full hover:bg-slate-50 hover:text-slate-700 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBulkGenerating ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                  一括生成中...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">dynamic_feed</span>
                  一括生成（全企業）
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Generating Animation - Enhanced */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center py-10 mb-6 bg-white/60 rounded-3xl border border-blue-100 backdrop-blur-sm"
            >
              <motion.div
                className="relative w-28 h-28"
                animate={{ rotate: [-10, 10, -10], y: [0, -10, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              >
                {/* Spinning ring around bear */}
                <motion.div
                  className="absolute inset-[-8px] border-3 border-blue-200 border-t-blue-500 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  style={{ borderWidth: '3px' }}
                />
                <Image
                  src="/characters/working_作業中.png"
                  alt="生成中"
                  width={112}
                  height={112}
                  className="object-contain"
                />
              </motion.div>
              {/* Typing dots */}
              <div className="flex items-center gap-1 mt-4">
                <span className="text-sm font-bold text-blue-600">AI執筆中</span>
                {[0, 1, 2].map((dotIndex) => (
                  <motion.span
                    key={dotIndex}
                    className="text-lg font-bold text-blue-500"
                    animate={{ opacity: showTypingDots > dotIndex ? 1 : 0.2 }}
                    transition={{ duration: 0.15 }}
                  >
                    .
                  </motion.span>
                ))}
              </div>
              {/* Progress bar flowing animation */}
              <div className="w-48 h-1.5 bg-blue-100 rounded-full mt-3 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400 rounded-full"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  style={{ width: '60%' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk Generating Progress */}
        <AnimatePresence>
          {isBulkGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center py-10 mb-6 bg-white/60 rounded-3xl border border-purple-100 backdrop-blur-sm"
            >
              <motion.div
                className="relative w-28 h-28"
                animate={{ rotate: [-10, 10, -10], y: [0, -8, 0] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              >
                <motion.div
                  className="absolute inset-[-8px] border-purple-200 border-t-purple-500 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  style={{ borderWidth: '3px', borderStyle: 'solid' }}
                />
                <Image
                  src="/characters/working_作業中.png"
                  alt="一括生成中"
                  width={112}
                  height={112}
                  className="object-contain"
                />
              </motion.div>
              <div className="flex items-center gap-2 mt-4">
                <span className="text-sm font-bold text-purple-600">一括生成中</span>
                {[0, 1, 2].map((dotIndex) => (
                  <motion.span
                    key={dotIndex}
                    className="text-lg font-bold text-purple-500"
                    animate={{ opacity: showTypingDots > dotIndex ? 1 : 0.2 }}
                    transition={{ duration: 0.15 }}
                  >
                    .
                  </motion.span>
                ))}
              </div>
              {/* Progress counter */}
              <div className="flex items-center gap-2 mt-3">
                <motion.span
                  key={bulkProgress}
                  initial={{ scale: 1.3, color: '#7c3aed' }}
                  animate={{ scale: 1, color: '#6b21a8' }}
                  className="text-2xl font-bold tabular-nums"
                >
                  {bulkProgress}
                </motion.span>
                <span className="text-sm text-slate-400 font-medium">/ {bulkTotal} 社完了</span>
              </div>
              {/* Progress bar */}
              <div className="w-56 h-2 bg-purple-100 rounded-full mt-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full"
                  animate={{ width: `${bulkTotal > 0 ? (bulkProgress / bulkTotal) * 100 : 0}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generated Result Display */}
        <AnimatePresence>
          {hasResult && !isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-3xl border border-blue-100 p-6 lg:p-8 mb-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 12, delay: 0.1 }}
                  >
                    <Image
                      src="/characters/success_成功.png"
                      alt="生成完了"
                      width={48}
                      height={48}
                      className="object-contain"
                    />
                  </motion.div>
                  <motion.h3
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-base font-bold text-slate-800"
                  >
                    生成結果
                  </motion.h3>
                </div>
                <motion.button
                  onClick={handleCopy}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full transition-all duration-200 ${
                    copied
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                  }`}
                  animate={copied ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <motion.span
                    className="material-symbols-outlined text-sm"
                    animate={copied ? { rotate: [0, 360] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    {copied ? 'check' : 'content_copy'}
                  </motion.span>
                  {copied ? 'コピーしました!' : 'コピー'}
                </motion.button>
              </div>

              {generatedSubject && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="mb-4"
                >
                  <span className="text-xs font-bold text-blue-500 uppercase tracking-wide">件名</span>
                  <p className="text-sm font-semibold text-slate-800 mt-1 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                    {generatedSubject}
                  </p>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="mb-4"
              >
                <span className="text-xs font-bold text-blue-500 uppercase tracking-wide">本文</span>
                <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed font-sans mt-1">
                  {generatedBody}
                </pre>
              </motion.div>

              {generatedTips && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.4 }}
                  className="bg-amber-50 border border-amber-100 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <motion.span
                      className="material-symbols-outlined text-base text-amber-500"
                      initial={{ rotate: -20, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ delay: 0.8, type: "spring", bounce: 0.5 }}
                    >
                      lightbulb
                    </motion.span>
                    <span className="text-xs font-bold text-amber-600">送信時のアドバイス</span>
                  </div>
                  <p className="text-sm text-amber-700 font-medium leading-relaxed">{generatedTips}</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State (when no companies loaded yet and not loading) */}
        {!isLoadingApproaches && companies.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center py-20 px-4"
          >
            <motion.div
              className="relative mb-6"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, rotate: [-3, 3, -3] }}
              transition={{
                rotate: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
                scale: { delay: 0.2, duration: 0.4, ease: 'easeOut' },
                opacity: { delay: 0.2, duration: 0.4 },
              }}
            >
              <Image
                src="/characters/thinking_考え中.png"
                alt="考え中"
                width={128}
                height={128}
                className="object-contain"
              />
            </motion.div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              まだ企業がありません
            </h3>
            <p className="text-sm text-slate-500 mb-6 text-center max-w-sm leading-relaxed">
              アプローチ文面を生成するには、先にプロジェクトに企業を追加してください。
            </p>
            <Link
              href={`/doyalist/projects/${projectId}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-200/50 hover:bg-blue-600 hover:shadow-blue-300/60 active:scale-[0.97] transition-all duration-200"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              プロジェクトに戻る
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  )
}
