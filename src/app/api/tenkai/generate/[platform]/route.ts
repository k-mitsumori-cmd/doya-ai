// ============================================
// POST /api/tenkai/generate/[platform]
// ============================================
// 単一プラットフォーム生成

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkTenkaiUsage, incrementTenkaiUsage, getTenkaiPlan } from '@/lib/tenkai/access'
import { generateForPlatform, GenerationOptions } from '@/lib/tenkai/generation-pipeline'
import { SUPPORTED_PLATFORMS } from '@/lib/tenkai/prompts/system'

type Ctx = { params: Promise<{ platform: string }> | { platform: string } }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const platform = p.platform

    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: `未対応のプラットフォーム: ${platform}` },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { projectId, brandVoiceId, customInstructions } = body as {
      projectId: string
      brandVoiceId?: string
      customInstructions?: string
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId は必須です' }, { status: 400 })
    }

    // 利用制限チェック
    const plan = await getTenkaiPlan(userId)
    const usageErr = await checkTenkaiUsage(userId, plan)
    if (usageErr) return usageErr

    // プロジェクト取得
    const project = await prisma.tenkaiProject.findUnique({
      where: { id: projectId },
    })

    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    if (!project.analysis) {
      return NextResponse.json(
        { error: 'コンテンツ分析が完了していません' },
        { status: 400 }
      )
    }

    // ブランドボイス取得
    let brandVoice = null
    if (brandVoiceId) {
      const bv = await prisma.tenkaiBrandVoice.findUnique({
        where: { id: brandVoiceId },
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

    const options: GenerationOptions = {
      brandVoice,
      customInstructions,
    }

    const result = await generateForPlatform(project.analysis as Record<string, unknown>, platform, options)

    // 既存の出力の最新バージョンを取得
    const lastOutput = await prisma.tenkaiOutput.findFirst({
      where: { projectId, platform },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const nextVersion = (lastOutput?.version ?? 0) + 1

    // DB保存
    const output = await prisma.tenkaiOutput.create({
      data: {
        projectId,
        platform,
        content: result.content as any,
        charCount: result.charCount as number,
        qualityScore: result.qualityScore as number,
        status: 'completed',
        tokensUsed: result.tokensUsed as number,
        brandVoiceId: brandVoiceId || null,
        version: nextVersion,
      },
    })

    await incrementTenkaiUsage(userId, result.tokensUsed)

    return NextResponse.json({
      outputId: output.id,
      platform,
      content: result.content,
      charCount: result.charCount,
      qualityScore: result.qualityScore,
      tokensUsed: result.tokensUsed,
      validation: result.validation,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] generate/platform error:', message)
    return NextResponse.json(
      { error: message || '生成に失敗しました' },
      { status: 500 }
    )
  }
}
