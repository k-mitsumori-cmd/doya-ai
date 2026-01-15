// ============================================
// ドヤ戦略AI - 戦略生成API（多層プロンプト設計）
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getStrategyKernelPrompt,
  getPhaseGeneratorPrompt,
  getVisualizationPrompt,
  getExternalResearchPrompt,
} from '@/lib/strategy/prompts'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5分

function getGeminiApiKey(): string {
  return (
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ''
  )
}

async function geminiGenerateText(prompt: string, model = 'gemini-2.0-flash'): Promise<string> {
  const key = getGeminiApiKey()
  if (!key) throw new Error('Gemini APIキーが設定されていません（GOOGLE_GENAI_API_KEY / GOOGLE_GEMINI_API_KEY 等）')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(
    key
  )}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6 },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Gemini generateContent failed: ${res.status} ${res.statusText} ${text}`.trim())
  }

  const json: any = await res.json()
  const out = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('') || ''
  return String(out || '')
}

interface StrategyGenerationRequest {
  step: 'kernel' | 'phase' | 'visualization' | 'external-research'
  projectId?: string
  input?: {
    serviceUrl?: string
    businessModel?: string
    averagePrice?: string
    targetCustomer?: string
    budgetRange?: string
    salesType?: string
  }
  coreStrategy?: {
    core_strategy: string
    main_levers: string[]
  }
  phases?: any
  productInfo?: {
    serviceUrl?: string
    businessModel?: string
    targetCustomer?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: StrategyGenerationRequest = await request.json()
    const { step, projectId, input, coreStrategy, phases, productInfo } = body

    // 使用量チェック（ログインユーザーのみ）
    if (userId) {
      const subscription = await prisma.userServiceSubscription.findUnique({
        where: {
          userId_serviceId: {
            userId,
            serviceId: 'strategy',
          },
        },
      })

      const plan = subscription?.plan || 'FREE'
      const dailyLimit = plan === 'PRO' ? 100 : plan === 'FREE' ? 3 : 0

      // 日次リセットチェック
      const now = new Date()
      const lastReset = subscription?.lastUsageReset || now
      const isNewDay = now.toDateString() !== lastReset.toDateString()

      if (isNewDay) {
        await prisma.userServiceSubscription.update({
          where: { id: subscription?.id },
          data: { dailyUsage: 0, lastUsageReset: now },
        })
      } else {
        const todayUsage = subscription?.dailyUsage || 0
        if (todayUsage >= dailyLimit) {
          return NextResponse.json(
            { error: '使用上限に達しました', limit: dailyLimit },
            { status: 429 }
          )
        }
      }
    }

    let result: any

    // Step 1: Kernel（コア戦略生成）
    if (step === 'kernel') {
      if (!input) {
        return NextResponse.json({ error: 'inputが必要です' }, { status: 400 })
      }

      const prompt = getStrategyKernelPrompt(input)
      const text = await geminiGenerateText(prompt, 'gemini-2.0-flash')

      // JSON抽出
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('JSON形式の応答が取得できませんでした')
      }

      result = JSON.parse(jsonMatch[0])

      // プロジェクト作成または更新
      if (projectId) {
        await prisma.strategyProject.update({
          where: { id: projectId },
          data: { coreStrategy: result },
        })
      } else {
        const project = await prisma.strategyProject.create({
          data: {
            userId: userId || undefined,
            guestId: guestId || undefined,
            serviceUrl: input.serviceUrl,
            businessModel: input.businessModel,
            averagePrice: input.averagePrice,
            targetCustomer: input.targetCustomer,
            budgetRange: input.budgetRange,
            salesType: input.salesType,
            coreStrategy: result,
            status: 'DRAFT',
          },
        })
        return NextResponse.json({ success: true, result, projectId: project.id })
      }
    }

    // Step 2: Phase（フェーズ別戦略生成）
    else if (step === 'phase') {
      if (!coreStrategy || !projectId) {
        return NextResponse.json({ error: 'coreStrategyとprojectIdが必要です' }, { status: 400 })
      }

      const prompt = getPhaseGeneratorPrompt(coreStrategy)
      const text = await geminiGenerateText(prompt, 'gemini-2.0-flash')

      // JSON抽出
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('JSON形式の応答が取得できませんでした')
      }

      result = JSON.parse(jsonMatch[0])

      // プロジェクト更新
      await prisma.strategyProject.update({
        where: { id: projectId },
        data: { phases: result, status: 'GENERATED' },
      })
    }

    // Step 3: Visualization（可視化データ生成）
    else if (step === 'visualization') {
      if (!phases || !projectId) {
        return NextResponse.json({ error: 'phasesとprojectIdが必要です' }, { status: 400 })
      }

      const prompt = getVisualizationPrompt(phases)
      const text = await geminiGenerateText(prompt, 'gemini-2.0-flash')

      // JSON抽出
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('JSON形式の応答が取得できませんでした')
      }

      result = JSON.parse(jsonMatch[0])

      // プロジェクト更新
      await prisma.strategyProject.update({
        where: { id: projectId },
        data: { visualizationData: result },
      })
    }

    // Step 4: External Research（外部調査）
    else if (step === 'external-research') {
      if (!productInfo || !projectId) {
        return NextResponse.json({ error: 'productInfoとprojectIdが必要です' }, { status: 400 })
      }

      const prompt = getExternalResearchPrompt(productInfo)
      const text = await geminiGenerateText(prompt, 'gemini-2.0-flash')

      // JSON抽出
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('JSON形式の応答が取得できませんでした')
      }

      result = JSON.parse(jsonMatch[0])

      // プロジェクト更新
      await prisma.strategyProject.update({
        where: { id: projectId },
        data: { externalResearch: result },
      })
    } else {
      return NextResponse.json({ error: '無効なステップです' }, { status: 400 })
    }

    // 使用量を更新
    if (userId) {
      const subscription = await prisma.userServiceSubscription.findUnique({
        where: {
          userId_serviceId: {
            userId,
            serviceId: 'strategy',
          },
        },
      })

      if (subscription) {
        await prisma.userServiceSubscription.update({
          where: { id: subscription.id },
          data: { dailyUsage: { increment: 1 } },
        })
      }
    }

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    console.error('[STRATEGY] Generation error:', error)
    return NextResponse.json(
      { error: '生成に失敗しました', details: error.message },
      { status: 500 }
    )
  }
}
