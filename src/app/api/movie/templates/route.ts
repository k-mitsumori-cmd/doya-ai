import { NextRequest, NextResponse } from 'next/server'
import { MOVIE_TEMPLATES, getTemplatesByCategory } from '@/lib/movie/templates'
import { SERVICE_RETIRED, retiredServiceResponse } from '@/lib/retired-service'

// GET /api/movie/templates
export async function GET(req: NextRequest) {
  // ⚠️ 提供終了。入口だけ閉じる（本体とデータは復旧の余地のため残す）
  if (SERVICE_RETIRED) return retiredServiceResponse('ドヤムービーAI')

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  const templates = category
    ? getTemplatesByCategory(category)
    : MOVIE_TEMPLATES

  return NextResponse.json({ templates })
}
