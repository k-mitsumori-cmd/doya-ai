// ============================================
// POST /api/adsim/auto-generate
// ============================================
// LP URL + 月額予算のみ受け取り、AIが業種・ターゲット・KPI・媒体配分まで
// すべて判断 → プロジェクト作成 → simulate → proposal を一気に実行する。
//
// リクエスト: { lpUrl: string, monthlyBudget: number, periodMonths?: number }
// レスポンス: { project: AdSimProject, projectId: string }

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { autoGenerateProposal } from '@/lib/adsim/auto-generator'
import { simulate } from '@/lib/adsim/simulator'
import { MediaId } from '@/lib/adsim/benchmark'
import { generateProposalSections } from '@/lib/adsim/gemini'
import { SimulationResult } from '@/lib/adsim/simulator'

export const runtime = 'nodejs'
export const maxDuration = 300

// プラン → 月間上限プロジェクト数
function getAdSimMonthlyLimit(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.ADSIM_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE' || p === 'BUSINESS' || p === 'BUNDLE') return -1
  if (p === 'PRO' || p === 'STARTER') return -1
  if (p === 'LIGHT') return 10
  return 3
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const body = await req.json()
    const { lpUrl, monthlyBudget, periodMonths } = body

    if (!lpUrl || typeof lpUrl !== 'string') {
      return NextResponse.json({ error: 'lpUrl は必須です' }, { status: 400 })
    }
    try {
      new URL(lpUrl)
    } catch {
      return NextResponse.json({ error: 'lpUrl の形式が不正です' }, { status: 400 })
    }
    if (!monthlyBudget || Number(monthlyBudget) <= 0) {
      return NextResponse.json({ error: 'monthlyBudget は1以上の数値が必要です' }, { status: 400 })
    }

    // 月次使用制限チェック
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    })
    const limit = getAdSimMonthlyLimit(user?.plan)
    if (limit !== -1) {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const monthCount = await prisma.adSimProject.count({
        where: { userId, createdAt: { gte: startOfMonth } },
      })
      if (monthCount >= limit) {
        return NextResponse.json(
          {
            error: `今月の作成上限（${limit}件）に達しました。Pro プランで無制限になります。初月無料でお試しいただけます。`,
            code: 'MONTHLY_LIMIT_REACHED',
          },
          { status: 402 }
        )
      }
    }

    // 1. LP + 予算 → AIが全項目生成
    const auto = await autoGenerateProposal({
      lpUrl,
      monthlyBudget: Number(monthlyBudget),
      periodMonths: periodMonths ? Number(periodMonths) : 3,
    })

    // 2. プロジェクト作成
    const project = await prisma.adSimProject.create({
      data: {
        userId,
        name: `${auto.clientName} 広告提案`,
        clientName: auto.clientName,
        industry: auto.industry,
        productName: auto.productName,
        lpUrl,
        targetAudience: auto.targetAudience as unknown as object,
        goals: auto.goals,
        periodMonths: auto.periodMonths,
        monthlyBudget: Number(monthlyBudget),
        targetCv: auto.targetCv,
        targetCpa: auto.targetCpa,
        targetRoas: auto.targetRoas,
        mediaAllocation: auto.mediaAllocation as unknown as object,
        proposerName: session.user?.name || null,
        proposerEmail: session.user?.email || null,
        templateId: 'simple',
        status: 'generating',
      },
    })

    // 3. 数値シミュレーション
    const simResult = simulate({
      industry: auto.industry,
      monthlyBudget: Number(monthlyBudget),
      periodMonths: auto.periodMonths,
      mediaAllocation: auto.mediaAllocation as Partial<Record<MediaId, number>>,
    })

    const chartData = {
      budgetAllocation: simResult.media.map((m) => ({ name: m.mediaName, value: m.totalBudget })),
      monthlyCv: Array.from({ length: auto.periodMonths }, (_, i) => {
        const entry: Record<string, number | string> = { month: `${i + 1}ヶ月目` }
        for (const m of simResult.media) {
          entry[m.mediaName] = m.monthly[i]?.cv || 0
        }
        return entry
      }),
      mediaPerformance: simResult.media.map((m) => ({
        name: m.mediaName,
        impression: m.summary.impression,
        click: m.summary.click,
        cv: m.summary.cv,
      })),
      funnel: {
        impression: simResult.overall.totalImpression,
        click: simResult.overall.totalClick,
        cv: simResult.overall.totalCv,
      },
      // LP 詳細情報（プレビュー画面で使用）
      ogImage: auto.ogImage,
      lpAnalysis: auto.lpAnalysis,
      recommendation: auto.recommendation,
      budgetRationale: auto.budgetRationale,
      cpaRationale: auto.cpaRationale,
      industryName: auto.industryName,
      bannerImages: [] as string[], // 後でNanoBanana で生成
    }

    // 4. 提案テキスト10セクション
    const sections = await generateProposalSections({
      clientName: auto.clientName,
      industry: auto.industry,
      productName: auto.productName,
      lpUrl,
      targetAudience: auto.targetAudience,
      goals: auto.goals,
      periodMonths: auto.periodMonths,
      monthlyBudget: Number(monthlyBudget),
      mediaAllocation: auto.mediaAllocation as Record<string, number>,
      simulation: simResult as unknown as SimulationResult,
    })

    // 5. すべて保存
    const updated = await prisma.adSimProject.update({
      where: { id: project.id },
      data: {
        simulationData: simResult as unknown as object,
        chartData: chartData as unknown as object,
        proposalText: sections as unknown as object,
        status: 'completed',
      },
    })

    return NextResponse.json({
      project: updated,
      projectId: updated.id,
      autoGenerated: {
        industry: auto.industryName,
        rationale: auto.rationale,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[adsim] auto-generate error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
