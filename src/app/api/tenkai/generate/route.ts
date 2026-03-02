// ============================================
// POST /api/tenkai/generate
// ============================================
// 複数PF順次生成、SSEストリーミング

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkTenkaiUsage, incrementTenkaiUsage, getTenkaiPlan, PLAN_LIMITS } from '@/lib/tenkai/access'
import { generateForMultiplePlatforms, GenerationOptions } from '@/lib/tenkai/generation-pipeline'
import { SUPPORTED_PLATFORMS } from '@/lib/tenkai/prompts/system'

export async function POST(req: NextRequest) {
  let projectId: string | undefined
  let statusChanged = false
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const body = await req.json()
    const { projectId: pid, platforms, brandVoiceId, customInstructions } = body as {
      projectId: string
      platforms: string[]
      brandVoiceId?: string
      customInstructions?: string
    }
    projectId = pid

    if (!projectId || !platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: 'projectId と platforms（配列）は必須です' },
        { status: 400 }
      )
    }

    // プラットフォームの妥当性チェック
    const invalidPlatforms = platforms.filter((p) => !SUPPORTED_PLATFORMS.includes(p))
    if (invalidPlatforms.length > 0) {
      return NextResponse.json(
        { error: `未対応のプラットフォーム: ${invalidPlatforms.join(', ')}` },
        { status: 400 }
      )
    }

    // プラン制限チェック
    const plan = await getTenkaiPlan(userId)
    const limits = PLAN_LIMITS[plan]
    if (platforms.length > limits.platforms) {
      return NextResponse.json(
        { error: `現在のプランでは最大${limits.platforms}プラットフォームまでです` },
        { status: 403 }
      )
    }

    // 利用制限チェック
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
        { error: 'コンテンツ分析が完了していません。先に分析を実行してください。' },
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

    // ステータスを生成中に更新
    await prisma.tenkaiProject.update({
      where: { id: projectId },
      data: { status: 'generating' },
    })
    statusChanged = true

    // SSEストリーム生成
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let streamClosed = false
        const safeEnqueue = (data: string) => {
          if (!streamClosed) {
            try {
              controller.enqueue(encoder.encode(data))
            } catch {
              streamClosed = true
            }
          }
        }
        const safeClose = () => {
          if (!streamClosed) {
            streamClosed = true
            try { controller.close() } catch { /* already closed */ }
          }
        }

        try {
          const generator = generateForMultiplePlatforms(
            project.analysis as Record<string, unknown>,
            platforms,
            options
          )

          for await (const event of generator) {
            // ストリームが閉じてもDB保存のため生成は継続する
            // （クライアントがページ遷移しても全プラットフォームを生成完了させる）

            // SSEイベントを送信（ストリーム切断時はサイレントにスキップ）
            safeEnqueue(`data: ${JSON.stringify(event)}\n\n`)

            // 各プラットフォームの生成完了時にDBに保存
            if (event.type === 'generation_complete' && event.data && event.platform) {
              const result = event.data
              const eventPlatform = event.platform
              try {
                // 既存の出力の最新バージョンを取得
                const lastOutput = await prisma.tenkaiOutput.findFirst({
                  where: { projectId, platform: eventPlatform },
                  orderBy: { version: 'desc' },
                  select: { version: true },
                })
                const nextVersion = (lastOutput?.version ?? 0) + 1

                await prisma.tenkaiOutput.create({
                  data: {
                    projectId,
                    platform: eventPlatform,
                    content: result.content as any,
                    charCount: result.charCount as number,
                    qualityScore: result.qualityScore as number,
                    status: 'completed',
                    tokensUsed: result.tokensUsed as number,
                    brandVoiceId: brandVoiceId || null,
                    version: nextVersion,
                  },
                })

                await incrementTenkaiUsage(userId, result.tokensUsed as number)
              } catch (dbErr: unknown) {
                const dbMessage = dbErr instanceof Error ? dbErr.message : 'unknown'
                console.error('[tenkai] Output save error:', dbMessage)
                safeEnqueue(`data: ${JSON.stringify({ type: 'generation_error', platform: event.platform, data: { error: 'DB保存に失敗しました' } })}\n\n`)
              }
            }
          }

          // 完了ステータスに更新
          await prisma.tenkaiProject.update({
            where: { id: projectId },
            data: { status: 'completed' },
          })

          safeEnqueue('data: [DONE]\n\n')
          safeClose()
        } catch (e: unknown) {
          const errMessage = e instanceof Error ? e.message : '生成中にエラーが発生しました'
          console.error('[tenkai] SSE stream error:', errMessage)
          safeEnqueue(`data: ${JSON.stringify({ type: 'error', data: { error: errMessage } })}\n\n`)
          // プロジェクトステータスをreadyに戻す
          try {
            await prisma.tenkaiProject.update({
              where: { id: projectId },
              data: { status: 'ready' },
            })
          } catch { /* ignore */ }
          safeClose()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '生成に失敗しました'
    console.error('[tenkai] generate error:', message)

    // ステータスを ready に戻す（generating のまま放置を防止）
    if (projectId && statusChanged) {
      try {
        await prisma.tenkaiProject.update({
          where: { id: projectId },
          data: { status: 'ready' },
        })
      } catch { /* ignore recovery error */ }
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
