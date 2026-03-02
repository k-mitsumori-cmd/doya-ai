// ============================================
// GET/POST/DELETE /api/copy/brand-voice
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - ブランドボイス一覧
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json({ brandVoices: [] })
    }

    const brandVoices = await prisma.copyBrandVoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ brandVoices })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - ブランドボイス作成/更新
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const { id, name, tone, vocabulary, examples, ngWords, requiredWords } = await req.json()

    if (!name) {
      return NextResponse.json({ error: '名前は必須です' }, { status: 400 })
    }

    let brandVoice
    if (id) {
      // 更新
      const existing = await prisma.copyBrandVoice.findUnique({ where: { id } })
      if (!existing || existing.userId !== userId) {
        return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
      }
      brandVoice = await prisma.copyBrandVoice.update({
        where: { id },
        data: { name, tone, vocabulary, examples, ngWords: ngWords || [], requiredWords: requiredWords || [] },
      })
    } else {
      // 新規作成
      brandVoice = await prisma.copyBrandVoice.create({
        data: {
          userId,
          name,
          tone: tone || 'professional',
          vocabulary: vocabulary || '',
          examples: examples || '',
          ngWords: ngWords || [],
          requiredWords: requiredWords || [],
        },
      })
    }

    return NextResponse.json({ success: true, brandVoice })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - ブランドボイス削除
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
    }

    const existing = await prisma.copyBrandVoice.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
    }

    await prisma.copyBrandVoice.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
