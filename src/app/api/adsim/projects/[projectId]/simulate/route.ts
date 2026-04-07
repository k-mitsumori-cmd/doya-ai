// ============================================
// POST /api/adsim/projects/[projectId]/simulate
// ============================================
// 業界平均ベンチマーク × 入力値から媒体別×月次の数値シミュレーションを生成し、
// simulationData / chartData に保存する。

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { simulate } from '@/lib/adsim/simulator'
import { MediaId } from '@/lib/adsim/benchmark'

export async function POST(_req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const project = await prisma.adSimProject.findUnique({ where: { id: params.projectId } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (project.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = simulate({
      industry: project.industry,
      monthlyBudget: project.monthlyBudget,
      periodMonths: project.periodMonths,
      mediaAllocation: project.mediaAllocation as Partial<Record<MediaId, number>>,
    })

    // Recharts 用に整形
    const chartData = {
      budgetAllocation: result.media.map((m) => ({
        name: m.mediaName,
        value: m.totalBudget,
      })),
      monthlyCv: Array.from({ length: project.periodMonths }, (_, i) => {
        const month = i + 1
        const entry: Record<string, number | string> = { month: `${month}ヶ月目` }
        for (const m of result.media) {
          entry[m.mediaName] = m.monthly[i]?.cv || 0
        }
        return entry
      }),
      mediaPerformance: result.media.map((m) => ({
        name: m.mediaName,
        impression: m.summary.impression,
        click: m.summary.click,
        cv: m.summary.cv,
      })),
      funnel: {
        impression: result.overall.totalImpression,
        click: result.overall.totalClick,
        cv: result.overall.totalCv,
      },
    }

    const updated = await prisma.adSimProject.update({
      where: { id: params.projectId },
      data: {
        simulationData: result as unknown as object,
        chartData: chartData as unknown as object,
        status: 'generating', // proposal 生成が次ステップ
      },
    })

    return NextResponse.json({ project: updated, simulation: result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[adsim] simulate error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
