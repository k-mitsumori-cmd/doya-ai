// ============================================
// POST /api/tenkai/generate/regenerate
// ============================================
// フィードバック付き再生成

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkTenkaiUsage, incrementTenkaiUsage, getTenkaiPlan } from '@/lib/tenkai/access'
import { generateForPlatform, GenerationOptions } from '@/lib/tenkai/generation-pipeline'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const body = await req.json()
    const { outputId, feedback, brandVoiceId } = body as {
      outputId: string
      feedback: string
      brandVoiceId?: string
    }

    if (!outputId || !feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
      return NextResponse.json(
        { error: 'outputId と 空でないfeedback は必須です' },
        { status: 400 }
      )
    }
    if (feedback.length > 5000) {
      return NextResponse.json(
        { error: 'フィードバックは5000文字以下にしてください' },
        { status: 400 }
      )
    }

    // 利用制限チェック
    const plan = await getTenkaiPlan(userId)
    const usageErr = await checkTenkaiUsage(userId, plan)
    if (usageErr) return usageErr

    // 出力取得
    const existingOutput = await prisma.tenkaiOutput.findUnique({
      where: { id: outputId },
      include: { project: true },
    })

    if (!existingOutput || existingOutput.project.userId !== userId) {
      return NextResponse.json({ error: '出力が見つかりません' }, { status: 404 })
    }

    const project = existingOutput.project
    if (!project.analysis) {
      return NextResponse.json(
        { error: 'コンテンツ分析が完了していません' },
        { status: 400 }
      )
    }

    // ブランドボイス取得
    let brandVoice = null
    const bvId = brandVoiceId || existingOutput.brandVoiceId
    if (bvId) {
      const bv = await prisma.tenkaiBrandVoice.findUnique({
        where: { id: bvId },
      })
      if (bv && bv.userId === userId) {
        brandVoice = {
          name: bv.name,
          firstPerson: bv.firstPerson,
          formalityLevel: bv.formalityLevel,
          enthusiasmLevel: bv.enthusiasmLevel,
          technicalLevel: bv.technicalLevel,
          humorLevel: bv.humorLevel,
          targetAudience: bv.targetAudience,
          sampleText: bv.sampleText,
          preferredExpressions: bv.preferredExpressions,
          prohibitedWords: bv.prohibitedWords,
        }
      }
    }

    // フィードバックをカスタム指示として渡す
    const feedbackInstruction = `## 前回の出力に対するフィードバック
以下のフィードバックを反映して、改善された出力を生成してください:
${feedback}

## 前回の出力内容（参考）
${JSON.stringify(existingOutput.content, null, 2).slice(0, 2000)}`

    const options: GenerationOptions = {
      brandVoice,
      customInstructions: feedbackInstruction,
    }

    const result = await generateForPlatform(
      project.analysis as Record<string, unknown>,
      existingOutput.platform,
      options
    )

    // 新バージョンとして保存
    const lastOutput = await prisma.tenkaiOutput.findFirst({
      where: { projectId: project.id, platform: existingOutput.platform },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const nextVersion = (lastOutput?.version ?? 0) + 1

    const newOutput = await prisma.tenkaiOutput.create({
      data: {
        projectId: project.id,
        platform: existingOutput.platform,
        content: result.content as any,
        charCount: result.charCount as number,
        qualityScore: result.qualityScore as number,
        status: 'completed',
        tokensUsed: result.tokensUsed as number,
        brandVoiceId: bvId || null,
        feedback,
        version: nextVersion,
      },
    })

    await incrementTenkaiUsage(userId, result.tokensUsed)

    return NextResponse.json({
      outputId: newOutput.id,
      platform: existingOutput.platform,
      version: nextVersion,
      content: result.content,
      charCount: result.charCount,
      qualityScore: result.qualityScore,
      tokensUsed: result.tokensUsed,
      validation: result.validation,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] regenerate error:', message)
    return NextResponse.json(
      { error: message || '再生成に失敗しました' },
      { status: 500 }
    )
  }
}
