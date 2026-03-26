import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET: クリックトラッキング + リダイレクト（公開エンドポイント・認証不要）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string; linkId: string }> }
) {
  const { trackingId, linkId } = await params

  // linkId を Base64 デコードして元の URL を取得
  let originalUrl: string
  try {
    originalUrl = Buffer.from(linkId, 'base64url').toString('utf-8')
  } catch {
    // base64url でダメなら通常の base64 を試す
    try {
      originalUrl = Buffer.from(linkId, 'base64').toString('utf-8')
    } catch {
      return NextResponse.json({ error: '無効なリンクです' }, { status: 400 })
    }
  }

  // URL の基本的なバリデーション
  if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://')) {
    return NextResponse.json({ error: '無効なリンクです' }, { status: 400 })
  }

  try {
    // clickedAt が未設定の場合のみ更新
    await prisma.dripEmailLog.updateMany({
      where: {
        trackingId,
        clickedAt: null,
      },
      data: {
        status: 'clicked',
        clickedAt: new Date(),
      },
    })
  } catch (error) {
    // トラッキングエラーでもリダイレクトは行う（ユーザー体験を損なわない）
    console.error('[Drip] Click tracking error:', error)
  }

  return NextResponse.redirect(originalUrl, 302)
}
