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
  let text = (raw || '').trim()
  // コードフェンス除去
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  // 最初の { から最後の } まで
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) {
    console.error('[chat-edit] JSON not found in raw response:', String(raw).substring(0, 800))
    throw new Error('AI が JSON 形式で応答しませんでした。もう一度お試しください')
  }
  const slice = text.substring(start, end + 1)
  try {
    return JSON.parse(slice)
  } catch (e) {
    // 末尾カンマ除去のフォールバック
    try {
      const cleaned = slice.replace(/,(\s*[}\]])/g, '$1')
      return JSON.parse(cleaned)
    } catch {
      console.error('[chat-edit] JSON parse failed:', slice.substring(0, 800))
      throw new Error(`AI のレスポンス解析に失敗しました（${e instanceof Error ? e.message : 'parse error'}）`)
    }
  }
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

// プラン → 月間チャット編集回数（Gemini API コスト管理）
function getChatMonthlyLimit(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.ADSIM_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE') return 3000
  if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS' || p === 'BUNDLE') return 500
  if (p === 'LIGHT') return 100
  return 20 // FREE
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

    // ----- 月間チャット編集制限 -----
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    })
    const monthlyLimit = getChatMonthlyLimit(user?.plan)
    if (monthlyLimit !== -1) {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const allProjects = await prisma.adSimProject.findMany({
        where: { userId },
        select: { chartData: true },
      })
      let monthCount = 0
      for (const p of allProjects) {
        const cd = p.chartData as any
        if (Array.isArray(cd?.chatLog)) {
          for (const entry of cd.chatLog) {
            if (entry?.timestamp) {
              const ts = new Date(entry.timestamp)
              if (!isNaN(ts.getTime()) && ts >= startOfMonth) monthCount++
            }
          }
        }
      }
      if (monthCount >= monthlyLimit) {
        const planLabel =
          String(user?.plan || 'FREE').toUpperCase() === 'FREE'
            ? '無料プラン'
            : `${String(user?.plan).toUpperCase()} プラン`
        return NextResponse.json(
          {
            error: `今月のチャット編集上限（${planLabel}: ${monthlyLimit}回/月）に達しました。上位プランへのアップグレードでさらに利用可能になります。`,
            code: 'CHAT_MONTHLY_LIMIT',
            limit: monthlyLimit,
            current: monthCount,
          },
          { status: 402 }
        )
      }
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

【出力ルール - 厳守】
- 必ず JSON のみで応答してください
- 前置き、後置き、説明文、コードフェンス（\`\`\`）は一切禁止
- 最初の文字は { で始まり、最後の文字は } で終わること
- mediaAllocation の値は数値（"40" などの文字列ではなく 40）
- mediaAllocation の合計は必ず100になるようにしてください
- 全6媒体すべてのキーを含めること: google, meta, line, x, tiktok, yahoo
- monthlyBudget は数値（必要時のみ変更、指示が無ければ現状の値をそのまま入れる）
- summary は日本語で短い変更説明（例: 「Meta の配分を 30% → 50% に増やしました」）

【出力JSON サンプル】
{"mediaAllocation":{"google":50,"meta":30,"line":10,"x":5,"tiktok":3,"yahoo":2},"monthlyBudget":${currentBudget},"summary":"Google を 50% に増やしました"}
`

    let raw: string
    try {
      raw = await generateTextWithGemini(prompt, {}, { temperature: 0.1, maxOutputTokens: 1024 })
    } catch (geminiErr) {
      console.error('[chat-edit] Gemini call failed:', geminiErr)
      return NextResponse.json(
        { error: `AI 呼び出しに失敗しました: ${geminiErr instanceof Error ? geminiErr.message : 'unknown'}` },
        { status: 502 }
      )
    }
    if (!raw || raw.trim().length === 0) {
      return NextResponse.json({ error: 'AI が空のレスポンスを返しました' }, { status: 502 })
    }

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
      chatLog: [
        ...(Array.isArray(oldChart.chatLog) ? oldChart.chatLog : []),
        { timestamp: new Date().toISOString(), message: message.substring(0, 500), summary },
      ].slice(-50), // 直近50件まで保持
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
