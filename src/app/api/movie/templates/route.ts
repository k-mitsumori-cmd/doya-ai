import { NextRequest, NextResponse } from 'next/server'
import { MOVIE_TEMPLATES, getTemplatesByCategory } from '@/lib/movie/templates'

// GET /api/movie/templates
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  const templates = category
    ? getTemplatesByCategory(category)
    : MOVIE_TEMPLATES

  return NextResponse.json({ templates })
}
