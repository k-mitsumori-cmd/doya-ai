'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
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
import { Loader2, Download } from 'lucide-react'

const COLORS = ['#6366f1', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6']

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
}

interface SimOverall {
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
  simulationData: { overall: SimOverall; media: unknown[] } | null
  proposalText: ProposalSection[] | null
  chartData: ChartData | null
}

export default function AdSimProjectPage() {
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const { data: session, status } = useSession()
  const isSessionLoading = status === 'loading'
  const isLoggedIn = !!session?.user
  const [project, setProject] = useState<AdSimProject | null>(null)
  const [loading, setLoading] = useState(true)

  // 未ログインなら /auth/signin にリダイレクト
  useEffect(() => {
    if (!isSessionLoading && !isLoggedIn) {
      router.replace(`/auth/signin?callbackUrl=/adsim/${params.projectId}`)
    }
  }, [isSessionLoading, isLoggedIn, router, params.projectId])

  useEffect(() => {
    if (!isLoggedIn) return
    fetch(`/api/adsim/projects/${params.projectId}`)
      .then((r) => r.json())
      .then((d) => setProject(d.project))
      .finally(() => setLoading(false))
  }, [params.projectId, isLoggedIn])

  if (isSessionLoading || !isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>プロジェクトが見つかりません</p>
      </div>
    )
  }

  const chart = project.chartData
  const overall = project.simulationData?.overall
  const sections = project.proposalText || []

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/adsim" className="text-sm text-indigo-600 hover:underline">
              ← ダッシュボード
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-sm text-gray-500">
              {project.clientName} / {project.industry} / 月額¥{project.monthlyBudget.toLocaleString()} ×{' '}
              {project.periodMonths}ヶ月
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/adsim/projects/${project.id}/export?format=pdf`}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Download className="h-4 w-4" />
              PDF
            </a>
            <a
              href={`/api/adsim/projects/${project.id}/export?format=pptx`}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
            >
              <Download className="h-4 w-4" />
              PPTX
            </a>
            <a
              href={`/api/adsim/projects/${project.id}/export?format=xlsx`}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
            >
              <Download className="h-4 w-4" />
              Excel
            </a>
          </div>
        </div>

        {/* 免責 */}
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          ※ 本数値はAIおよび業界平均ベンチマークに基づく推定値であり、実際の広告運用結果を保証するものではありません。
        </div>

        {/* KPI サマリ */}
        {overall && (
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
            <KpiCard label="総予算" value={`¥${overall.totalBudget.toLocaleString()}`} />
            <KpiCard label="Impression" value={overall.totalImpression.toLocaleString()} />
            <KpiCard label="Click" value={overall.totalClick.toLocaleString()} />
            <KpiCard label="CV" value={overall.totalCv.toLocaleString()} />
            <KpiCard label="平均CPA" value={`¥${overall.avgCpa.toLocaleString()}`} />
          </div>
        )}

        {/* グラフ */}
        {chart && (
          <div className="mb-8 grid gap-4 md:grid-cols-2">
            <ChartCard title="予算配分">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={chart.budgetAllocation} dataKey="value" nameKey="name" outerRadius={90} label>
                    {chart.budgetAllocation.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="媒体別パフォーマンス">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chart.mediaPerformance}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="click" fill="#3b82f6" />
                  <Bar dataKey="cv" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="月次CV推移" className="md:col-span-2">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chart.monthlyCv}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {chart.mediaPerformance.map((m, i) => (
                    <Line
                      key={m.name}
                      type="monotone"
                      dataKey={m.name}
                      stroke={COLORS[i % COLORS.length]}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}

        {/* 提案テキスト */}
        {sections.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">提案内容</h2>
            {sections.map((sec) => (
              <div key={sec.key} className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="mb-2 text-lg font-bold text-indigo-700">{sec.title}</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {sec.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-gray-900">{value}</div>
    </div>
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
    <div className={`rounded-xl border border-gray-200 bg-white p-4 ${className}`}>
      <h3 className="mb-3 text-sm font-bold text-gray-700">{title}</h3>
      {children}
    </div>
  )
}
