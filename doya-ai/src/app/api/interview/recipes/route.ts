// ============================================
// GET / POST /api/interview/recipes
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, requireDatabase } from '@/lib/interview/access'
import { PRESET_RECIPES } from '@/lib/interview/recipes-seed'

/**
 * プリセットレシピがDBに存在しなければ自動投入
 */
async function ensurePresetRecipes(): Promise<void> {
  const existing = await prisma.interviewRecipe.count({
    where: { isTemplate: true },
  })
  if (existing >= PRESET_RECIPES.length) return

  for (const preset of PRESET_RECIPES) {
    const exists = await prisma.interviewRecipe.findFirst({
      where: { name: preset.name, isTemplate: true },
    })
    if (exists) continue

    await prisma.interviewRecipe.create({
      data: {
        name: preset.name,
        description: preset.description,
        category: preset.category,
        proposals: preset.proposals as any,
        questions: preset.questions as any,
        editingGuidelines: preset.editingGuidelines,
        isPublic: true,
        isTemplate: true,
        userId: null,
      },
    })
  }
}

/**
 * GET — レシピ一覧 (プリセット + ユーザーのカスタム)
 */
export async function GET(req: NextRequest) {
  const dbErr = requireDatabase()
  if (dbErr) return NextResponse.json({ success: true, recipes: [] })

  try {
    await ensurePresetRecipes()

    const { userId } = await getInterviewUser()

    // プリセット + ユーザー所有のカスタムレシピ
    const recipes = await prisma.interviewRecipe.findMany({
      where: {
        OR: [
          { isTemplate: true },
          ...(userId ? [{ userId }] : []),
        ],
      },
      orderBy: [
        { isTemplate: 'desc' },
        { usageCount: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({
      success: true,
      recipes: recipes.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category,
        proposals: r.proposals,
        questions: r.questions,
        editingGuidelines: r.editingGuidelines,
        isTemplate: r.isTemplate,
        isPublic: r.isPublic,
        usageCount: r.usageCount,
        createdAt: r.createdAt.toISOString(),
      })),
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'レシピ一覧取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * POST — カスタムレシピ作成
 */
export async function POST(req: NextRequest) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const { userId } = await getInterviewUser()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'カスタムレシピの作成にはログインが必要です' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { name, description, category, proposals, questions, editingGuidelines } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'レシピ名は必須です' },
        { status: 400 }
      )
    }

    const recipe = await prisma.interviewRecipe.create({
      data: {
        userId,
        name: name.trim(),
        description: description || null,
        category: category || 'custom',
        proposals: proposals || [],
        questions: questions || [],
        editingGuidelines: editingGuidelines || null,
        isPublic: false,
        isTemplate: false,
      },
    })

    return NextResponse.json({
      success: true,
      recipe: {
        id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        createdAt: recipe.createdAt.toISOString(),
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'レシピ作成に失敗しました' },
      { status: 500 }
    )
  }
}