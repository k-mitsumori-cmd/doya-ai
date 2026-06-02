export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { getUserId } from '@/lib/doyaslide/access'
import { reserveMonthlySlides, releaseMonthlySlides, quotaExceededMessage } from '@/lib/doyaslide/limits'
import { buildChatEditPrompt } from '@/lib/doyaslide/prompts'
import { composeSlideImage, type ComposeProject } from '@/lib/doyaslide/generate'
import type { ChatEditResult } from '@/lib/doyaslide/types'

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

    // 意図分解（Gemini）
    const edit = await geminiGenerateJson<ChatEditResult>(
      { prompt: buildChatEditPrompt({ userMessage: message, slide }), model: GEMINI_TEXT_MODEL_DEFAULT },
      'ChatEdit'
    ).catch(() => ({ reply: '修正を反映して再生成します。' }) as ChatEditResult)

    // ロゴ位置/サイズ変更があればプロジェクトへ反映
    let project = slide.project
    if (edit.logoPosition || edit.logoSize) {
      project = await prisma.doyaSlideProject.update({
        where: { id: project.id },
        data: {
          ...(edit.logoPosition ? { logoPosition: edit.logoPosition } : {}),
          ...(edit.logoSize ? { logoSize: edit.logoSize } : {}),
        },
      })
    }

    // スライドの文言/ビジュアル方針を更新（再生成方式）
    const newHeadline = edit.headline ?? slide.headline
    const newSubText = edit.subText ?? slide.subText
    const newVisual = edit.visualPrompt ?? slide.visualPrompt

    let r
    try {
      r = await composeSlideImage(
        userId,
        project as ComposeProject,
        { role: slide.role, headline: newHeadline, subText: newSubText, visualPrompt: newVisual },
        message // チャット指示を画像生成に追記
      )
    } catch (e) {
      // 生成失敗ならクレジットを戻す
      await releaseMonthlySlides(userId, 1)
      throw e
    }
    const nextVersion = (slide.version || 1) + 1

    const updated = await prisma.doyaSlideSlide.update({
      where: { id: slide.id },
      data: {
        headline: newHeadline,
        subText: newSubText,
        visualPrompt: newVisual,
        rawImageUrl: r.rawImageUrl,
        imageUrl: r.imageUrl,
        version: nextVersion,
        status: 'done',
      },
    })
    await prisma.doyaSlideVersion.create({
      data: {
        slideId: slide.id,
        version: nextVersion,
        imageUrl: r.imageUrl,
        rawImageUrl: r.rawImageUrl,
        prompt: newVisual,
      },
    })

    const reply = edit.reply || '修正を反映しました！'
    await prisma.doyaSlideChatMessage.create({
      data: { slideId: slide.id, role: 'assistant', content: reply, appliedChanges: edit as any },
    })

    return NextResponse.json({ slide: updated, reply })
  } catch (e: any) {
    console.error('[doyaslide/chat]', e?.message)
    return NextResponse.json({ error: '修正に失敗しました' }, { status: 500 })
  }
}
