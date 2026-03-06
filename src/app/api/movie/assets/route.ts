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

// GET /api/movie/assets?projectId=...
export async function GET(req: NextRequest) {
  try {
    // 認証チェック（ログインユーザー or ゲスト）
    const session = await getServerSession(authOptions)
    const guestId = getGuestIdFromRequest(req)

    if (!session?.user?.email && !guestId) {
      return NextResponse.json({ assets: [] })
    }

    let userId: string | null = null
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
      userId = user?.id ?? null
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId') ?? 'temp'
    const ownerKey = userId ?? guestId ?? 'guest'

    const { data: files, error } = await getSupabase().storage
      .from('movie-assets')
      .list(`${ownerKey}/${projectId}`, { sortBy: { column: 'created_at', order: 'desc' } })

    if (error) throw error

    const assets = await Promise.all(
      (files ?? []).map(async (f) => {
        const { data } = await getSupabase().storage
          .from('movie-assets')
          .createSignedUrl(`${ownerKey}/${projectId}/${f.name}`, 3600)
        return { name: f.name, url: data?.signedUrl ?? '', size: f.metadata?.size }
      })
    )

    return NextResponse.json({ assets })
  } catch (error) {
    console.error('[GET /api/movie/assets]', error)
    return NextResponse.json({ assets: [] })
  }
}
