import { NextRequest, NextResponse } from 'next/server'
import { getTemplateById, getTemplatesByCategory, TEMPLATE_CATEGORY_LABELS } from '@/lib/movie/templates'

// GET /api/movie/templates/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'テンプレートIDが必要です' }, { status: 400 })
    }

    const template = getTemplateById(id)

    if (!template) {
      return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
    }

    // 同カテゴリの他テンプレートも返す（関連テンプレート表示用）
    const relatedTemplates = getTemplatesByCategory(template.category)
      .filter(t => t.id !== id)
      .slice(0, 4)

    return NextResponse.json({
      template,
      categoryLabel: TEMPLATE_CATEGORY_LABELS[template.category] ?? template.category,
      relatedTemplates,
    })
  } catch (error) {
    console.error('[GET /api/movie/templates/[id]]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
