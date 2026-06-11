export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'
import { reserveMonthlySlides, releaseMonthlySlides, quotaExceededMessage } from '@/lib/doyaslide/limits'
import { reviseSlidePrompt } from '@/lib/doyaslide/vision'
import { fetchBuffer } from '@/lib/doyaslide/logo'
import { raceTimeout } from '@/lib/fetch-timeout'
import { composeSlideImage, type ComposeProject } from '@/lib/doyaslide/generate'

// POST /api/doyaslide/slides/[id]/chat — チャットで指示 → 再生成方式で修正
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = 'then' in ctx.params ? await ctx.params : ctx.params

    const body = await req.json().catch(() => ({}))
    const message = (body.message as string)?.trim()
    if (!message) return NextResponse.json({ error: 'メッセージを入力してください' }, { status: 400 })

    const slide = await prisma.doyaSlideSlide.findUnique({
      where: { id: p.id },
      include: { project: true },
    })
    if (!slide || slide.project.userId !== userId) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    }

    // チャット修正も再生成＝1枚分の生成クレジットを原子的に消費（並行でも上限超過しない）
    const { granted, limit } = await reserveMonthlySlides(userId, 1)
    if (granted < 1) {
      return NextResponse.json({ error: quotaExceededMessage(limit) }, { status: 403 })
    }

    // ユーザー発話を記録
    await prisma.doyaSlideChatMessage.create({
      data: { slideId: slide.id, role: 'user', content: message },
    })

    const project = slide.project

    // 現在の画像を Gemini(Vision) に見せ、忠実再現＋指示反映の新プロンプトを作る → gpt-image-2 で生成。
    // 画像が未生成 or Vision失敗時は、従来どおり指示を追記した通常再生成にフォールバック。
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

    let r
    try {
      r = await composeSlideImage(
        userId,
        project as ComposeProject,
        { index: slide.index, role: slide.role, headline: slide.headline, subText: slide.subText, visualPrompt: slide.visualPrompt },
        revisedPrompt ? undefined : message, // Vision成功時はoverride、失敗時は指示を追記して通常再生成
        revisedPrompt
      )
    } catch (e) {
      // 生成失敗ならクレジットを戻す
      await releaseMonthlySlides(userId, 1)
      throw e
    }
    const nextVersion = (slide.version || 1) + 1
    const newVisual = revisedPrompt || slide.visualPrompt

    // 画像確定とバージョン記録を原子化（片方だけ成功＝不整合を防ぐ）
    const [updated] = await prisma.$transaction([
      prisma.doyaSlideSlide.update({
        where: { id: slide.id },
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
    ])

    const reply = '修正を反映しました！'
    await prisma.doyaSlideChatMessage.create({
      data: { slideId: slide.id, role: 'assistant', content: reply },
    })

    return NextResponse.json({ slide: updated, reply })
  } catch (e: any) {
    console.error('[doyaslide/chat]', e?.message)
    return NextResponse.json({ error: '修正に失敗しました' }, { status: 500 })
  }
}
