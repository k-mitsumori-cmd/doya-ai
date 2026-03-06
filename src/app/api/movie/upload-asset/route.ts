import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getGuestIdFromRequest } from '@/lib/movie/access'
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
    // 認証チェック（ログインユーザー or ゲスト）
    const session = await getServerSession(authOptions)
    const guestId = getGuestIdFromRequest(req)

    if (!session?.user?.email && !guestId) {
      return NextResponse.json({ error: '認証が必要です。ログインするかゲストとしてプロジェクトを作成してください。' }, { status: 401 })
    }

    let userId: string | null = null
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
      userId = user?.id ?? null
    }

    const body = await req.json()
    const { fileName, contentType, projectId } = body

    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'ファイル名とコンテンツタイプが必要です' }, { status: 400 })
    }

    const bucket = 'movie-assets'
    const ownerKey = userId ?? guestId ?? 'guest'
    const path = `${ownerKey}/${projectId ?? 'temp'}/${Date.now()}_${fileName}`

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
