// ============================================
// GET / PUT / DELETE /api/interview/recipes/[id]
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, requireDatabase } from '@/lib/interview/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.id
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const id = await resolveId(ctx)
    const { userId } = await getInterviewUser()
    const recipe = await prisma.interviewRecipe.findUnique({ where: { id } })

    if (!recipe) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    // テンプレート・公開以外は所有者のみアクセス可
    if (!recipe.isTemplate && !recipe.isPublic && recipe.userId !== userId) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      recipe: {
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        category: recipe.category,
        proposals: recipe.proposals,
        questions: recipe.questions,
        editingGuidelines: recipe.editingGuidelines,
        isTemplate: recipe.isTemplate,
        isPublic: recipe.isPublic,
        usageCount: recipe.usageCount,
        createdAt: recipe.createdAt.toISOString(),
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '取得に失敗しました' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const id = await resolveId(ctx)
    const { userId } = await getInterviewUser()

    if (!userId) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const recipe = await prisma.interviewRecipe.findUnique({ where: { id } })
    if (!recipe) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    // プリセットは編集不可
    if (recipe.isTemplate) {
      return NextResponse.json(
        { success: false, error: 'プリセットレシピは編集できません。複製してカスタマイズしてください。' },
        { status: 403 }
      )
    }

    if (recipe.userId !== userId) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    const body = await req.json()
    const allowedFields = ['name', 'description', 'category', 'proposals', 'questions', 'editingGuidelines']
    const data: Record<string, any> = {}
    for (const key of allowedFields) {
      if (key in body) data[key] = body[key]
    }

    const updated = await prisma.interviewRecipe.update({ where: { id }, data })

    return NextResponse.json({
      success: true,
      recipe: { id: updated.id, name: updated.name, updatedAt: updated.updatedAt.toISOString() },
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '更新に失敗しました' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const id = await resolveId(ctx)
    const { userId } = await getInterviewUser()

    if (!userId) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const recipe = await prisma.interviewRecipe.findUnique({ where: { id } })
    if (!recipe) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    if (recipe.isTemplate) {
      return NextResponse.json(
        { success: false, error: 'プリセットレシピは削除できません' },
        { status: 403 }
      )
    }

    if (recipe.userId !== userId) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    await prisma.interviewRecipe.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '削除に失敗しました' },
      { status: 500 }
    )
  }
}