// ============================================
// スワイプ戦略生成API
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OpenAI } from 'openai'
import { STRATEGY_CARDS, StrategyCard } from '@/lib/strategy/cards'

export const maxDuration = 300 // 5分

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface SwipeGenerateRequest {
  accepted: string[]
  rejected: string[]
  cards: StrategyCard[]
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: SwipeGenerateRequest = await request.json()
    const { accepted, rejected, cards } = body

    // 採用・除外されたカードを取得
    const acceptedCards = cards.filter((c) => accepted.includes(c.id))
    const rejectedCards = cards.filter((c) => rejected.includes(c.id))

    // プロジェクト作成
    const project = await prisma.strategyProject.create({
      data: {
        userId: userId || null,
        guestId: guestId || null,
        status: 'GENERATING',
        input: {
          type: 'swipe',
          accepted: acceptedCards.map((c) => ({
            id: c.id,
            text: c.text,
            category: c.category,
            impact: c.impact,
            cost_level: c.cost_level,
            difficulty: c.difficulty,
            channel: c.channel,
          })),
          rejected: rejectedCards.map((c) => ({
            id: c.id,
            text: c.text,
            category: c.category,
          })),
        },
      },
    })

    // ChatGPTに戦略生成を依頼
    const prompt = buildStrategyPrompt(acceptedCards, rejectedCards)
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `あなたはマーケティング戦略の専門家です。ユーザーのスワイプ選択をもとに、構造化されたマーケティング戦略を生成してください。
出力は必ずJSON形式で、以下の構造に従ってください。`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    })

    const strategyData = JSON.parse(completion.choices[0].message.content || '{}')

    // プロジェクトを更新
    await prisma.strategyProject.update({
      where: { id: project.id },
      data: {
        status: 'COMPLETED',
        output: strategyData,
      },
    })

    return NextResponse.json({
      projectId: project.id,
      strategy: strategyData,
    })
  } catch (error: any) {
    console.error('[STRATEGY SWIPE] Error:', error)
    return NextResponse.json(
      { error: error.message || '戦略生成に失敗しました' },
      { status: 500 }
    )
  }
}

function buildStrategyPrompt(accepted: StrategyCard[], rejected: StrategyCard[]): string {
  const acceptedText = accepted.map((c) => `- ${c.text} (${c.category}, ${c.impact.join('/')})`).join('\n')
  const rejectedText = rejected.map((c) => `- ${c.text} (${c.category})`).join('\n')

  // カテゴリ別採用率
  const categoryCount: Record<string, number> = {}
  accepted.forEach((c) => {
    categoryCount[c.category] = (categoryCount[c.category] || 0) + 1
  })

  // チャネル別優先度
  const channelCount: Record<string, number> = {}
  accepted.forEach((c) => {
    c.channel.forEach((ch) => {
      channelCount[ch] = (channelCount[ch] || 0) + 1
    })
  })

  return `以下のスワイプ選択をもとに、マーケティング戦略を生成してください。

【採用された施策】
${acceptedText}

【除外された施策】
${rejectedText}

【カテゴリ別採用率】
${Object.entries(categoryCount)
  .map(([cat, count]) => `- ${cat}: ${count}件`)
  .join('\n')}

【チャネル別優先度】
${Object.entries(channelCount)
  .sort(([, a], [, b]) => b - a)
  .map(([ch, count]) => `- ${ch}: ${count}件`)
  .join('\n')}

以下のJSON形式で出力してください：

{
  "reason": "なぜこの戦略になったのか（ユーザーのスワイプ傾向をもとに、人間っぽい言葉で説明）",
  "strategy_map": {
    "集客": [
      {
        "action": "施策名",
        "priority": "high | mid | low",
        "description": "説明"
      }
    ],
    "育成": [...],
    "商談": [...],
    "受注": [...]
  },
  "roadmap": {
    "month1": {
      "focus": "今月の重点",
      "actions": ["アクション1", "アクション2", ...]
    },
    "month2": {...},
    "month3": {...}
  },
  "budget_allocation": {
    "SEO": 30,
    "広告": 25,
    "コンテンツ": 20,
    "ツール": 15,
    "外注": 10
  },
  "kpi_tree": {
    "final_kpi": {
      "name": "最終KPI（例：商談数）",
      "target": "目標値"
    },
    "intermediate_kpis": [
      {
        "name": "中間KPI（例：CV数）",
        "target": "目標値",
        "related_actions": ["関連施策"]
      }
    ],
    "action_kpis": [
      {
        "name": "施策KPI（例：記事本数）",
        "target": "目標値",
        "related_actions": ["関連施策"]
      }
    ]
  }
}`
}
