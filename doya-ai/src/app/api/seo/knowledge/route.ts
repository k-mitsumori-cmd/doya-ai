import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { z } from 'zod'

const CreateSchema = z.object({
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(20000),
})

/**
 * ユーザーの「独自情報（学習用ナレッジ）」を管理するAPI
 * - SEO生成プロンプトに自動で差し込まれる
 */
export async function GET(_req: NextRequest) {
  try {
    await ensureSeoSchema()
    const session = await getServerSession(authOptions)
    const userId = String((session?.user as any)?.id || '')
    if (!userId) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }

    const items = await (prisma as any).seoKnowledgeItem.findMany({
      where: { userId, type: 'user_knowledge' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ success: true, items })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeoSchema()
    const session = await getServerSession(authOptions)
    const userId = String((session?.user as any)?.id || '')
    if (!userId) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }

    const body = CreateSchema.parse(await req.json())
    const item = await (prisma as any).seoKnowledgeItem.create({
      data: {
        userId,
        type: 'user_knowledge',
        title: body.title,
        content: body.content,
        sourceUrls: null,
      },
    })

    return NextResponse.json({ success: true, item })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 400 }
    )
  }
}


