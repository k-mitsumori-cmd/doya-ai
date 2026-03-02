import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/movie/assets?userId=...&projectId=...
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId') ?? 'guest'
    const projectId = searchParams.get('projectId') ?? 'temp'

    const { data: files, error } = await getSupabase().storage
      .from('movie-assets')
      .list(`${userId}/${projectId}`, { sortBy: { column: 'created_at', order: 'desc' } })

    if (error) throw error

    const assets = await Promise.all(
      (files ?? []).map(async (f) => {
        const { data } = await getSupabase().storage
          .from('movie-assets')
          .createSignedUrl(`${userId}/${projectId}/${f.name}`, 3600)
        return { name: f.name, url: data?.signedUrl ?? '', size: f.metadata?.size }
      })
    )

    return NextResponse.json({ assets })
  } catch (error) {
    console.error('[GET /api/movie/assets]', error)
    return NextResponse.json({ assets: [] })
  }
}
