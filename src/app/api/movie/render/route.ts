import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createRenderJob, renderVideo, failRenderJob } from '@/lib/movie/render'
import { getGuestIdFromRequest } from '@/lib/movie/access'
import type { RenderConfig } from '@/lib/movie/types'

export const maxDuration = 300 // Vercel Pro: 最大300秒

// ---- プラン判定ヘルパー ----

function isProPlan(plan: string | null | undefined): boolean {
  const p = String(plan || 'FREE').toUpperCase()
  return ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(p)
}

function isLightOrAbove(plan: string | null | undefined): boolean {
  const p = String(plan || 'FREE').toUpperCase()
  return ['LIGHT', 'PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(p)
}

/** プラン別の最大動画尺（秒） */
function getMaxDuration(plan: string): number {
  const p = plan.toUpperCase()
  if (['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(p)) return 60
  if (p === 'LIGHT') return 30
  return 15 // FREE / GUEST
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const guestId = getGuestIdFromRequest(req)

    let userId: string | null = null
    let userPlan = 'FREE'
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
      userId = user?.id ?? null

      // ユーザーのmovieプランを取得
      if (userId) {
        const subscription = await prisma.userServiceSubscription.findUnique({
          where: { userId_serviceId: { userId, serviceId: 'movie' } },
        })
        userPlan = subscription?.plan ?? 'FREE'
      }
    }
    // ゲストの場合はFREE扱い

    const body = await req.json()
    const { projectId, format = 'mp4', bgmUrl } = body

    // プロジェクト取得・権限確認
    const project = await prisma.movieProject.findUnique({
      where: { id: projectId },
      include: { scenes: { orderBy: { order: 'asc' } } },
    })

    if (!project) return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })

    const isOwner = (userId && project.userId === userId) || (guestId && project.guestId === guestId)
    if (!isOwner) return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })

    // ---- プラン別制限チェック ----

    // 1. 動画尺(Duration)制限
    const maxDur = getMaxDuration(userPlan)
    if (project.duration > maxDur) {
      return NextResponse.json(
        {
          error: `現在のプラン（${userPlan}）では${maxDur}秒以下の動画のみ生成できます。動画尺を${maxDur}秒以下に変更するか、プランをアップグレードしてください。`,
          code: 'DURATION_LIMIT',
          maxDuration: maxDur,
          upgradePath: '/movie/pricing',
        },
        { status: 403 }
      )
    }

    // 2. GIF出力制限（Pro以上のみ）
    if (format === 'gif' && !isProPlan(userPlan)) {
      return NextResponse.json(
        {
          error: 'GIF出力はProプラン以上で利用可能です。MP4形式をご利用いただくか、プランをアップグレードしてください。',
          code: 'GIF_PRO_ONLY',
          upgradePath: '/movie/pricing',
        },
        { status: 403 }
      )
    }

    // 3. 透かし(Watermark)設定: Freeプランのみ true
    const watermark = !isLightOrAbove(userPlan)

    // レンダリングJobを作成
    const job = await createRenderJob(projectId, format)

    // プロジェクトのstatusをrenderingに更新
    await prisma.movieProject.update({ where: { id: projectId }, data: { status: 'rendering' } })

    // Kling API用の設定を構築
    const config: RenderConfig = {
      projectId,
      scenes: project.scenes.map(s => ({
        id: s.id,
        order: s.order,
        duration: s.duration,
        bgType: s.bgType as 'image' | 'video' | 'color' | 'gradient',
        bgValue: s.bgValue ?? undefined,
        bgAnimation: (s.bgAnimation ?? 'none') as 'ken-burns' | 'zoom-in' | 'none',
        texts: (Array.isArray(s.texts) ? s.texts : []) as any[],
        narrationText: s.narrationText ?? undefined,
        narrationUrl: s.narrationUrl ?? undefined,
        transition: s.transition as 'fade' | 'slide' | 'wipe' | 'zoom' | 'none',
        videoPrompt: (s.metadata as any)?.videoPrompt ?? undefined,
        referenceImageUrl: (s.metadata as any)?.referenceImageUrl ?? undefined,
      })),
      aspectRatio: project.aspectRatio as '16:9' | '9:16' | '1:1' | '4:5',
      totalDuration: project.duration,
      productInfo: project.productInfo as any,
      watermark,
      ...(bgmUrl && { bgmUrl }),
    }

    // バックグラウンド実行（awaitしない）
    renderVideo(job.id, config, userId ?? guestId ?? 'guest').catch(async (err) => {
      console.error('[renderVideo]', err)
      await failRenderJob(job.id, String(err))
      await prisma.movieProject.update({ where: { id: projectId }, data: { status: 'failed' } })
    })

    return NextResponse.json({ jobId: job.id, status: 'queued' })
  } catch (error) {
    console.error('[POST /api/movie/render]', error)
    return NextResponse.json({ error: 'レンダリング開始に失敗しました' }, { status: 500 })
  }
}
