import { NextRequest, NextResponse } from 'next/server'
import { requireBannerAdmin } from '@/lib/banner-admin-guard'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ⚠️⚠️ このAPIは 2026-08-24 に無効化した。判定の前提が崩れたため。
//
// 元の考え方: 「Nano Banana Pro が作った画像は base64 データURIで入る。
//              data:image/ で始まらないものは別物なので消してよい」
//
// 崩れた理由: テンプレート画像を Postgres の base64 から Supabase Storage へ
//             移したので、**まともなテンプレートほど https:// で始まる**。
//             この判定のまま DELETE を1回叩くと、刷新した150枚と移行済みの
//             既存分が丸ごと消える（実質、全テンプレートの削除）。
//
// 画像の出所を示す列は無く、URLの形からは判別できない。作り直すなら
// 「どのモデルで作ったか」を列として持たせるところからになる。
// 復活させる時は、消してよい条件を必ず実データで数えてから変えること。
const DISABLED = NextResponse.json(
  {
    error: 'このAPIは無効です。base64かどうかで出所を判定する前提が崩れており、実行すると全テンプレートを削除します。',
    disabledAt: '2026-08-24',
  },
  { status: 410 }
)

/**
 * GET: Nano Banana Proで生成されていないテンプレートの一覧を取得
 *
 * Nano Banana Proで生成された画像は base64 data URL（data:image/...）で格納される。
 * それ以外（null、空、プレースホルダー、外部URL等）は非Nano Banana Proとみなす。
 */
export async function GET(request: Request) {
  const denied = requireBannerAdmin(request)
  if (denied) return denied
  return DISABLED

  try {
    const allTemplates = await prisma.bannerTemplate.findMany({
      select: {
        id: true,
        templateId: true,
        industry: true,
        imageUrl: true,
        createdAt: true,
      },
    })

    const nonNano: typeof allTemplates = []
    const nano: typeof allTemplates = []

    for (const t of allTemplates) {
      const url = t.imageUrl || ''
      // Nano Banana Proで生成された画像は data:image/ で始まるbase64
      if (url.startsWith('data:image/')) {
        nano.push(t)
      } else {
        nonNano.push(t)
      }
    }

    return NextResponse.json({
      totalCount: allTemplates.length,
      nanoCount: nano.length,
      nonNanoCount: nonNano.length,
      nonNanoTemplates: nonNano.map((t) => ({
        id: t.id,
        templateId: t.templateId,
        industry: t.industry,
        imageUrlPrefix: (t.imageUrl || '').substring(0, 80),
        createdAt: t.createdAt,
      })),
    })
  } catch (err: any) {
    console.error('[Cleanup Non-Nano] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE: Nano Banana Proで生成されていないテンプレートを一括削除
 */
export async function DELETE(request: Request) {
  const denied = requireBannerAdmin(request)
  if (denied) return denied
  return DISABLED

  try {
    // まず対象を特定
    const allTemplates = await prisma.bannerTemplate.findMany({
      select: {
        id: true,
        templateId: true,
        imageUrl: true,
      },
    })

    const nonNanoIds: string[] = []
    for (const t of allTemplates) {
      const url = t.imageUrl || ''
      if (!url.startsWith('data:image/')) {
        nonNanoIds.push(t.id)
      }
    }

    if (nonNanoIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: '削除対象のテンプレートはありませんでした',
        deletedCount: 0,
      })
    }

    const deleteResult = await prisma.bannerTemplate.deleteMany({
      where: {
        id: { in: nonNanoIds },
      },
    })

    console.log(`[Cleanup Non-Nano] Deleted ${deleteResult.count} non-Nano Banana Pro templates`)

    return NextResponse.json({
      success: true,
      message: `${deleteResult.count}件のNano Banana Pro以外のテンプレートを削除しました`,
      deletedCount: deleteResult.count,
    })
  } catch (err: any) {
    console.error('[Cleanup Non-Nano] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
