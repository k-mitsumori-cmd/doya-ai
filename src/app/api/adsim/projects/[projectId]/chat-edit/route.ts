// ============================================
// POST /api/adsim/projects/[projectId]/chat-edit
// ============================================
// チャット形式の自然言語指示で simulation データを編集する。
// 例: 「Google の予算を 60% に増やして」「CPA を 5000 に下げて」
//
// Gemini に現在の数値 + 編集指示を渡し、JSON 差分を返してもらう。
// 媒体配分または KPI を更新 → simulate を再実行 → DB 更新。

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateTextWithGemini } from '@/lib/gemini-text'
import { simulate, SimulationResult } from '@/lib/adsim/simulator'
import { MediaId } from '@/lib/adsim/benchmark'

export const runtime = 'nodejs'
export const maxDuration = 60

function extractJson(raw: string): any {
  let text = raw.trim()
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('JSON not found')
  return JSON.parse(text.substring(start, end + 1))
}

function normalizeAlloc(
  alloc: Record<string, number>
): Partial<Record<MediaId, number>> {
  const validIds: MediaId[] = ['google', 'meta', 'line', 'x', 'tiktok', 'yahoo']
  const cleaned: Partial<Record<MediaId, number>> = {}
  let sum = 0
  for (const m of validIds) {
    const v = Math.max(0, Math.round(Number(alloc[m]) || 0))
    cleaned[m] = v
    sum += v
  }
  if (sum === 0) {
    cleaned.google = 100
    return cleaned
  }
  if (sum !== 100) {
    const factor = 100 / sum
    let adjustedSum = 0
    for (const m of validIds) {
      const adjusted = Math.round((cleaned[m] || 0) * factor)
      cleaned[m] = adjusted
      adjustedSum += adjusted
    }
    const diff = 100 - adjustedSum
    if (diff !== 0) {
      const maxMedia = validIds.reduce((a, b) =>
        (cleaned[a] || 0) >= (cleaned[b] || 0) ? a : b
      )
      cleaned[maxMedia] = (cleaned[maxMedia] || 0) + diff
    }
  }
  return cleaned
}

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const project = await prisma.adSimProject.findUnique({ where: { id: params.projectId } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (project.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { message } = await req.json()
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message は必須です' }, { status: 400 })
    }

    const currentAlloc = (project.mediaAllocation as Record<string, number>) || {}
    const currentBudget = project.monthlyBudget

    // Gemini プロンプト
    const prompt = `あなたは広告運用のシミュレーターです。ユーザーが自然言語で広告提案の数値を変更したいと言っています。
以下の現在の設定を、ユーザーの指示に従って変更し、JSON で返してください。

【現在の設定】
- 月額予算: ¥${currentBudget.toLocaleString()}
- 媒体配分(%): ${JSON.stringify(currentAlloc)}
- 業種: ${project.industry}
- 期間: ${project.periodMonths}ヶ月

【ユーザーの指示】
${message}

【出力ルール】
- JSON のみで返答（前置き・コードフェンス禁止）
- mediaAllocation の合計は必ず100
- 媒体ID: google, meta, line, x, tiktok, yahoo
- monthlyBudget は必要時のみ変更（指示が無ければ現状維持）
- summary は変更内容を「Meta の配分を 30% → 50% に増やしました」のような短い日本語で

【出力JSON】
{
  "mediaAllocation": { "google": n, "meta": n, "line": n, "x": n, "tiktok": n, "yahoo": n },
  "monthlyBudget": 数値,
  "summary": "変更内容の短い説明"
}
`

    const raw = await generateTextWithGemini(prompt, {}, { temperature: 0.3, maxOutputTokens: 1024 })
    const parsed = extractJson(raw)

    const newAlloc = normalizeAlloc(parsed.mediaAllocation || currentAlloc)
    const newBudget = parsed.monthlyBudget ? Math.max(1, Math.round(Number(parsed.monthlyBudget))) : currentBudget
    const summary = String(parsed.summary || '数値を更新しました').substring(0, 300)

    // 再シミュレーション
    const simResult = simulate({
      industry: project.industry,
      monthlyBudget: newBudget,
      periodMonths: project.periodMonths,
      mediaAllocation: newAlloc,
    })

    // chartData も再生成（既存の lpAnalysis 等は維持）
    const oldChart = (project.chartData as any) || {}
    const newChartData = {
      ...oldChart,
      budgetAllocation: simResult.media.map((m) => ({ name: m.mediaName, value: m.totalBudget })),
      monthlyCv: Array.from({ length: project.periodMonths }, (_, i) => {
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
    }

    await prisma.adSimProject.update({
      where: { id: params.projectId },
      data: {
        mediaAllocation: newAlloc as unknown as object,
        monthlyBudget: newBudget,
        simulationData: simResult as unknown as object,
        chartData: newChartData as unknown as object,
      },
    })

    return NextResponse.json({ ok: true, summary, simulation: simResult })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[adsim] chat-edit error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
