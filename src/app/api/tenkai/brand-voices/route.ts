// ============================================
// GET / POST /api/tenkai/brand-voices
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET — ブランドボイス一覧取得
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const brandVoices = await prisma.tenkaiBrandVoice.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({
      brandVoices: brandVoices.map((bv) => ({
        id: bv.id,
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
        isDefault: bv.isDefault,
        createdAt: bv.createdAt.toISOString(),
        updatedAt: bv.updatedAt.toISOString(),
      })),
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] brand-voices list error:', message)
    return NextResponse.json(
      { error: message || 'ブランドボイス一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * POST — ブランドボイス新規作成
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

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

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: '名前は必須です' }, { status: 400 })
    }

    // isDefault を true にする場合、既存のデフォルトを解除（トランザクションで安全に実行）
    const createData = {
      userId,
      name: name.trim(),
      firstPerson: firstPerson || '私',
      formalityLevel: Math.min(5, Math.max(1, Number(formalityLevel) || 3)),
      enthusiasmLevel: Math.min(5, Math.max(1, Number(enthusiasmLevel) || 3)),
      technicalLevel: Math.min(5, Math.max(1, Number(technicalLevel) || 3)),
      humorLevel: Math.min(5, Math.max(1, Number(humorLevel) || 2)),
      targetAudience: targetAudience || null,
      sampleText: sampleText || null,
      preferredExpressions: preferredExpressions || [],
      prohibitedWords: prohibitedWords || [],
      isDefault: isDefault || false,
    }

    const brandVoice = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.tenkaiBrandVoice.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        })
      }
      return tx.tenkaiBrandVoice.create({ data: createData })
    })

    return NextResponse.json({
      brandVoice: {
        id: brandVoice.id,
        name: brandVoice.name,
        isDefault: brandVoice.isDefault,
        createdAt: brandVoice.createdAt.toISOString(),
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] brand-voice create error:', message)
    return NextResponse.json(
      { error: message || 'ブランドボイスの作成に失敗しました' },
      { status: 500 }
    )
  }
}
