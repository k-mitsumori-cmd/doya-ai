import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST /api/movie/upload-asset - 素材アップロード（署名付きURL生成）
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const body = await req.json()
    const { fileName, contentType, projectId, userId } = body

    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'ファイル名とコンテンツタイプが必要です' }, { status: 400 })
    }

    const bucket = 'movie-assets'
    const path = `${userId ?? 'guest'}/${projectId ?? 'temp'}/${Date.now()}_${fileName}`

    const { data, error } = await getSupabase().storage
      .from(bucket)
      .createSignedUploadUrl(path)

    if (error) throw error

    return NextResponse.json({ uploadUrl: data.signedUrl, path, token: data.token })
  } catch (error) {
    console.error('[POST /api/movie/upload-asset]', error)
    return NextResponse.json({ error: 'アップロードURLの生成に失敗しました' }, { status: 500 })
  }
}
