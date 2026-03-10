// ============================================
// GET/POST /api/interviewx/templates
// ============================================
// テンプレート一覧取得・カスタムテンプレート作成
//
// GET: プリセット + ユーザー独自テンプレートを返す
//   - プリセットが存在しない場合は自動シード
// POST: カスタムテンプレート作成（認証必須）

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, requireDatabase } from '@/lib/interviewx/access'
import { PRESET_TEMPLATES } from '@/lib/interviewx/templates-seed'

// --------------------------------------------------
// GET — テンプレート一覧
// --------------------------------------------------
export async function GET() {
  try {
    const dbErr = requireDatabase()
    if (dbErr) return dbErr

    const { userId } = await getInterviewXUser()

    // プリセットテンプレートが存在しなければ自動シード
    const presetCount = await prisma.interviewXTemplate.count({
      where: { isPreset: true },
    })

    if (presetCount === 0) {
      await prisma.interviewXTemplate.createMany({
        data: PRESET_TEMPLATES.map((t) => ({
          name: t.name,
          description: t.description,
          category: t.category,
          icon: t.icon,
          defaultQuestions: t.defaultQuestions as any,
          promptTemplate: t.promptTemplate,
          sampleArticle: t.sampleArticle || null,
          isPreset: true,
          isPublic: true,
        })),
      })
    }

    // プリセット + ユーザー独自テンプレートを取得
    const templates = await prisma.interviewXTemplate.findMany({
      where: {
        OR: [
          { isPreset: true },
          ...(userId ? [{ userId }] : []),
        ],
      },
      orderBy: [
        { isPreset: 'desc' },
        { createdAt: 'asc' },
      ],
    })

    return NextResponse.json({ success: true, templates })
  } catch (e: any) {
    console.error('[interviewx/templates] GET error:', e?.message)
    return NextResponse.json(
      { success: false, error: 'テンプレート取得に失敗しました' },
      { status: 500 }
    )
  }
}

// --------------------------------------------------
// POST — カスタムテンプレート作成
// --------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const dbErr = requireDatabase()
    if (dbErr) return dbErr

    const { userId } = await getInterviewXUser()
    const authErr = requireAuth(userId)
    if (authErr) return authErr

    const body = await req.json()
    const { name, description, category, icon, defaultQuestions, promptTemplate, sampleArticle } = body as {
      name: string
      description?: string
      category: string
      icon?: string
      defaultQuestions?: any
      promptTemplate?: string
      sampleArticle?: string
    }

    if (!name || !category) {
      return NextResponse.json(
        { success: false, error: 'name と category は必須です' },
        { status: 400 }
      )
    }

    const template = await prisma.interviewXTemplate.create({
      data: {
        name,
        description: description || null,
        category,
        icon: icon || '📋',
        defaultQuestions: defaultQuestions || null,
        promptTemplate: promptTemplate || null,
        sampleArticle: sampleArticle || null,
        isPreset: false,
        isPublic: false,
        userId: userId!,
      },
    })

    return NextResponse.json({ success: true, template }, { status: 201 })
  } catch (e: any) {
    console.error('[interviewx/templates] POST error:', e?.message)
    return NextResponse.json(
      { success: false, error: 'テンプレート作成に失敗しました' },
      { status: 500 }
    )
  }
}
