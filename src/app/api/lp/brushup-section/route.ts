export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildBrushupPrompt } from '@/lib/lp/prompts'
import type { LpProductInfo } from '@/lib/lp/types'

function isProPlan(plan: string | null | undefined): boolean {
  const p = String(plan || 'FREE').toUpperCase()
  return ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(p)
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // プラン制限: Pro以上のみブラッシュアップ可能
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    })
    if (!isProPlan(currentUser?.plan)) {
      return NextResponse.json(
        { error: 'セクションブラッシュアップはProプラン以上で利用可能です', upgradePath: '/lp/pricing' },
        { status: 403 }
      )
    }

    const { sectionId, instruction, productInfo } = await req.json() as {
      sectionId: string
      instruction: string
      productInfo?: LpProductInfo
    }

    if (!sectionId || !instruction) {
      return NextResponse.json({ error: 'sectionId and instruction are required' }, { status: 400 })
    }

    const section = await prisma.lpSection.findFirst({
      where: { id: sectionId },
      include: { project: true },
    })

    if (!section || !section.project || section.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const info = productInfo || (section.project.productInfo as any as LpProductInfo) || { name: '', target: '' }

    const prompt = buildBrushupPrompt(
      info,
      section.name,
      { headline: section.headline, body: section.body },
      instruction
    )

    let result: { headline: string; body: string } | null = null
    try {
      result = await geminiGenerateJson<{ headline: string; body: string }>({ model: GEMINI_TEXT_MODEL_DEFAULT, prompt })
    } catch (genErr: any) {
      console.error('[brushup-section] Gemini generation failed:', genErr)
      const errMsg = genErr?.message?.includes('quota') || genErr?.message?.includes('429')
        ? 'API利用制限に達しました。しばらく時間をおいてお試しください。'
        : 'AIによるブラッシュアップに失敗しました。もう一度お試しください。'
      return NextResponse.json({ error: errMsg }, { status: 502 })
    }

    if (!result || (!result.headline && !result.body)) {
      return NextResponse.json({ error: 'AIからの応答が不正です。指示内容を変えてもう一度お試しください。' }, { status: 502 })
    }

    // リビジョン履歴に現在のコピーを保存
    const revisions = [...((section.revisions as any[]) || []), {
      headline: section.headline,
      body: section.body,
      timestamp: new Date().toISOString(),
    }]

    const updated = await prisma.lpSection.update({
      where: { id: sectionId },
      data: {
        headline: result.headline || section.headline,
        body: result.body || section.body,
        revisions: revisions as any,
      },
    })

    return NextResponse.json({ section: updated })
  } catch (error: any) {
    console.error('[POST /api/lp/brushup-section]', error)
    const statusCode = error?.code === 'P2025' ? 404 : 500
    const message = statusCode === 404 ? 'セクションが見つかりません' : 'サーバーエラーが発生しました'
    return NextResponse.json({ error: message }, { status: statusCode })
  }
}
