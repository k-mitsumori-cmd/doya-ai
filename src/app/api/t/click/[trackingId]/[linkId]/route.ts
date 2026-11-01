import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveClickLink } from '@/lib/drip-click-link'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET: クリックトラッキング + リダイレクト（公開エンドポイント・認証不要）
// ⚠️ 署名の合わないリンクや、署名のない外部サイト宛てのリンクは転送しない（オープンリダイレクト対策）。
//    メールの受信者を迷わせないよう、エラー画面ではなくサイトのトップへ送る。計測もしない。
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string; linkId: string }> }
) {
  const { trackingId, linkId } = await params

  const resolved = resolveClickLink(trackingId, linkId)
  if (resolved.kind === 'rejected') {
    return NextResponse.redirect(process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp', 302)
  }
  const originalUrl = resolved.url

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
    console.error('[Drip] Click tracking error:')
  }

  return NextResponse.redirect(originalUrl, 302)
}
