export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'
import { reserveMonthlySlides, releaseMonthlySlides, quotaExceededPayload } from '@/lib/doyaslide/limits'
import { reviseSlidePrompt } from '@/lib/doyaslide/vision'
import { fetchBuffer } from '@/lib/doyaslide/logo'
import { raceTimeout } from '@/lib/fetch-timeout'
import { composeSlideImage, type ComposeProject } from '@/lib/doyaslide/generate'

// POST /api/doyaslide/slides/[id]/chat — チャットで指示 → 再生成方式で修正
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = await ctx.params

    const body = await req.json().catch(() => null)
    const message = body && typeof body === 'object' && !Array.isArray(body) && typeof body.message === 'string'
      ? body.message.trim() : ''
    if (!message) return NextResponse.json({ error: 'メッセージを入力してください' }, { status: 400 })
    if (message.length > 2000) return NextResponse.json({ error: 'メッセージは2000文字以内で入力してください' }, { status: 400 })

    const slide = await prisma.doyaSlideSlide.findUnique({
      where: { id: p.id },
      include: { project: true },
    })
    if (!slide || slide.project.userId !== userId) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    }
    if (slide.status === 'generating') {
      return NextResponse.json({ error: '画像の生成中です。完了後にお試しください。' }, { status: 409 })
    }

    // チャット修正も再生成＝1枚分の生成クレジットを原子的に消費（並行でも上限超過しない）
    const { granted, limit, reservedMonth } = await reserveMonthlySlides(userId, 1)
    if (granted < 1) {
      return NextResponse.json(quotaExceededPayload(limit), { status: 403 })
    }

    let saved = false
    try {
      const project = slide.project

      // 画像が未生成またはVision失敗時は、指示を追記した通常再生成にフォールバックする。
      const currentUrl = slide.rawImageUrl || slide.imageUrl
      let revisedPrompt: string | undefined
      if (currentUrl) {
        try {
          const buf = await raceTimeout('fetchSlideImage', 30000, fetchBuffer(currentUrl))
          revisedPrompt = await reviseSlidePrompt({
            imageBase64: Buffer.from(buf).toString('base64'),
            mimeType: 'image/png',
            userInstruction: message,
            themeColor: project.themeColor,
          })
        } catch (e) {
          console.warn('[doyaslide/chat] Vision再プロンプト失敗、通常再生成にフォールバック:', (e as any)?.message)
        }
      }

      const r = await composeSlideImage(
        userId,
        project as ComposeProject,
        { index: slide.index, role: slide.role, headline: slide.headline, subText: slide.subText, visualPrompt: slide.visualPrompt },
        revisedPrompt ? undefined : message, // Vision成功時はoverride、失敗時は指示を追記して通常再生成
        revisedPrompt
      )
      const nextVersion = (slide.version || 1) + 1
      const newVisual = revisedPrompt || slide.visualPrompt
      const reply = '修正を反映しました！'

      // 画像・バージョン・対話履歴を同じトランザクションで確定する。
      const [updated] = await prisma.$transaction([
        prisma.doyaSlideSlide.update({
          where: { id: slide.id, version: slide.version, imageUrl: slide.imageUrl, visualPrompt: slide.visualPrompt, status: slide.status },
          data: {
            visualPrompt: newVisual,
            rawImageUrl: r.rawImageUrl,
            imageUrl: r.imageUrl,
            version: nextVersion,
            status: 'done',
            model: r.model,
          },
        }),
        prisma.doyaSlideVersion.create({
          data: {
            slideId: slide.id,
            version: nextVersion,
            imageUrl: r.imageUrl,
            rawImageUrl: r.rawImageUrl,
            prompt: newVisual,
          },
        }),
        prisma.doyaSlideChatMessage.create({ data: { slideId: slide.id, role: 'user', content: message } }),
        prisma.doyaSlideChatMessage.create({ data: { slideId: slide.id, role: 'assistant', content: reply } }),
      ])
      saved = true
      return NextResponse.json({ slide: updated, reply })
    } catch (e) {
      if (!saved) await releaseMonthlySlides(userId, 1, reservedMonth)
      if ((e as { code?: string })?.code === 'P2025') {
        return NextResponse.json({ error: 'スライドが変更されました。再読み込みしてお試しください。' }, { status: 409 })
      }
      throw e
    }
  } catch (e: any) {
    console.error('[doyaslide/chat]', e?.message)
    return NextResponse.json({ error: '修正に失敗しました' }, { status: 500 })
  }
}
