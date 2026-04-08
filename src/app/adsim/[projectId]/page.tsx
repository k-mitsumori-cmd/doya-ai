'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Loader2,
  Download,
  ChevronLeft,
  Sparkles,
  Image as ImageIcon,
  MessageCircle,
  Send,
  Wand2,
  TrendingUp,
  MousePointerClick,
  Target as TargetIcon,
  Wallet,
  Eye,
  Globe,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ProposalSection {
  key: string
  title: string
  content: string
}

interface ChartData {
  budgetAllocation: { name: string; value: number }[]
  monthlyCv: Record<string, number | string>[]
  mediaPerformance: { name: string; impression: number; click: number; cv: number }[]
  funnel: { impression: number; click: number; cv: number }
  ogImage?: string | null
  lpAnalysis?: string
  recommendation?: string
  budgetRationale?: string
  cpaRationale?: string
  industryName?: string
  bannerImages?: string[]
}

interface SimOverall {
  monthlyBudget: number
  totalBudget: number
  totalImpression: number
  totalClick: number
  totalCv: number
  avgCpa: number
  avgRoas: number
}

interface AdSimProject {
  id: string
  name: string
  clientName: string
  industry: string
  productName: string
  monthlyBudget: number
  periodMonths: number
  status: string
  lpUrl: string | null
  goals: string[]
  simulationData: { overall: SimOverall; media: any[] } | null
  proposalText: ProposalSection[] | null
  chartData: ChartData | null
}

const COLORS = ['#0017C1', '#3460FB', '#7096F8', '#C5D7FB', '#00A3BF', '#2BC8E4']

export default function AdSimProjectPage() {
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const { data: session, status } = useSession()
  const isSessionLoading = status === 'loading'
  const isLoggedIn = !!session?.user
  const [project, setProject] = useState<AdSimProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingBanners, setGeneratingBanners] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatProcessing, setChatProcessing] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isSessionLoading && !isLoggedIn) {
      router.replace(`/auth/signin?callbackUrl=/adsim/${params.projectId}`)
    }
  }, [isSessionLoading, isLoggedIn, router, params.projectId])

  const fetchProject = () => {
    if (!isLoggedIn) return
    fetch(`/api/adsim/projects/${params.projectId}`)
      .then((r) => r.json())
      .then((d) => setProject(d.project))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchProject()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId, isLoggedIn])

  const handleGenerateBanners = async () => {
    setGeneratingBanners(true)
    toast.loading('NanoBanana がバナー画像3枚を生成中... (約30〜60秒)', { id: 'banners' })
    try {
      const res = await fetch(`/api/adsim/projects/${params.projectId}/banners`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'バナー生成に失敗しました')
      }
      toast.success('バナー画像 3枚を生成しました', { id: 'banners' })
      fetchProject()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'バナー生成に失敗', { id: 'banners' })
    } finally {
      setGeneratingBanners(false)
    }
  }

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatProcessing) return
    const userText = chatInput.trim()
    setChatMessages((prev) => [...prev, { role: 'user', text: userText }])
    setChatInput('')
    setChatProcessing(true)
    try {
      const res = await fetch(`/api/adsim/projects/${params.projectId}/chat-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '編集に失敗しました')
      }
      const data = await res.json()
      setChatMessages((prev) => [...prev, { role: 'ai', text: data.summary || '数値を更新しました' }])
      fetchProject()
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'ai', text: `エラー: ${err instanceof Error ? err.message : '失敗'}` },
      ])
    } finally {
      setChatProcessing(false)
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' })
      }, 100)
    }
  }

  if (isSessionLoading || !isLoggedIn || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F8FB]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0017C1]" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F8FB]">
        <p className="text-slate-600">プロジェクトが見つかりません</p>
      </div>
    )
  }

  const chart = project.chartData
  const overall = project.simulationData?.overall
  const sections = project.proposalText || []
  const ogImage = chart?.ogImage
  const bannerImages = chart?.bannerImages || []

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8F8FB]">
      {/* Animated background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-[#3460FB] opacity-15 blur-3xl"
          animate={{ x: [0, 80, -50, 0], y: [0, 60, -40, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-40 top-1/2 h-[500px] w-[500px] rounded-full bg-[#7096F8] opacity-15 blur-3xl"
          animate={{ x: [0, -100, 60, 0], y: [0, 80, -50, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/adsim" className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-[#0017C1]">
            <ChevronLeft className="h-4 w-4" />
            ダッシュボード
          </Link>
          <div className="flex flex-wrap gap-2">
            <DownloadBtn href={`/api/adsim/projects/${project.id}/export?format=pdf`} label="PDF" primary />
            <DownloadBtn href={`/api/adsim/projects/${project.id}/export?format=pptx`} label="PPTX" />
            <DownloadBtn href={`/api/adsim/projects/${project.id}/export?format=xlsx`} label="Excel" />
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        {/* === LP ファーストビュー === */}
        {ogImage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-[#0017C1]/10"
          >
            <div className="relative aspect-[2/1] w-full bg-gradient-to-br from-slate-100 to-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ogImage}
                alt={project.clientName}
                className="h-full w-full object-cover"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                  <Globe className="h-3 w-3" />
                  解析対象 LP
                </div>
                <h1 className="mb-2 text-3xl font-black tracking-tight text-white md:text-5xl">
                  {project.clientName}
                </h1>
                <p className="text-base font-bold text-white/90 md:text-lg">
                  {project.productName}
                </p>
                {project.lpUrl && (
                  <a
                    href={project.lpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-white/70 hover:text-white"
                  >
                    {project.lpUrl}
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* === ヘッダー（ogImage 無い場合） === */}
        {!ogImage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0017C1] via-[#3460FB] to-[#000060] p-10 text-white shadow-2xl"
          >
            <h1 className="mb-2 text-4xl font-black">{project.clientName}</h1>
            <p className="text-lg font-bold opacity-90">{project.productName}</p>
          </motion.div>
        )}

        {/* === 提案概要 === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-8 grid gap-4 md:grid-cols-3"
        >
          <InfoBox label="業種" value={chart?.industryName || project.industry} />
          <InfoBox label="月額予算" value={`¥${project.monthlyBudget.toLocaleString()}`} />
          <InfoBox label="提案期間" value={`${project.periodMonths}ヶ月`} />
        </motion.div>

        {/* === LP 分析 === */}
        {chart?.lpAnalysis && (
          <Section
            delay={0.3}
            icon={<Eye className="h-5 w-5" />}
            title="LP 分析"
            subtitle="このランディングページから読み取れる強み・訴求点・課題"
          >
            <p className="whitespace-pre-wrap text-base font-medium leading-loose tracking-wide text-slate-700">
              {chart.lpAnalysis}
            </p>
          </Section>
        )}

        {/* === このLPから、このような広告運用を行います === */}
        {chart?.recommendation && (
          <Section
            delay={0.4}
            icon={<Sparkles className="h-5 w-5" />}
            title="このLPから、このような広告運用を行います"
            subtitle="AI シニアプランナーによる戦略提案"
            highlight
          >
            <p className="whitespace-pre-wrap text-base font-bold leading-loose tracking-wide text-slate-800">
              {chart.recommendation}
            </p>
          </Section>
        )}

        {/* 免責 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900"
        >
          ※ 本数値はAIおよび業界平均ベンチマークに基づく推定値であり、実際の広告運用結果を保証するものではありません。
        </motion.div>

        {/* === KPI サマリ === */}
        {overall && (
          <motion.div
            className="mb-10"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } } }}
            initial="hidden"
            animate="visible"
          >
            <SectionTitle icon={<TrendingUp className="h-5 w-5" />} title="シミュレーション結果（全体）" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <KpiTile label="総予算" value={`¥${overall.totalBudget.toLocaleString()}`} icon={Wallet} />
              <KpiTile label="Impression" value={overall.totalImpression.toLocaleString()} icon={Eye} />
              <KpiTile label="Click" value={overall.totalClick.toLocaleString()} icon={MousePointerClick} />
              <KpiTile label="CV" value={overall.totalCv.toLocaleString()} icon={TargetIcon} />
              <KpiTile label="平均CPA" value={`¥${overall.avgCpa.toLocaleString()}`} icon={Wallet} />
              <KpiTile label="平均ROAS" value={`${overall.avgRoas}%`} icon={TrendingUp} />
            </div>
          </motion.div>
        )}

        {/* === グラフ（グラデーション SVG） === */}
        {chart && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="mb-10 grid gap-6 md:grid-cols-2"
          >
            <ChartCard title="予算配分">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <defs>
                    {COLORS.map((c, i) => (
                      <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={1} />
                        <stop offset="100%" stopColor={c} stopOpacity={0.6} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={chart.budgetAllocation}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={100}
                    innerRadius={50}
                    paddingAngle={3}
                    label={(e: any) => `¥${(e.value / 10000).toFixed(0)}万`}
                    labelLine={false}
                  >
                    {chart.budgetAllocation.map((_, i) => (
                      <Cell key={i} fill={`url(#pieGrad${i % COLORS.length})`} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`¥${value.toLocaleString()}`, '予算']}
                    contentStyle={{ borderRadius: 12, border: '1px solid #C5D7FB', fontWeight: 700 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="媒体別パフォーマンス">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chart.mediaPerformance} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="barGradClick" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3460FB" stopOpacity={1} />
                      <stop offset="100%" stopColor="#7096F8" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="barGradCv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0017C1" stopOpacity={1} />
                      <stop offset="100%" stopColor="#3460FB" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 11, fontWeight: 700 }} />
                  <Tooltip
                    formatter={(value: number) => value.toLocaleString()}
                    contentStyle={{ borderRadius: 12, border: '1px solid #C5D7FB', fontWeight: 700 }}
                  />
                  <Legend wrapperStyle={{ fontWeight: 700, fontSize: 12 }} />
                  <Bar dataKey="click" name="Click" fill="url(#barGradClick)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="cv" name="CV" fill="url(#barGradCv)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="月次CV推移" className="md:col-span-2">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chart.monthlyCv} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                  <defs>
                    {COLORS.map((c, i) => (
                      <linearGradient key={i} id={`lineGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={c} />
                        <stop offset="100%" stopColor={COLORS[(i + 1) % COLORS.length]} />
                      </linearGradient>
                    ))}
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
                  <Tooltip
                    formatter={(value: number) => value.toLocaleString()}
                    contentStyle={{ borderRadius: 12, border: '1px solid #C5D7FB', fontWeight: 700 }}
                  />
                  <Legend wrapperStyle={{ fontWeight: 700, fontSize: 12 }} />
                  {chart.mediaPerformance.map((m, i) => (
                    <Line
                      key={m.name}
                      type="monotone"
                      dataKey={m.name}
                      stroke={`url(#lineGrad${i % COLORS.length})`}
                      strokeWidth={3}
                      dot={{ r: 5, strokeWidth: 2, fill: 'white' }}
                      activeDot={{ r: 7 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </motion.div>
        )}

        {/* === 予算配分の根拠 === */}
        {chart?.budgetRationale && (
          <Section
            delay={0.8}
            icon={<Wallet className="h-5 w-5" />}
            title="予算配分の根拠"
            subtitle="なぜこの媒体ミックスにしたのか"
          >
            <p className="whitespace-pre-wrap text-base font-medium leading-loose tracking-wide text-slate-700">
              {chart.budgetRationale}
            </p>
          </Section>
        )}

        {/* === CPA / CV の根拠 === */}
        {chart?.cpaRationale && (
          <Section
            delay={0.85}
            icon={<TargetIcon className="h-5 w-5" />}
            title="平均CPA・CVの根拠"
            subtitle="目標値の算定根拠"
          >
            <p className="whitespace-pre-wrap text-base font-medium leading-loose tracking-wide text-slate-700">
              {chart.cpaRationale}
            </p>
          </Section>
        )}

        {/* === 提案内容セクション === */}
        {sections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="mb-10"
          >
            <SectionTitle icon={<Sparkles className="h-5 w-5" />} title="提案内容（全 10 セクション）" />
            <div className="space-y-4">
              {sections.map((sec, i) => (
                <motion.div
                  key={sec.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.0 + i * 0.05 }}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <h3 className="mb-3 text-lg font-black text-[#0017C1]">{sec.title}</h3>
                  <p className="whitespace-pre-wrap text-sm font-medium leading-loose tracking-wide text-slate-700">
                    {sec.content}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* === NanoBanana バナー画像生成 === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          className="mb-10 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-[#F8F8FB] to-[#D9E6FF]/40 p-8 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                <ImageIcon className="h-5 w-5 text-[#0017C1]" />
                NanoBanana AI Pro バナー画像
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-600">
                提案内容に合わせた正方形バナーを 3枚 自動生成
              </p>
            </div>
            <motion.button
              type="button"
              onClick={handleGenerateBanners}
              disabled={generatingBanners}
              whileHover={{ scale: generatingBanners ? 1 : 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0017C1] to-[#3460FB] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#0017C1]/30 disabled:opacity-50"
            >
              {generatingBanners ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> 生成中...
                </>
              ) : bannerImages.length > 0 ? (
                <>
                  <Wand2 className="h-4 w-4" /> 再生成
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> 3枚生成
                </>
              )}
            </motion.button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {bannerImages.length > 0
              ? bannerImages.map((src, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Banner ${i + 1}`} className="h-full w-full object-cover transition group-hover:scale-105" />
                    <a
                      href={src}
                      download={`banner-${i + 1}.png`}
                      className="absolute bottom-2 right-2 rounded-full bg-[#0017C1] p-2 text-white opacity-0 shadow-lg transition group-hover:opacity-100"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </motion.div>
                ))
              : [0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/50"
                  >
                    <span className="text-xs font-bold text-slate-400">バナー {i + 1}</span>
                  </div>
                ))}
          </div>
        </motion.div>

        {/* === チャット形式数値編集 === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="mb-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-200 bg-gradient-to-r from-[#0017C1] to-[#3460FB] p-5 text-white">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <MessageCircle className="h-5 w-5" />
              チャットで数値を調整
            </h2>
            <p className="mt-1 text-xs font-medium text-white/80">
              「Google の予算を増やして」「CPA を 5000 に下げて」のように入力 → AI が自動で再計算
            </p>
          </div>

          <div ref={chatScrollRef} className="max-h-96 space-y-3 overflow-y-auto p-5">
            {chatMessages.length === 0 && (
              <div className="py-6 text-center text-sm font-medium text-slate-400">
                例: 「Meta の配分を 50% にして」「CV 数を 1.5 倍に」「Google を減らして TikTok を増やして」
              </div>
            )}
            <AnimatePresence>
              {chatMessages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-medium leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-gradient-to-br from-[#0017C1] to-[#3460FB] text-white shadow-md'
                        : 'border border-slate-200 bg-slate-50 text-slate-800'
                    }`}
                  >
                    {m.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {chatProcessing && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-[#0017C1]" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleChatSend()
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="例: Google の予算を 60% に増やして"
                disabled={chatProcessing}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium focus:border-[#0017C1] focus:outline-none focus:ring-2 focus:ring-[#0017C1]/20 disabled:bg-slate-50"
              />
              <motion.button
                type="submit"
                disabled={chatProcessing || !chatInput.trim()}
                whileHover={{ scale: chatProcessing ? 1 : 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-[#0017C1] to-[#3460FB] px-5 py-3 text-sm font-bold text-white shadow-md disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                送信
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ----------------------------------------
// Components
// ----------------------------------------

function DownloadBtn({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <motion.a
      href={href}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition ${
        primary
          ? 'bg-gradient-to-r from-[#0017C1] to-[#3460FB] text-white shadow-lg shadow-[#0017C1]/30 hover:shadow-xl'
          : 'border border-[#C5D7FB] bg-white text-[#0017C1] hover:bg-[#D9E6FF]'
      }`}
    >
      <Download className="h-4 w-4" />
      {label}
    </motion.a>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-900">{value}</div>
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D9E6FF] text-[#0017C1]">
        {icon}
      </div>
      <h2 className="text-xl font-black tracking-tight text-slate-900">{title}</h2>
    </div>
  )
}

function Section({
  delay,
  icon,
  title,
  subtitle,
  highlight,
  children,
}: {
  delay: number
  icon: React.ReactNode
  title: string
  subtitle?: string
  highlight?: boolean
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      className={`mb-8 rounded-3xl border p-8 shadow-sm ${
        highlight
          ? 'border-[#0017C1]/20 bg-gradient-to-br from-white via-[#D9E6FF]/30 to-white'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            highlight ? 'bg-gradient-to-br from-[#0017C1] to-[#3460FB] text-white shadow-lg shadow-[#0017C1]/30' : 'bg-[#D9E6FF] text-[#0017C1]'
          }`}
        >
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs font-medium text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </motion.div>
  )
}

function KpiTile({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-xl hover:shadow-[#0017C1]/10"
    >
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-[#D9E6FF] to-transparent opacity-50" />
      <div className="relative">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Icon className="h-3 w-3" />
          {label}
        </div>
        <div className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">{value}</div>
      </div>
    </motion.div>
  )
}

function ChartCard({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-700">{title}</h3>
      {children}
    </div>
  )
}
