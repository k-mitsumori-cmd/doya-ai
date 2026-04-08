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
  ChevronDown,
  FileText,
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
  targetAudience: { age?: string; gender?: string; region?: string; interests?: string[] } | null
  mediaAllocation: Record<string, number> | null
  simulationData: { overall: SimOverall; media: any[] } | null
  proposalText: ProposalSection[] | null
  chartData: ChartData | null
}

// 中明度〜中濃度の青系カラーパレット（濃すぎず・薄すぎず）
const COLORS = [
  '#0023D6', // 明るい primary
  '#1F4DFF', // bright
  '#3460FB', // 中
  '#5575FC', // 中明
  '#0017C1', // やや濃い
  '#4A6BFC', // 中
]

export default function AdSimProjectPage() {
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const { data: session, status } = useSession()
  const isSessionLoading = status === 'loading'
  const isLoggedIn = !!session?.user
  const [project, setProject] = useState<AdSimProject | null>(null)
  const [userPlan, setUserPlan] = useState<string>('FREE')
  const [usage, setUsage] = useState<{ bannerToday: number; chatToday: number }>({ bannerToday: 0, chatToday: 0 })
  const [loading, setLoading] = useState(true)
  const [generatingBanners, setGeneratingBanners] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
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
      .then((d) => {
        setProject(d.project)
        if (d.userPlan) setUserPlan(d.userPlan)
        if (d.usage) setUsage(d.usage)
      })
      .finally(() => setLoading(false))
  }

  const isFree = userPlan === 'FREE'
  const bannerDailyLimit = isFree ? 2 : userPlan === 'LIGHT' ? 10 : -1
  const chatDailyLimit = isFree ? 5 : userPlan === 'LIGHT' ? 30 : -1
  const bannerRemaining = bannerDailyLimit === -1 ? -1 : Math.max(0, bannerDailyLimit - usage.bannerToday)
  const chatRemaining = chatDailyLimit === -1 ? -1 : Math.max(0, chatDailyLimit - usage.chatToday)

  useEffect(() => {
    fetchProject()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId, isLoggedIn])

  const handleGenerateBanners = async () => {
    if (!confirm(`バナー画像を3枚生成します。\n本日の残り回数: ${bannerRemaining === -1 ? '無制限' : `${bannerRemaining}回`}\n\n実行しますか？`)) {
      return
    }
    setGeneratingBanners(true)
    toast.loading('NanoBanana AI Pro がバナー画像3枚を生成中... (約30〜60秒)', { id: 'banners' })
    try {
      const res = await fetch(`/api/adsim/projects/${params.projectId}/banners`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (err.code === 'BANNER_DAILY_LIMIT') {
          toast.error(err.error || '本日の上限に達しました', { id: 'banners', duration: 6000 })
          return
        }
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
    setTimeout(() => chatScrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)
    try {
      const res = await fetch(`/api/adsim/projects/${params.projectId}/chat-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (err.code === 'CHAT_DAILY_LIMIT') {
          setChatMessages((prev) => [
            ...prev,
            { role: 'ai', text: `⚠ ${err.error}` },
          ])
          return
        }
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
      setTimeout(() => chatScrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 100)
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
  const summarySection = sections.find((s) => s.key === 'summary')

  // 提案サマリ: proposal の summary か、recommendation の最初2文か
  const executiveSummary =
    summarySection?.content ||
    (chart?.recommendation ? chart.recommendation.split('。').slice(0, 3).join('。') + '。' : '')

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8F8FB] pb-32">
      {/* Animated background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-[#3460FB] opacity-15 blur-3xl"
          animate={{ x: [0, 80, -50, 0], y: [0, 60, -40, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-40 top-1/2 h-[500px] w-[500px] rounded-full bg-[#0017C1] opacity-15 blur-3xl"
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
        {/* === ヘッダー（クライアント名）=== */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0017C1] to-[#3460FB] px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-[#0017C1]/20">
            <Sparkles className="h-3 w-3" />
            AI 広告提案レポート
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            {project.clientName}
          </h1>
          <p className="mt-2 text-lg font-bold text-slate-600">
            {project.productName}
          </p>
        </motion.div>

        {/* === LP ファーストビュー画像（クライアント名の下） === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-[#0017C1]/10"
        >
          <div className="border-b border-slate-100 bg-gradient-to-r from-[#0017C1] to-[#3460FB] px-6 py-3 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Globe className="h-4 w-4" />
                解析対象 LP のファーストビュー
              </div>
              {project.lpUrl && (
                <a
                  href={project.lpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-white/90 hover:text-white"
                >
                  {project.lpUrl.length > 50 ? project.lpUrl.substring(0, 50) + '...' : project.lpUrl}
                </a>
              )}
            </div>
          </div>
          <div className="relative aspect-[2/1] w-full bg-gradient-to-br from-slate-100 to-slate-200">
            {ogImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ogImage}
                alt={project.clientName}
                className="h-full w-full object-cover"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                  <Globe className="mx-auto mb-2 h-12 w-12 text-slate-300" />
                  <p className="text-sm font-bold text-slate-400">LP 画像取得失敗</p>
                  <p className="mt-1 text-xs text-slate-400">OG 画像が設定されていない可能性があります</p>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-xs font-bold text-slate-600">
              ↑ 上記 LP を AI が解析し、以下の戦略・数値・提案文を生成しました
            </p>
          </div>
        </motion.div>

        {/* === 提案概要（業種・予算・期間） === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-6 grid gap-4 md:grid-cols-3"
        >
          <InfoBox label="業種" value={chart?.industryName || project.industry} />
          <InfoBox label="月額予算" value={`¥${project.monthlyBudget.toLocaleString()}`} />
          <InfoBox label="提案期間" value={`${project.periodMonths}ヶ月`} />
        </motion.div>

        {/* === 提案サマリ（具体的に何を提案するか） === */}
        {executiveSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="mb-8 overflow-hidden rounded-3xl border-2 border-[#0017C1]/30 bg-gradient-to-br from-[#0017C1] via-[#1F3CFF] to-[#3460FB] p-1 shadow-2xl shadow-[#0017C1]/30"
          >
            <div className="rounded-[22px] bg-white p-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0017C1] to-[#3460FB] text-white shadow-lg shadow-[#0017C1]/30">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">提案サマリ</h2>
                  <p className="text-xs font-bold text-slate-500">どんな状況・どんな広告運用を提案するか</p>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-base font-bold leading-loose tracking-wide text-slate-800">
                {executiveSummary}
              </p>
            </div>
          </motion.div>
        )}

        {/* === LP 分析 === */}
        {chart?.lpAnalysis && (
          <Section
            delay={0.3}
            icon={<Eye className="h-5 w-5" />}
            title="LP 分析"
            subtitle="このランディングページから読み取れる強み・訴求点・課題"
          >
            <p className="whitespace-pre-wrap text-base font-bold leading-loose tracking-wide text-slate-700">
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
            <p className="whitespace-pre-wrap text-base font-black leading-loose tracking-wide text-slate-900">
              {chart.recommendation}
            </p>
          </Section>
        )}

        {/* 免責 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900"
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

        {/* === グラフ（リーダーライン付き円グラフ + 棒 + 線） === */}
        {chart && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="mb-10 grid gap-6 md:grid-cols-2"
          >
            {/* 予算配分 - リーダーライン付き */}
            <ChartCard title="予算配分" className="md:col-span-2">
              <ResponsiveContainer width="100%" height={420}>
                <PieChart margin={{ top: 30, right: 100, bottom: 30, left: 100 }}>
                  <defs>
                    {COLORS.map((c, i) => (
                      <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={1} />
                        <stop offset="100%" stopColor={i === 0 ? '#000060' : COLORS[Math.max(0, i - 1)]} stopOpacity={1} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={chart.budgetAllocation}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    innerRadius={60}
                    paddingAngle={3}
                    label={(props: any) => renderPieLabel(props, chart.budgetAllocation)}
                    labelLine={{ stroke: '#94a3b8', strokeWidth: 1.5 }}
                  >
                    {chart.budgetAllocation.map((_, i) => (
                      <Cell key={i} fill={`url(#pieGrad${i % COLORS.length})`} stroke="white" strokeWidth={3} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`¥${value.toLocaleString()}`, name]}
                    contentStyle={{ borderRadius: 12, border: '2px solid #0017C1', fontWeight: 800 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="媒体別パフォーマンス">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chart.mediaPerformance} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="barGradClick" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#000060" stopOpacity={1} />
                      <stop offset="100%" stopColor="#0017C1" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="barGradCv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1F3CFF" stopOpacity={1} />
                      <stop offset="100%" stopColor="#3460FB" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 800, fill: '#1f2937' }} />
                  <YAxis tick={{ fontSize: 11, fontWeight: 800, fill: '#1f2937' }} />
                  <Tooltip
                    formatter={(value: number) => value.toLocaleString()}
                    contentStyle={{ borderRadius: 12, border: '2px solid #0017C1', fontWeight: 800 }}
                  />
                  <Legend wrapperStyle={{ fontWeight: 800, fontSize: 12 }} />
                  <Bar dataKey="click" name="Click" fill="url(#barGradClick)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="cv" name="CV" fill="url(#barGradCv)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="月次CV推移">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chart.monthlyCv} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 800, fill: '#1f2937' }} />
                  <YAxis tick={{ fontSize: 12, fontWeight: 800, fill: '#1f2937' }} />
                  <Tooltip
                    formatter={(value: number) => value.toLocaleString()}
                    contentStyle={{ borderRadius: 12, border: '2px solid #0017C1', fontWeight: 800 }}
                  />
                  <Legend wrapperStyle={{ fontWeight: 800, fontSize: 12 }} />
                  {chart.mediaPerformance.map((m, i) => (
                    <Line
                      key={m.name}
                      type="monotone"
                      dataKey={m.name}
                      stroke={COLORS[i % COLORS.length]}
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
            <p className="whitespace-pre-wrap text-base font-bold leading-loose tracking-wide text-slate-700">
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
            <p className="whitespace-pre-wrap text-base font-bold leading-loose tracking-wide text-slate-700">
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
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-[#D9E6FF]/40 to-transparent px-6 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0023D6] to-[#3460FB] text-white shadow-md">
                      <span className="text-xs font-black">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <h3 className="text-lg font-black text-[#0017C1]">{sec.title}</h3>
                  </div>
                  <div className="p-6">
                    {/* 特別レイアウト: ターゲティング */}
                    {sec.key === 'targeting' && project ? (
                      <TargetingVisual content={sec.content} project={project} />
                    ) : sec.key === 'creative' ? (
                      <CreativeVisual content={sec.content} mediaAllocation={project?.mediaAllocation} />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm font-bold leading-loose tracking-wide text-slate-700">
                        {sec.content}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* === NanoBanana バナー画像生成（改善版） === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          className="mb-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
        >
          {bannerImages.length === 0 ? (
            // 生成前: ヒーロー型カード
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0023D6] via-[#1F4DFF] to-[#3460FB] p-10 text-white">
              <motion.div
                className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                transition={{ duration: 5, repeat: Infinity }}
              />
              <motion.div
                className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-[#1F3CFF]/30 blur-3xl"
                animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 6, repeat: Infinity }}
              />
              <div className="relative">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-black backdrop-blur">
                  <ImageIcon className="h-3 w-3" />
                  NanoBanana AI Pro 連携
                </div>
                <h2 className="mb-3 text-3xl font-black tracking-tight md:text-4xl">
                  広告バナー画像を<br />
                  <span className="bg-gradient-to-r from-white to-[#D9E6FF] bg-clip-text text-transparent">
                    3パターン一括生成
                  </span>
                </h2>
                <p className="mb-6 max-w-xl text-sm font-bold leading-loose text-white/90">
                  クリック1回で、提案内容に合わせた正方形バナー画像（1080×1080）を <strong>3パターン同時に生成</strong> します。<br />
                  業種・商材・戦略を踏まえて NanoBanana AI Pro が自動でデザインします。
                </p>
                <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-black backdrop-blur">
                  本日の残り生成回数:{' '}
                  <span className="text-base">
                    {bannerRemaining === -1 ? '無制限' : `${bannerRemaining} / ${bannerDailyLimit}回`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <motion.button
                    type="button"
                    onClick={handleGenerateBanners}
                    disabled={generatingBanners || (bannerRemaining === 0)}
                    whileHover={{ scale: generatingBanners ? 1 : 1.05, y: generatingBanners ? 0 : -2 }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-black text-[#0017C1] shadow-2xl shadow-[#000060]/50 disabled:opacity-50"
                  >
                    {generatingBanners ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        生成中... (30〜60秒)
                      </>
                    ) : bannerRemaining === 0 ? (
                      <>本日の上限に達しました</>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        このバナー画像を作る
                      </>
                    )}
                  </motion.button>
                  {bannerRemaining === 0 && (
                    <Link
                      href="/adsim/pricing"
                      className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/40 bg-white/10 px-5 py-4 text-sm font-black text-white backdrop-blur hover:bg-white/20"
                    >
                      Pro プランで無制限に →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // 生成後: 3枚グリッド + 再生成ボタン
            <div className="p-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                    <ImageIcon className="h-5 w-5 text-[#0017C1]" />
                    生成済みバナー画像（3パターン）
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    NanoBanana AI Pro により自動生成・各画像をクリックでダウンロード
                  </p>
                </div>
                <motion.button
                  type="button"
                  onClick={handleGenerateBanners}
                  disabled={generatingBanners}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#0017C1]/30 bg-[#D9E6FF] px-4 py-2 text-sm font-bold text-[#0017C1] hover:bg-[#C5D7FB] disabled:opacity-50"
                >
                  {generatingBanners ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  再生成
                </motion.button>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {bannerImages.map((src, i) => {
                  const inner = (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`Banner ${i + 1}`}
                        className={`h-full w-full object-cover transition group-hover:scale-105 ${isFree ? 'blur-md' : ''}`}
                      />
                      {isFree && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 backdrop-blur-sm">
                          <div className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
                            🔒 ロック中
                          </div>
                          <div className="text-xs font-black text-white">Pro プラン限定</div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 transition group-hover:opacity-100">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#0017C1]">
                          Pattern {String.fromCharCode(65 + i)}
                        </span>
                        {!isFree && (
                          <span className="rounded-full bg-[#0017C1] p-2 text-white">
                            <Download className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                    </>
                  )
                  return isFree ? (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={{ scale: 1.03, y: -4 }}
                      className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-md"
                    >
                      {inner}
                    </motion.div>
                  ) : (
                    <motion.a
                      key={i}
                      href={src}
                      download={`banner-${i + 1}.png`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={{ scale: 1.03, y: -4 }}
                      className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-md"
                    >
                      {inner}
                    </motion.a>
                  )
                })}
              </div>
              {isFree && (
                <Link
                  href="/adsim/pricing"
                  className="mt-5 flex items-center justify-center gap-2 rounded-2xl border-2 border-[#0017C1]/30 bg-gradient-to-r from-[#D9E6FF] to-[#C5D7FB] px-5 py-4 text-sm font-black text-[#0017C1] transition hover:from-[#C5D7FB] hover:to-[#D9E6FF]"
                >
                  🔓 Pro プランへアップグレードしてバナー画像をダウンロード →
                </Link>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* === チャット 画面下部固定 === */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        {/* 展開時のチャット履歴 */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ y: 400, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 400, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto max-w-3xl px-4"
            >
              <div
                ref={chatScrollRef}
                className="max-h-[55vh] min-h-[280px] space-y-3 overflow-y-auto rounded-t-2xl border border-b-0 border-slate-200 bg-white p-6 shadow-2xl"
              >
                {chatMessages.length === 0 && (
                  <div className="py-2 text-center text-xs font-bold text-slate-400">
                    例: 「Meta の予算を 50% に増やして」「CV を 1.5倍に」「Google を減らして TikTok を増やして」
                  </div>
                )}
                {chatMessages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-bold leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-gradient-to-br from-[#0017C1] to-[#3460FB] text-white shadow-md'
                          : 'border border-slate-200 bg-slate-50 text-slate-800'
                      }`}
                    >
                      {m.text}
                    </div>
                  </motion.div>
                ))}
                {chatProcessing && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-[#0017C1]" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 常時表示の入力バー */}
        <div className="border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-2xl shadow-[#0017C1]/10">
          <div className="mx-auto max-w-3xl px-4 py-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!chatOpen) setChatOpen(true)
                handleChatSend()
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => setChatOpen(!chatOpen)}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0017C1] to-[#3460FB] text-white shadow-md transition hover:shadow-lg"
                title={chatOpen ? '閉じる' : '履歴を見る'}
              >
                {chatOpen ? <ChevronDown className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
              </button>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onFocus={() => setChatOpen(true)}
                  placeholder="例: Google の予算を 60% に増やして"
                  disabled={chatProcessing}
                  className="w-full rounded-full border-2 border-slate-200 bg-slate-50 px-5 py-3 pr-32 text-sm font-bold focus:border-[#0017C1] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#0017C1]/10 disabled:bg-slate-100"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                  {chatRemaining === -1
                    ? 'AI で即時調整'
                    : `本日 残り ${chatRemaining}/${chatDailyLimit}回`}
                </span>
              </div>
              <motion.button
                type="submit"
                disabled={chatProcessing || !chatInput.trim()}
                whileHover={{ scale: chatProcessing ? 1 : 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#0017C1] to-[#3460FB] text-white shadow-md disabled:opacity-50"
              >
                {chatProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </motion.button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------
// PieChart カスタムラベル（リーダーライン + 媒体名 + 金額）
// ----------------------------------------
function renderPieLabel(props: any, data: { name: string; value: number }[]) {
  const { cx, cy, midAngle, outerRadius, index } = props
  const RADIAN = Math.PI / 180
  const radius = outerRadius + 28
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  const isRight = x > cx
  const item = data[index]
  if (!item) return null
  const color = COLORS[index % COLORS.length]

  return (
    <g>
      {/* 媒体カラーマーカー（小さい丸） */}
      <circle
        cx={isRight ? x - 6 : x + 6}
        cy={y - 10}
        r={5}
        fill={color}
      />
      {/* 媒体名 */}
      <text
        x={x}
        y={y - 7}
        fill={color}
        fontSize={13}
        fontWeight={900}
        textAnchor={isRight ? 'start' : 'end'}
        style={{ letterSpacing: '0.04em' }}
      >
        {item.name}
      </text>
      {/* 金額 */}
      <text
        x={x}
        y={y + 11}
        fill="#1f2937"
        fontSize={12}
        fontWeight={800}
        textAnchor={isRight ? 'start' : 'end'}
      >
        ¥{item.value.toLocaleString()}
      </text>
    </g>
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
      <div className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">{value}</div>
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
          ? 'border-[#0017C1]/30 bg-gradient-to-br from-[#D9E6FF]/40 via-white to-[#C5D7FB]/30 shadow-lg shadow-[#0017C1]/10'
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
          {subtitle && <p className="text-xs font-bold text-slate-500">{subtitle}</p>}
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
      className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-xl hover:shadow-[#0017C1]/10"
    >
      <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-[#D9E6FF] to-transparent opacity-50" />
      <div className="relative min-w-0">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
          <Icon className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{label}</span>
        </div>
        <div className="text-lg font-black leading-tight tracking-tight text-slate-900 break-all sm:text-xl md:text-[1.4rem]">
          {value}
        </div>
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
      <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-700">{title}</h3>
      {children}
    </div>
  )
}

// ターゲティング可視化（年齢/性別/地域/興味のチップ）
function TargetingVisual({ content, project }: { content: string; project: AdSimProject }) {
  const targetAudience = project.targetAudience || undefined

  return (
    <div className="space-y-5">
      {/* チップ表示エリア */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ChipBox label="年齢層" value={targetAudience?.age || '指定なし'} icon="👤" />
        <ChipBox label="性別" value={targetAudience?.gender || '指定なし'} icon="⚥" />
        <ChipBox label="地域" value={targetAudience?.region || '全国'} icon="📍" />
        <ChipBox label="興味" value={targetAudience?.interests?.join(' / ') || '指定なし'} icon="❤️" />
      </div>
      <div className="rounded-2xl bg-slate-50 p-5">
        <p className="whitespace-pre-wrap text-sm font-bold leading-loose tracking-wide text-slate-700">
          {content}
        </p>
      </div>
    </div>
  )
}

// クリエイティブ方針 可視化（媒体ごとのカード）
function CreativeVisual({ content, mediaAllocation }: { content: string; mediaAllocation: any }) {
  const allocation = mediaAllocation || {}
  const mediaList = [
    { id: 'google', name: 'Google広告', tone: '検索意図・論理訴求', color: '#0023D6' },
    { id: 'meta', name: 'Meta広告', tone: 'ビジュアル訴求・UGC風', color: '#1F4DFF' },
    { id: 'line', name: 'LINE広告', tone: '日常導線・親近感', color: '#3460FB' },
    { id: 'x', name: 'X広告', tone: '即時拡散・話題性', color: '#5575FC' },
    { id: 'tiktok', name: 'TikTok', tone: 'バズ動画・縦型', color: '#0017C1' },
    { id: 'yahoo', name: 'Yahoo!', tone: '幅広い世代・信頼性', color: '#4A6BFC' },
  ]
  const activeMedia = mediaList.filter((m) => (allocation[m.id] || 0) > 0)

  return (
    <div className="space-y-5">
      {/* 媒体ごとのカード */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activeMedia.map((m) => (
          <div
            key={m.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className="inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white"
                style={{ background: `linear-gradient(135deg, ${m.color}, #3460FB)` }}
              >
                {m.name}
              </span>
              <span className="text-xs font-black text-slate-700">{allocation[m.id]}%</span>
            </div>
            <div className="text-xs font-bold text-slate-600">{m.tone}</div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${allocation[m.id] || 0}%`,
                  background: `linear-gradient(90deg, ${m.color}, #3460FB)`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-slate-50 p-5">
        <p className="whitespace-pre-wrap text-sm font-bold leading-loose tracking-wide text-slate-700">
          {content}
        </p>
      </div>
    </div>
  )
}

function ChipBox({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-2xl border-2 border-[#D9E6FF] bg-gradient-to-br from-white to-[#D9E6FF]/40 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
        <span className="text-base leading-none">{icon}</span>
        {label}
      </div>
      <div className="text-sm font-black text-slate-900">{value}</div>
    </div>
  )
}
