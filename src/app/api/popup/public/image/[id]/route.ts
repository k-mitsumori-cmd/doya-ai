export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================
// ポップアップ画像の配信（Storage は非公開のまま、ここで中継する）
// ============================================
// ⚠️ 返すのは「公開中の案の画像」か「ログイン中の持ち主の画像（下書きのプレビュー）」だけ。
// ⚠️ 画像パスは DB の値だけを使う（クエリの v はキャッシュを切り替えるための飾り）。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPopupUserId } from '@/lib/popup/access'
import { isId, type PopupCreative } from '@/lib/popup/schema'
import { contentTypeOfPath, loadImage } from '@/lib/popup/storage'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  if (!isId(id)) return new NextResponse(null, { status: 404 })
  const popup = await prisma.popup.findFirst({
    where: { id, site: { deletedAt: null } },
    select: { status: true, userId: true, creative: true },
  })
  const path = (popup?.creative as unknown as PopupCreative | undefined)?.imagePath
  if (!popup || !path) return new NextResponse(null, { status: 404 })

  const isPublic = popup.status === 'live'
  if (!isPublic) {
    // 下書き・停止中は持ち主だけ（編集画面のプレビュー）
    const userId = await getPopupUserId()
    if (!userId || userId !== popup.userId) return new NextResponse(null, { status: 404 })
  }

  const buf = await loadImage(path)
  if (!buf) return new NextResponse(null, { status: 404 })
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': contentTypeOfPath(path),
      // パスは中身のハッシュ入りで、差し替えるとURLの v が変わる。公開中は長くキャッシュさせる
      'Cache-Control': isPublic ? 'public, max-age=86400, s-maxage=31536000, immutable' : 'private, no-store',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  })
}
