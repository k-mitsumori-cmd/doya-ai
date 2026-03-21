export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildSuggestFieldsPrompt } from '@/lib/lp/prompts'
import type { LpProductInfo, LpPurpose } from '@/lib/lp/types'

interface SuggestFieldsResponse {
  description?: string
  target?: string
  price?: string
  ctaGoal?: string
  features?: string[]
  problems?: string[]
  purposes?: string[]
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { partialInfo, trigger = 'all' } = await req.json() as {
      partialInfo: Partial<LpProductInfo> & { purposes?: LpPurpose[] }
      trigger?: 'name' | 'description' | 'all'
    }

    if (!partialInfo?.name?.trim()) {
      return NextResponse.json({ error: '商品名を入力してください。' }, { status: 400 })
    }

    const prompt = buildSuggestFieldsPrompt(partialInfo, trigger)
    const suggestions = await geminiGenerateJson<SuggestFieldsResponse>({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      prompt,
    })

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('[POST /api/lp/suggest-fields]', error)
    return NextResponse.json(
      { error: 'AIによる提案の生成に失敗しました。もう一度お試しください。' },
      { status: 500 }
    )
  }
}
