import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// レシピ一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    const recipes = await prisma.interviewRecipe.findMany({
      where: {
        OR: [
          { userId: userId || undefined },
          { isPublic: true },
          { isTemplate: true },
        ],
      },
      orderBy: { usageCount: 'desc' },
      take: 100,
    })

    return NextResponse.json({ recipes })
  } catch (error) {
    console.error('[INTERVIEW] Recipes fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 })
  }
}

// レシピ作成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, category, proposals, questions, editingGuidelines, isPublic, isTemplate } = body

    const recipe = await prisma.interviewRecipe.create({
      data: {
        userId: session.user.id,
        name: name || '無題のレシピ',
        description,
        category,
        proposals: proposals || [],
        questions: questions || [],
        editingGuidelines,
        isPublic: isPublic || false,
        isTemplate: isTemplate || false,
      },
    })

    return NextResponse.json({ recipe })
  } catch (error) {
    console.error('[INTERVIEW] Recipe creation error:', error)
    return NextResponse.json({ error: 'Failed to create recipe' }, { status: 500 })
  }
}


