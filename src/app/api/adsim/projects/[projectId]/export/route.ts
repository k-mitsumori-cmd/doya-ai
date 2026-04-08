// ============================================
// GET /api/adsim/projects/[projectId]/export?format=pdf|pptx|xlsx
// ============================================
// 完成したプロジェクトから PDF / PPTX / Excel ファイルを生成してダウンロードさせる。

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generatePdfBuffer } from '@/lib/adsim/pdf-generator'
import { generateExcelBuffer } from '@/lib/adsim/excel-generator'
import { generatePptxBuffer } from '@/lib/adsim/pptx-generator'
import { SimulationResult } from '@/lib/adsim/simulator'
import { ProposalSection } from '@/lib/adsim/gemini'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const format = (searchParams.get('format') || 'pdf').toLowerCase()

    const project = await prisma.adSimProject.findUnique({
      where: { id: params.projectId },
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (project.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!project.simulationData || !project.proposalText) {
      return NextResponse.json(
        { error: 'シミュレーションまたは提案文が未生成です' },
        { status: 400 }
      )
    }

    const simulation = project.simulationData as unknown as SimulationResult
    const proposal = project.proposalText as unknown as ProposalSection[]
    const chartData = (project.chartData as any) || {}
    const baseName = `${project.clientName}_広告提案_${new Date().toISOString().slice(0, 10)}`
      .replace(/[\\/:*?"<>|]/g, '_')

    if (format === 'pdf') {
      const buf = await generatePdfBuffer({
        clientName: project.clientName,
        productName: project.productName,
        industry: project.industry,
        industryName: chartData.industryName || project.industry,
        monthlyBudget: project.monthlyBudget,
        periodMonths: project.periodMonths,
        mediaAllocation: project.mediaAllocation as Record<string, number>,
        proposerName: project.proposerName,
        simulation,
        proposal,
        ogImage: chartData.ogImage || null,
        lpAnalysis: chartData.lpAnalysis || '',
        recommendation: chartData.recommendation || '',
        budgetRationale: chartData.budgetRationale || '',
        cpaRationale: chartData.cpaRationale || '',
        lpUrl: project.lpUrl || null,
      })
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(baseName)}.pdf"`,
        },
      })
    }

    if (format === 'xlsx' || format === 'excel') {
      const buf = await generateExcelBuffer({
        clientName: project.clientName,
        productName: project.productName,
        industry: project.industry,
        monthlyBudget: project.monthlyBudget,
        periodMonths: project.periodMonths,
        simulation,
      })
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(baseName)}.xlsx"`,
        },
      })
    }

    if (format === 'pptx') {
      const buf = await generatePptxBuffer({
        clientName: project.clientName,
        productName: project.productName,
        industry: project.industry,
        monthlyBudget: project.monthlyBudget,
        periodMonths: project.periodMonths,
        mediaAllocation: project.mediaAllocation as Record<string, number>,
        proposerName: project.proposerName,
        simulation,
        proposal,
      })
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(baseName)}.pptx"`,
        },
      })
    }

    return NextResponse.json({ error: 'unsupported format' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[adsim] export error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
