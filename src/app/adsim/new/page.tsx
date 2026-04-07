'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  Loader2,
  Sparkles,
  Wand2,
  Globe,
  Wallet,
  Brain,
  CheckCircle2,
} from 'lucide-react'

const SAMPLE_LP = 'https://www.shiseido.co.jp/sw/products/SWFG020201.jsp?SHOHIN_CD=11003'
const SAMPLE_BUDGET = 800000

export default function AdSimNewPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isSessionLoading = status === 'loading'
  const isLoggedIn = !!session?.user

  useEffect(() => {
    if (!isSessionLoading && !isLoggedIn) {
      router.replace('/auth/signin?callbackUrl=/adsim/new')
    }
  }, [isSessionLoading, isLoggedIn, router])

  const [lpUrl, setLpUrl] = useState('')
  const [monthlyBudget, setMonthlyBudget] = useState(500000)
  const [periodMonths, setPeriodMonths] = useState(3)
  const [submitting, setSubmitting] = useState(false)
  const [progressStep, setProgressStep] = useState<'idle' | 'analyzing' | 'simulating' | 'writing' | 'done'>('idle')

  const fillSample = () => {
    setLpUrl(SAMPLE_LP)
    setMonthlyBudget(SAMPLE_BUDGET)
    setPeriodMonths(3)
    toast.success('サンプルを入力しました')
  }

  const submit = async () => {
    if (!lpUrl) {
      toast.error('LP URL を入力してください')
      return
    }
    try {
      new URL(lpUrl)
    } catch {
      toast.error('URL の形式が不正です')
      return
    }
    if (monthlyBudget <= 0) {
      toast.error('月額予算を入力してください')
      return
    }

    setSubmitting(true)
    setProgressStep('analyzing')
    toast.loading('LPを解析中... AIがマーケのプロとして提案を作成します', { id: 'auto', duration: Infinity })

    try {
      // 進捗の見せ方: API は1リクエスト完結だが、内部処理を段階的に演出
      const stepTimer = setTimeout(() => setProgressStep('simulating'), 8000)
      const stepTimer2 = setTimeout(() => setProgressStep('writing'), 18000)

      const res = await fetch('/api/adsim/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lpUrl, monthlyBudget, periodMonths }),
      })

      clearTimeout(stepTimer)
      clearTimeout(stepTimer2)

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '生成に失敗しました')
      }
      const data = await res.json()
      setProgressStep('done')
      toast.success('生成完了！結果ページへ移動します', { id: 'auto', duration: 2000 })
      setTimeout(() => router.push(`/adsim/${data.projectId}`), 800)
    } catch (err) {
      console.error(err)
      setProgressStep('idle')
      toast.error(err instanceof Error ? err.message : '生成に失敗しました', { id: 'auto', duration: 5000 })
    } finally {
      setSubmitting(false)
    }
  }

  if (isSessionLoading || !isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F8FB]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0017C1]" />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8F8FB]">
      {/* Animated background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-[#3460FB] opacity-20 blur-3xl"
          animate={{ x: [0, 100, -50, 0], y: [0, 80, -40, 0], scale: [1, 1.2, 0.9, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-32 top-1/2 h-[450px] w-[450px] rounded-full bg-[#7096F8] opacity-20 blur-3xl"
          animate={{ x: [0, -80, 60, 0], y: [0, 100, -50, 0], scale: [1, 0.9, 1.15, 1] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-20 left-1/3 h-72 w-72 rounded-full bg-[#0017C1] opacity-15 blur-3xl"
          animate={{ x: [0, 90, -60, 0], y: [0, -70, 50, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/adsim" className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            <ChevronLeft className="h-4 w-4" />
            ダッシュボード
          </Link>
          <button
            type="button"
            onClick={fillSample}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#0017C1]/20 bg-[#D9E6FF] px-3 py-1.5 text-xs font-semibold text-[#0017C1] transition hover:bg-[#C5D7FB] disabled:opacity-50"
          >
            <Wand2 className="h-3.5 w-3.5" />
            サンプルで埋める
          </button>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10 text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0017C1]/20 bg-[#D9E6FF] px-4 py-1.5 text-xs font-semibold text-[#0017C1] shadow-sm"
          >
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="h-3 w-3" />
            </motion.div>
            AI がマーケのプロとして全部考えます
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mb-3 text-4xl font-bold leading-tight text-slate-900 md:text-6xl"
          >
            LP と予算を<br className="md:hidden" />
            <span className="bg-gradient-to-r from-[#0017C1] to-[#3460FB] bg-clip-text text-transparent">入れるだけ。</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-base text-slate-600"
          >
            業種・ターゲット・KPI・媒体配分・提案文10セクション・グラフ・シミュレーション —<br />
            <strong className="text-[#0017C1]">全部 AI が判断して 1〜3分で完成</strong>します。
          </motion.p>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-2xl shadow-[#0017C1]/5 backdrop-blur"
        >
          {/* Top accent line */}
          <motion.div
            className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-[#0017C1] via-[#3460FB] to-[#0017C1]"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: 'left' }}
          />
          {/* LP URL */}
          <div className="mb-6">
            <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
              <Globe className="h-4 w-4 text-[#0017C1]" />
              提案先のクライアントの LP URL
              <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={lpUrl}
              onChange={(e) => setLpUrl(e.target.value)}
              placeholder="https://example.com/product"
              disabled={submitting}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-[#0017C1] focus:outline-none focus:ring-2 focus:ring-[#0017C1]/20 disabled:bg-slate-50"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              AI がこの LP を読み取り、業種・商材・ターゲットを自動で判断します
            </p>
          </div>

          {/* 月額予算 */}
          <div className="mb-6">
            <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
              <Wallet className="h-4 w-4 text-[#0017C1]" />
              月額予算（円）
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">¥</span>
              <input
                type="number"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                disabled={submitting}
                className="w-full rounded-lg border border-slate-300 py-3 pl-8 pr-4 text-base focus:border-[#0017C1] focus:outline-none focus:ring-2 focus:ring-[#0017C1]/20 disabled:bg-slate-50"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[300000, 500000, 1000000, 3000000, 5000000].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setMonthlyBudget(b)}
                  disabled={submitting}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    monthlyBudget === b
                      ? 'border-[#0017C1] bg-[#0017C1] text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-[#0017C1]'
                  }`}
                >
                  ¥{(b / 10000).toLocaleString()}万
                </button>
              ))}
            </div>
          </div>

          {/* 期間 */}
          <div className="mb-8">
            <label className="mb-2 block text-sm font-bold text-slate-700">提案期間</label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 6, 12].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodMonths(p)}
                  disabled={submitting}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                    periodMonths === p
                      ? 'border-[#0017C1] bg-[#D9E6FF] text-[#0017C1]'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-[#0017C1]'
                  }`}
                >
                  {p}ヶ月
                </button>
              ))}
            </div>
          </div>

          {/* 進捗表示 */}
          {submitting && (
            <div className="mb-6 rounded-xl border border-[#0017C1]/20 bg-[#D9E6FF]/50 p-5">
              <div className="space-y-3">
                <ProgressItem
                  active={progressStep === 'analyzing'}
                  done={['simulating', 'writing', 'done'].includes(progressStep)}
                  icon={Brain}
                  label="LP を解析・業種とターゲットを判断中..."
                />
                <ProgressItem
                  active={progressStep === 'simulating'}
                  done={['writing', 'done'].includes(progressStep)}
                  icon={Sparkles}
                  label="媒体配分・KPI・シミュレーション数値を算出中..."
                />
                <ProgressItem
                  active={progressStep === 'writing'}
                  done={progressStep === 'done'}
                  icon={Wand2}
                  label="提案文10セクションを執筆中..."
                />
              </div>
            </div>
          )}

          {/* CTA */}
          <motion.button
            type="button"
            onClick={submit}
            disabled={submitting || !lpUrl || monthlyBudget <= 0}
            whileHover={{ scale: submitting ? 1 : 1.02, y: submitting ? 0 : -2 }}
            whileTap={{ scale: submitting ? 1 : 0.98 }}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#0017C1] via-[#3460FB] to-[#0017C1] bg-[length:200%_100%] px-6 py-5 text-base font-bold text-white shadow-2xl shadow-[#0017C1]/40 transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundPosition: submitting ? '0% 50%' : '0% 50%' }}
          >
            {/* Animated gradient sweep */}
            {!submitting && (
              <motion.span
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
              />
            )}
            <AnimatePresence mode="wait">
              {submitting ? (
                <motion.span
                  key="loading"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="relative flex items-center gap-2"
                >
                  <Loader2 className="h-5 w-5 animate-spin" />
                  AI が考えています...
                </motion.span>
              ) : (
                <motion.span
                  key="ready"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="relative flex items-center gap-2"
                >
                  <motion.div
                    animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Sparkles className="h-5 w-5" />
                  </motion.div>
                  AI に全部任せて生成する
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
          <p className="mt-3 text-center text-xs text-slate-500">
            生成には 1〜3分かかります（LP 解析 + Gemini 提案文10セクション）
          </p>
        </motion.div>

        {/* 説明 */}
        <motion.div
          className="mt-8 grid gap-4 md:grid-cols-3"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12, delayChildren: 0.7 } } }}
          initial="hidden"
          animate="visible"
        >
          <InfoCard num="01" title="LPを解析" desc="cheerioで本文を読み込み、Geminiが商材を理解" />
          <InfoCard num="02" title="戦略を立案" desc="シニアプランナーとして業種・媒体配分を判断" />
          <InfoCard num="03" title="資料を生成" desc="シミュレーション + 提案文10セクション + グラフ" />
        </motion.div>
      </div>
    </div>
  )
}

function ProgressItem({
  active,
  done,
  icon: Icon,
  label,
}: {
  active: boolean
  done: boolean
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition ${
          done
            ? 'bg-[#0017C1] text-white'
            : active
              ? 'bg-[#0017C1] text-white'
              : 'bg-slate-200 text-slate-400'
        }`}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </div>
      <span
        className={`text-sm ${
          done ? 'text-slate-700 line-through' : active ? 'font-semibold text-[#0017C1]' : 'text-slate-400'
        }`}
      >
        {label}
      </span>
    </div>
  )
}

function InfoCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-5 backdrop-blur transition-shadow hover:shadow-xl hover:shadow-[#0017C1]/10"
    >
      <motion.div
        className="absolute -top-8 -right-4 text-7xl font-black text-[#D9E6FF]/60"
        initial={{ opacity: 0, rotate: -10 }}
        whileInView={{ opacity: 1, rotate: 0 }}
        transition={{ duration: 0.5 }}
      >
        {num}
      </motion.div>
      <div className="relative">
        <div className="mb-2 text-xs font-bold tracking-wider text-[#0017C1]">{num}</div>
        <h3 className="mb-1 text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-xs leading-relaxed text-slate-600">{desc}</p>
      </div>
    </motion.div>
  )
}
