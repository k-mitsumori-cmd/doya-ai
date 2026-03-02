// ============================================
// POST /api/copy/generate
// ============================================
// ディスプレイ広告コピーをSSEストリーミングで生成

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  COPY_PRICING,
  getCopyMonthlyLimitByUserPlan,
  shouldResetMonthlyUsage,
  isWithinFreeHour,
} from '@/lib/pricing'
import { generateDisplayCopiesForType, WRITER_TYPES } from '@/lib/copy/gemini'
import type { ProductInfo, PersonaData, CopyRegulations } from '@/lib/copy/gemini'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    const body = await req.json()
    const {
      projectId,
      productInfo,
      persona,
      regulations,
      purpose,
      writerTypes,
    } = body as {
      projectId: string
      productInfo: ProductInfo
      persona: PersonaData
      regulations?: CopyRegulations
      purpose?: string
      writerTypes?: string[]
    }

    if (!projectId || !productInfo || !persona) {
      return NextResponse.json({ error: 'projectId、productInfo、personaは必須です' }, { status: 400 })
    }

    // 生成するライタータイプ（指定がなければ全タイプ）
    const targetWriterTypes = (writerTypes?.length ? writerTypes : WRITER_TYPES)
      .filter(w => WRITER_TYPES.includes(w))

    // ===== 使用制限チェック =====
    let monthlyLimit = COPY_PRICING.guestLimit
    let usedThisMonth = 0
    let isUnlimited = false

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, firstLoginAt: true },
      })

      if (user) {
        if (isWithinFreeHour(user.firstLoginAt)) isUnlimited = true

        monthlyLimit = getCopyMonthlyLimitByUserPlan(user.plan)
        if (monthlyLimit < 0) isUnlimited = true

        // UserServiceSubscription で月次使用回数管理
        let sub = await prisma.userServiceSubscription.findUnique({
          where: { userId_serviceId: { userId, serviceId: 'copy' } },
        })

        if (!sub) {
          sub = await prisma.userServiceSubscription.create({
            data: { userId, serviceId: 'copy', plan: user.plan || 'FREE' },
          })
        }

        // 月次リセット
        if (shouldResetMonthlyUsage(sub.lastUsageReset)) {
          await prisma.userServiceSubscription.update({
            where: { id: sub.id },
            data: { monthlyUsage: 0, lastUsageReset: new Date() },
          })
          usedThisMonth = 0
        } else {
          usedThisMonth = sub.monthlyUsage || 0
        }
      }
    } else {
      // ゲストは制限あり（セッション管理が難しいのでゆるめに）
      monthlyLimit = COPY_PRICING.guestLimit
    }

    // 制限チェック（ログインユーザーのみ）
    if (userId && !isUnlimited && usedThisMonth >= monthlyLimit) {
      return NextResponse.json(
        {
          error: `今月の生成上限（${monthlyLimit}回）に達しました`,
          limitReached: true,
          usedThisMonth,
          monthlyLimit,
        },
        { status: 429 }
      )
    }

    // プロジェクト存在確認
    const project = await prisma.copyProject.findUnique({
      where: { id: projectId },
      select: { userId: true, guestId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    if (project.userId && project.userId !== userId) {
      return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
    }

    // ===== SSEストリーミング開始 =====
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
          safeEnqueue(`data: ${JSON.stringify({ type: 'start', message: 'コピー生成を開始します...' })}\n\n`)

          // プロジェクトをgenerating状態に
          await prisma.copyProject.update({
            where: { id: projectId },
            data: { status: 'generating' },
          })

          for (const writerType of targetWriterTypes) {
            safeEnqueue(`data: ${JSON.stringify({
              type: 'progress',
              writerType,
              message: `${getWriterTypeName(writerType)}型コピーを生成中...`,
            })}\n\n`)

            try {
              const typeCopies = await generateDisplayCopiesForType(
                writerType,
                productInfo,
                persona,
                regulations,
                purpose,
              )

              for (const copy of typeCopies) {
                // DBに保存
                const saved = await prisma.copyItem.create({
                  data: {
                    projectId,
                    type: 'display',
                    platform: 'display',
                    writerType: copy.writerType,
                    headline: copy.headline,
                    description: copy.description,
                    catchcopy: copy.catchcopy,
                    cta: copy.cta,
                    appealAxis: copy.appealAxis,
                  },
                })

                safeEnqueue(`data: ${JSON.stringify({
                  type: 'copy_generated',
                  copy: saved,
                })}\n\n`)
              }
            } catch (e) {
              console.error(`Writer type ${writerType} generation failed:`, e)
              safeEnqueue(`data: ${JSON.stringify({
                type: 'writer_error',
                writerType,
                message: `${getWriterTypeName(writerType)}型の生成に失敗しました`,
              })}\n\n`)
            }
          }

          // プロジェクト完了
          await prisma.copyProject.update({
            where: { id: projectId },
            data: { status: 'active' },
          })

          // 使用回数インクリメント
          if (userId) {
            await prisma.userServiceSubscription.update({
              where: { userId_serviceId: { userId, serviceId: 'copy' } },
              data: { monthlyUsage: { increment: 1 } },
            })
          }

          safeEnqueue(`data: ${JSON.stringify({
            type: 'complete',
            message: 'コピー生成が完了しました',
            projectId,
          })}\n\n`)
        } catch (e: any) {
          console.error('Copy generate stream error:', e)
          safeEnqueue(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`)
          await prisma.copyProject.update({
            where: { id: projectId },
            data: { status: 'error' },
          }).catch(() => {})
        } finally {
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
  } catch (error: any) {
    console.error('Copy generate error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function getWriterTypeName(writerType: string): string {
  const names: Record<string, string> = {
    straight: 'ストレート',
    emotional: 'エモーショナル',
    logical: 'ロジカル',
    provocative: 'プロボカティブ',
    story: 'ストーリー',
  }
  return names[writerType] || writerType
}
