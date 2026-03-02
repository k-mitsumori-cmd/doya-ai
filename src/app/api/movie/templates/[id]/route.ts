import { NextRequest, NextResponse } from 'next/server'
import { getTemplateById } from '@/lib/movie/templates'

// GET /api/movie/templates/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const template = getTemplateById(id)

  if (!template) return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
  return NextResponse.json({ template })
}
