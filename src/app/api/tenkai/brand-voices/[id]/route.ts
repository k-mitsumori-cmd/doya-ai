// ============================================
// GET / PUT / DELETE /api/tenkai/brand-voices/[id]
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.id
}

/**
 * GET — ブランドボイス詳細
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const id = await resolveId(ctx)

    const brandVoice = await prisma.tenkaiBrandVoice.findUnique({
      where: { id },
    })

    if (!brandVoice || brandVoice.userId !== userId) {
      return NextResponse.json({ error: 'ブランドボイスが見つかりません' }, { status: 404 })
    }

    return NextResponse.json({ brandVoice })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] brand-voice detail error:', message)
    return NextResponse.json(
      { error: message || 'ブランドボイスの取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * PUT — ブランドボイス更新
 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const id = await resolveId(ctx)

    const existing = await prisma.tenkaiBrandVoice.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'ブランドボイスが見つかりません' }, { status: 404 })
    }

    const body = await req.json()
    const {
      name,
      firstPerson,
      formalityLevel,
      enthusiasmLevel,
      technicalLevel,
      humorLevel,
      targetAudience,
      sampleText,
      preferredExpressions,
      prohibitedWords,
      isDefault,
    } = body

    const data: Record<string, unknown> = {}
    if (name !== undefined) {
      const trimmed = typeof name === 'string' ? name.trim() : ''
      if (!trimmed) return NextResponse.json({ error: '名前は空にできません' }, { status: 400 })
      data.name = trimmed
    }
    if (firstPerson !== undefined) data.firstPerson = firstPerson
    if (formalityLevel !== undefined) data.formalityLevel = Math.min(5, Math.max(1, Number(formalityLevel) || 3))
    if (enthusiasmLevel !== undefined) data.enthusiasmLevel = Math.min(5, Math.max(1, Number(enthusiasmLevel) || 3))
    if (technicalLevel !== undefined) data.technicalLevel = Math.min(5, Math.max(1, Number(technicalLevel) || 3))
    if (humorLevel !== undefined) data.humorLevel = Math.min(5, Math.max(1, Number(humorLevel) || 3))
    if (targetAudience !== undefined) data.targetAudience = targetAudience
    if (sampleText !== undefined) data.sampleText = sampleText
    if (preferredExpressions !== undefined) data.preferredExpressions = preferredExpressions
    if (prohibitedWords !== undefined) data.prohibitedWords = prohibitedWords
    if (isDefault !== undefined) data.isDefault = isDefault

    // isDefault を true にする場合、既存のデフォルトを解除（トランザクションで安全に実行）
    const updated = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.tenkaiBrandVoice.updateMany({
          where: { userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        })
      }
      return tx.tenkaiBrandVoice.update({ where: { id }, data })
    })

    return NextResponse.json({ brandVoice: updated })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] brand-voice update error:', message)
    return NextResponse.json(
      { error: message || 'ブランドボイスの更新に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * DELETE — ブランドボイス削除
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const id = await resolveId(ctx)

    const existing = await prisma.tenkaiBrandVoice.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'ブランドボイスが見つかりません' }, { status: 404 })
    }

    await prisma.tenkaiBrandVoice.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] brand-voice delete error:', message)
    return NextResponse.json(
      { error: message || 'ブランドボイスの削除に失敗しました' },
      { status: 500 }
    )
  }
}
