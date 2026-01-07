import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * ブランドキットを取得
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }
    
    const userId = (session.user as any).id
    
    const brandKit = await prisma.brandKit.findUnique({
      where: { userId },
    })
    
    return NextResponse.json({
      brandKit: brandKit || {
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        fontMood: null,
        ngWords: [],
      },
    })
  } catch (error) {
    console.error('Get brand error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

// バリデーション
const brandKitSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  fontMood: z.enum(['modern', 'traditional', 'playful', 'elegant']).nullable().optional(),
  ngWords: z.array(z.string()).optional(),
})

/**
 * ブランドキットを更新
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }
    
    const userId = (session.user as any).id
    
    const body = await req.json()
    const parseResult = brandKitSchema.safeParse(body)
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    
    const brandKit = await prisma.brandKit.upsert({
      where: { userId },
      create: {
        userId,
        logoUrl: data.logoUrl || null,
        primaryColor: data.primaryColor || null,
        secondaryColor: data.secondaryColor || null,
        fontMood: data.fontMood || null,
        ngWords: data.ngWords || [],
      },
      update: {
        logoUrl: data.logoUrl,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        fontMood: data.fontMood,
        ngWords: data.ngWords,
      },
    })
    
    return NextResponse.json({ brandKit })
  } catch (error) {
    console.error('Update brand error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

